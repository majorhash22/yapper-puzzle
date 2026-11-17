const crypto = require('node:crypto');
const bank = require('./trivia-tower-puzzles');

const POINTS_PER_PLACEMENT = 100;
const ITEM_COUNT = 6;
const ids = new Set();
const titles = new Set();
const puzzles = bank.map(puzzle => {
  if (!/^[a-z0-9-]+$/.test(puzzle.id) || ids.has(puzzle.id) || titles.has(puzzle.title)) {
    throw new Error(`Duplicate or invalid Trivia Tower question: ${puzzle.id}`);
  }
  ids.add(puzzle.id);
  titles.add(puzzle.title);
  if (!puzzle.title || !puzzle.category || !puzzle.lowLabel || !puzzle.highLabel || !puzzle.instructions ||
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

function ensureTowerDay(days, key, questions = puzzles) {
  if (days[key]) return days[key];
  // Never refill this pool. Even after the bank is exhausted, published IDs
  // stay reserved forever. Adding new IDs makes fresh questions available.
  const used = new Set(Object.values(days).map(day => day.puzzleId).filter(Boolean));
  const available = questions.filter(puzzle => !used.has(puzzle.id));
  const puzzle = available.length ? available[crypto.randomInt(available.length)] : null;
  return days[key] = {
    puzzleId: puzzle?.id || null,
    order: puzzle ? shuffledOrder(puzzle) : [],
    players: {}
  };
}

function publicTowerPuzzle(puzzle, day) {
  const byId = new Map(puzzle.items.map(item => [item.id, item]));
  return {
    id: puzzle.id, title: puzzle.title, category: puzzle.category,
    instructions: puzzle.instructions, lowLabel: puzzle.lowLabel, highLabel: puzzle.highLabel,
    note: puzzle.note || '',
    items: day.order.map((id, color) => ({ id, label: byId.get(id).label, color }))
  };
}

function validOrder(puzzle, order) {
  return Array.isArray(order) && order.length === ITEM_COUNT && new Set(order).size === ITEM_COUNT &&
    order.every(id => puzzle.items.some(item => item.id === id));
}

function scoreOrder(puzzle, order) {
  if (!validOrder(puzzle, order)) throw new Error('Submit each item exactly once.');
  const expected = correctOrder(puzzle);
  const placements = order.map((id, index) => ({ id, position: index + 1, correct: id === expected[index] }));
  const correctPlacements = placements.filter(placement => placement.correct).length;
  return { score: correctPlacements * POINTS_PER_PLACEMENT, correctPlacements, placements };
}

function revealResult(puzzle, player) {
  return {
    ...scoreOrder(puzzle, player.order),
    submittedOrder: player.order,
    correctOrder: correctOrder(puzzle),
    facts: puzzle.items.map(({ id, label, valueLabel }) => ({ id, label, valueLabel })),
    sources: puzzle.sources
  };
}

module.exports = {
  puzzles, ITEM_COUNT, POINTS_PER_PLACEMENT, ensureTowerDay,
  correctOrder, publicTowerPuzzle, validOrder, scoreOrder, revealResult
};
