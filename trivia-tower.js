const crypto = require('node:crypto');
const originalBank = require('./trivia-tower-puzzles');
const contentUpdate = require('./trivia-tower-refresh');
const retiredIds = new Set(contentUpdate.retiredIds);
if (retiredIds.size !== contentUpdate.retiredIds.length ||
    contentUpdate.puzzles.length !== retiredIds.size ||
    contentUpdate.retiredIds.some(id => !originalBank.some(puzzle => puzzle.id === id))) {
  throw new Error('Trivia Tower replacements must match the retired questions one for one.');
}
const activeBank = [...originalBank.filter(puzzle => !retiredIds.has(puzzle.id)), ...contentUpdate.puzzles];
const archivedBank = originalBank.filter(puzzle => retiredIds.has(puzzle.id));

const POINTS_PER_PLACEMENT = 100;
const ITEM_COUNT = 6;
const SCORING_VERSION = 'difficulty-totals-v2';
const DIFFICULTIES = {
  easy: { label: 'Easy', maxScore: 600 },
  medium: { label: 'Medium', maxScore: 800 },
  hard: { label: 'Hard', maxScore: 1200 }
};
const ids = new Set();
const titles = new Set();
const allPuzzles = [...activeBank, ...archivedBank].map(puzzle => {
  if (!/^[a-z0-9-]+$/.test(puzzle.id) || ids.has(puzzle.id) || titles.has(puzzle.title)) {
    throw new Error(`Duplicate or invalid Trivia Tower question: ${puzzle.id}`);
  }
  ids.add(puzzle.id);
  titles.add(puzzle.title);
  if (!Object.hasOwn(DIFFICULTIES, puzzle.difficulty) || !puzzle.title || !puzzle.category || !puzzle.lowLabel || !puzzle.highLabel || !puzzle.instructions ||
      !Array.isArray(puzzle.sources) || !puzzle.sources.length ||
      !puzzle.sources.every(source => source.title && /^https:\/\//.test(source.url)) ||
      !Array.isArray(puzzle.items) || puzzle.items.length !== ITEM_COUNT ||
      new Set(puzzle.items.map(item => item.label)).size !== ITEM_COUNT ||
      new Set(puzzle.items.map(item => item.value)).size !== ITEM_COUNT ||
      !puzzle.items.every(item => item.label && Number.isFinite(item.value) && item.valueLabel)) {
    throw new Error(`Trivia Tower question ${puzzle.id} needs six unambiguous items and a source.`);
  }
  return {
    ...puzzle,
    items: puzzle.items.map(item => ({
      ...item,
      // IDs identify labels, never their correct position in the answer.
      id: crypto.createHash('sha256').update(`${puzzle.id}:${item.label}`).digest('hex').slice(0, 12)
    }))
  };
});
const puzzles = allPuzzles.slice(0, activeBank.length);
const retiredPuzzles = allPuzzles.slice(activeBank.length);
const byId = new Map(allPuzzles.map(puzzle => [puzzle.id, puzzle]));
function getPuzzle(id) { return byId.get(id); }

function refreshDailyTowers(db, key, questions = puzzles) {
  const refresh = contentUpdate.refresh;
  if (key !== refresh.date || db.towerContentRefreshes?.[refresh.id]) return false;
  const nextDays = { ...db.towerDays };
  const resetPlayers = new Set();
  const canonicalKeys = new Set([key, ...Object.keys(DIFFICULTIES).map(difficulty => `${key}:${difficulty}`)]);
  for (const [savedKey, day] of Object.entries(nextDays)) {
    if (savedKey !== key && !savedKey.startsWith(`${key}:`)) continue;
    for (const userId of Object.keys(day.players || {})) resetPlayers.add(userId);
    const cleared = { ...day, players: {} };
    if (canonicalKeys.has(savedKey)) {
      if (day.puzzleId) nextDays[`${key}:content-refresh:${day.puzzleId}`] = { ...cleared, retiredReason: 'content-refresh' };
      delete nextDays[savedKey];
    } else nextDays[savedKey] = cleared;
  }
  const used = new Set(Object.values(nextDays).map(day => day.puzzleId).filter(Boolean));
  const newIds = new Set(contentUpdate.puzzles.map(puzzle => puzzle.id));
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const preferred = questions.find(puzzle => puzzle.id === refresh.showcase[difficulty] && puzzle.difficulty === difficulty && !used.has(puzzle.id));
    const fresh = questions.filter(puzzle => newIds.has(puzzle.id) && puzzle.difficulty === difficulty && !used.has(puzzle.id));
    const candidates = preferred ? [preferred] : fresh.length ? fresh : questions;
    const day = ensureTowerDay(nextDays, key, candidates, difficulty);
    if (day.puzzleId) used.add(day.puzzleId);
  }
  // Commit all three new towers and the reset marker together. Restarts and
  // later requests cannot erase scores earned after this refresh.
  db.towerDays = nextDays;
  db.towerContentRefreshes = { ...db.towerContentRefreshes,
    [refresh.id]: { date: key, appliedAt: new Date().toISOString(), resetPlayerCount: resetPlayers.size } };
  return true;
}

function correctOrder(puzzle) {
  return [...puzzle.items].sort((a, b) => a.value - b.value).map(item => item.id);
}

function shuffledOrder(puzzle) {
  const order = puzzle.items.map(item => item.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.every((id, i) => id === correctOrder(puzzle)[i])) order.push(order.shift());
  return order;
}

function ensureTowerDay(days, key, questions = puzzles, difficulty = 'medium') {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('Unknown tower difficulty.');
  // A previously published single tower remains the medium challenge, keeping
  // its question, shuffle, and locked submissions.
  const storageKey = difficulty === 'medium' && days[key] ? key : `${key}:${difficulty}`;
  const existing = days[storageKey];
  if (existing) {
    const published = questions.find(puzzle => puzzle.id === existing.puzzleId);
    // A difficulty correction may replace a tower nobody has submitted yet.
    // Reserve its published question forever, including abandoned drafts.
    // Once anyone has locked in, all players must keep that day's question.
    if (!published || published.difficulty === difficulty || Object.keys(existing.players).length) return existing;
    days[`${storageKey}:retired:${existing.puzzleId}`] = { ...existing, retiredReason: 'difficulty-review' };
  }
  // Never refill this pool. Even after the bank is exhausted, published IDs
  // stay reserved forever. Adding new IDs makes fresh questions available.
  const used = new Set(Object.values(days).map(day => day.puzzleId).filter(Boolean));
  const available = questions.filter(puzzle => puzzle.difficulty === difficulty && !used.has(puzzle.id));
  const puzzle = available.length ? available[crypto.randomInt(available.length)] : null;
  return days[storageKey] = {
    difficulty, maxScore: DIFFICULTIES[difficulty].maxScore, scoringVersion: SCORING_VERSION,
    puzzleId: puzzle?.id || null,
    order: puzzle ? shuffledOrder(puzzle) : [],
    players: {}
  };
}

function publicTowerPuzzle(puzzle, day) {
  const byId = new Map(puzzle.items.map(item => [item.id, item]));
  return {
    id: puzzle.id, category: puzzle.category,
    instructions: puzzle.instructions, lowLabel: puzzle.lowLabel, highLabel: puzzle.highLabel,
    note: puzzle.note || '',
    items: day.order.map((id, color) => ({ id, label: byId.get(id).label, color }))
  };
}

function validOrder(puzzle, order) {
  return Array.isArray(order) && order.length === ITEM_COUNT && new Set(order).size === ITEM_COUNT &&
    order.every(id => puzzle.items.some(item => item.id === id));
}

function scoreForPlacements(correctPlacements, maxScore) {
  return Math.round(correctPlacements * maxScore / ITEM_COUNT);
}

function scoreOrder(puzzle, order, maxScore = DIFFICULTIES.easy.maxScore) {
  if (!validOrder(puzzle, order)) throw new Error('Submit each item exactly once.');
  const expected = correctOrder(puzzle);
  let correctPlacements = 0;
  const placements = order.map((id, index) => {
    const correct = id === expected[index];
    const previous = scoreForPlacements(correctPlacements, maxScore);
    if (correct) correctPlacements += 1;
    const points = scoreForPlacements(correctPlacements, maxScore) - previous;
    return { id, position: index + 1, correct, points };
  });
  return { score: scoreForPlacements(correctPlacements, maxScore), correctPlacements, placements };
}

function revealResult(puzzle, player) {
  return {
    ...scoreOrder(puzzle, player.order, player.maxScore || (player.pointsPerPlacement || POINTS_PER_PLACEMENT) * ITEM_COUNT),
    submittedOrder: player.order,
    correctOrder: correctOrder(puzzle),
    facts: puzzle.items.map(({ id, label, valueLabel }) => ({ id, label, valueLabel })),
    sources: puzzle.sources
  };
}

module.exports = {
  puzzles, retiredPuzzles, getPuzzle, CONTENT_REFRESH: contentUpdate.refresh, refreshDailyTowers,
  ITEM_COUNT, POINTS_PER_PLACEMENT, DIFFICULTIES, SCORING_VERSION, ensureTowerDay, scoreForPlacements,
  correctOrder, publicTowerPuzzle, validOrder, scoreOrder, revealResult
};
