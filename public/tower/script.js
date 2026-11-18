const $ = id => document.getElementById(id);
const playerKey = 'yappersPuzzleUserId';
let userId = readStorage(playerKey) || '';
let state = null;
let order = [];
let busy = false;
let loading = false;
let draggedId = null;
let difficulty = readStorage('triviaTowerDifficulty') || 'easy';
if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'easy';
let loadSequence = 0;
const REVEAL_INITIAL_DELAY_MS = 900;
const REVEAL_STEP_MS = 1200;
let revealing = false;
let revealedCount = 0;
let revealTimer = null;

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch {
    $('towerFeedback').textContent = 'Your browser could not save this draft. Keep this page open until you lock in.';
  }
}

function draftKey() { return `triviaTower:${userId}:${state.date}:${state.puzzle.id}`; }

function renderDifficulties() {
  $('difficultyPicker').classList.remove('hidden');
  $('difficultyMessage').classList.remove('hidden');
  $('difficultyMessage').textContent = 'Finish Easy to unlock Medium, then finish Medium to unlock Hard. All points add to your daily total.';
  $('difficultyPicker').replaceChildren(...state.difficulties.map(level => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'difficulty-option'; button.setAttribute('aria-pressed', String(level.id === difficulty));
    button.disabled = busy || loading || revealing || level.locked || (level.exhausted && !level.finished);
    if (level.locked) button.title = `Finish ${level.unlockAfter} first`;
    const label = document.createElement('strong'); label.textContent = `${level.label}${level.finished ? ' ✓' : ''}`;
    const detail = document.createElement('span');
    detail.textContent = level.locked ? `Finish ${level.unlockAfter} first` : level.exhausted ? 'All explored'
      : level.finished && !(revealing && level.id === difficulty) ? `${level.score} / ${level.maxScore} points` : `${level.maxScore} points`;
    button.append(label, detail);
    button.addEventListener('click', async () => {
      if (busy || loading || revealing || level.locked || level.exhausted || difficulty === level.id) return;
      await load(level.id);
    });
    $(`rules${level.label}Points`).textContent = `${level.maxScore.toLocaleString()} points max`;
    return button;
  }));
  renderDailyProgress();
}

function renderDailyProgress() {
  $('dailyProgress').classList.remove('hidden');
  const checkedScore = state.finished && state.result ? state.result.placements
    .filter(placement => placement.position <= revealedCount).reduce((sum, placement) => sum + placement.points, 0) : 0;
  const total = revealing ? state.totalScore - state.result.score + checkedScore : state.totalScore;
  $('dailyScore').textContent = total.toLocaleString();
  $('dailyScoreLimit').textContent = `/ ${state.dailyMaxScore.toLocaleString()} points`;
  $('dailyLevelProgress').textContent = `${state.completedLevels}/3 levels finished`;
  const next = state.difficulties.find(level => level.id === state.nextDifficulty);
  $('nextLevelButton').classList.toggle('hidden', !state.finished || revealing || !next);
  $('nextLevelButton').disabled = busy || loading || revealing;
  if (next) $('nextLevelButton').textContent = `Continue to ${next.label}`;
}

function animateTowerReveal(previousRect) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frame = document.querySelector('.player-frame');
  const nextRect = frame.getBoundingClientRect();
  frame.animate([
    { transform: `translate(${previousRect.left - nextRect.left}px, ${previousRect.top - nextRect.top}px) scaleX(${previousRect.width / nextRect.width})` },
    { transform: 'none' }
  ], { duration: 720, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
  $('answerFrame').animate([
    { opacity: 0, transform: 'translate(75px, 28px)' }, { opacity: 1, transform: 'none' }
  ], { duration: 650, delay: 150, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
}

async function api(url, body) {
  const response = await fetch(url, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Could not connect. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function validDraft(candidate, items) {
  return Array.isArray(candidate) && candidate.length === items.length &&
    new Set(candidate).size === items.length && candidate.every(id => items.some(item => item.id === id));
}

function renderLeaderboard(rows) {
  const root = $('towerLeaderboard');
  root.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = 'The first climb is yours. Lock in to join the leaderboard.'; root.append(empty);
  }
  for (const row of rows) {
    const entry = document.createElement('div'); entry.className = `leader-row${row.userId === userId ? ' you' : ''}`;
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = `#${row.rank}`;
    const name = document.createElement('div'); name.className = 'leader-name'; name.textContent = row.displayName;
    const detail = document.createElement('span'); detail.className = 'leader-sub';
    detail.textContent = `${row.completedLevels}/3 levels · ${row.correctPlacements}/${row.completedLevels * 6} correct`; name.append(detail);
    const score = document.createElement('div'); score.className = 'leader-score'; score.textContent = row.score;
    entry.append(rank, name, score); root.append(entry);
  }
}

function moveItem(id, delta) {
  if (busy || loading || state.finished) return;
  const index = order.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return;
  order.splice(index, 1); order.splice(target, 0, id);
  writeStorage(draftKey(), JSON.stringify(order));
  renderTowers();
  $('playerTower').querySelector(`[data-item-id="${id}"]`).focus();
  const item = state.puzzle.items.find(item => item.id === id);
  $('towerFeedback').textContent = `${item.label} moved to position ${target + 1} from the bottom.`;
}

function itemRow(item, position, answer = false, animatePosition = 0) {
  const row = document.createElement('li');
  row.className = 'tower-row'; row.dataset.itemId = item.id; row.dataset.color = item.color;
  row.dataset.position = position;
  if (position === animatePosition) row.classList.add('row-revealing');
  const number = document.createElement('span'); number.className = 'row-position'; number.textContent = position;
  const label = document.createElement('span'); label.className = 'row-label'; label.textContent = item.label;
  row.append(number, label);
  if (answer) {
    const fact = state.result.facts.find(fact => fact.id === item.id);
    const value = document.createElement('span'); value.className = 'row-value'; value.textContent = fact.valueLabel; label.append(value);
  } else if (state.finished) {
    const mark = document.createElement('span');
    if (position <= revealedCount) {
      const { correct, points } = state.result.placements.find(placement => placement.position === position);
      row.classList.add(correct ? 'placement-correct' : 'placement-incorrect');
      mark.className = `placement-mark ${correct ? 'correct' : 'missed'}`;
      mark.textContent = correct ? `✓ +${points}` : '✕ Wrong';
      mark.setAttribute('aria-label', correct ? 'Correct placement' : 'Incorrect placement');
    } else {
      mark.className = 'placement-mark pending'; mark.textContent = '…';
      mark.setAttribute('aria-label', 'Placement not checked yet');
    }
    row.append(mark);
  } else {
    row.draggable = !busy && !loading; row.tabIndex = 0;
    row.setAttribute('aria-label', `${item.label}, position ${position} from the bottom. Use arrow keys to move.`);
    const controls = document.createElement('div'); controls.className = 'row-controls';
    for (const [delta, symbol, direction] of [[1, '↑', 'up'], [-1, '↓', 'down']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol;
      button.setAttribute('aria-label', `Move ${item.label} ${direction}`);
      button.disabled = busy || loading || position + delta < 1 || position + delta > order.length;
      button.addEventListener('click', () => moveItem(item.id, delta)); controls.append(button);
    }
    row.append(controls);
    row.addEventListener('keydown', event => {
      if (event.target !== row || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); moveItem(item.id, event.key === 'ArrowUp' ? 1 : -1);
    });
    row.addEventListener('dragstart', event => {
      if (busy || loading) { event.preventDefault(); return; }
      draggedId = item.id; event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => { draggedId = null; row.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(row => row.classList.remove('drag-over')); });
    row.addEventListener('dragover', event => { if (draggedId) { event.preventDefault(); row.classList.add('drag-over'); } });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', event => {
      event.preventDefault(); row.classList.remove('drag-over');
      if (draggedId && draggedId !== item.id) moveItem(draggedId, order.indexOf(item.id) - order.indexOf(draggedId));
      draggedId = null;
    });
  }
  return row;
}

function renderTowers({ animatePosition = 0 } = {}) {
  const byId = new Map(state.puzzle.items.map(item => [item.id, item]));
  $('playerTower').replaceChildren(...[...order].reverse().map((id, index) => itemRow(byId.get(id), 6 - index, false, animatePosition)));
  if (!state.finished) { $('answerTower').replaceChildren(); return; }
  $('answerTower').replaceChildren(...Array.from({ length: 6 }, (_, index) => {
    const position = 6 - index;
    if (state.finished && position <= revealedCount) {
      return itemRow(byId.get(state.result.correctOrder[position - 1]), position, true, animatePosition);
    }
    // Unrevealed answers stay out of the DOM, including for screen readers.
    const row = document.createElement('li'); row.className = 'tower-row placeholder-row'; row.dataset.position = position;
    const number = document.createElement('span'); number.className = 'row-position'; number.textContent = position;
    const label = document.createElement('span'); label.className = 'row-label'; label.textContent = 'Waiting to reveal';
    row.append(number, label); return row;
  }));
}

function updateRevealProgress() {
  const checked = state.result.placements.filter(placement => placement.position <= revealedCount);
  const correct = checked.filter(placement => placement.correct).length;
  $('towerScore').textContent = checked.reduce((score, placement) => score + placement.points, 0);
  $('scoreLabel').textContent = revealing ? 'LEVEL SCORE SO FAR' : 'THIS LEVEL’S SCORE';
  $('scoreDetail').textContent = revealing ? `${revealedCount}/6 placements checked` : `${correct}/6 correct placements`;
  $('answerSubtitle').textContent = revealing ? `Revealing from the bottom · ${revealedCount}/6` : 'The complete ranking';
  $('towerHeading').textContent = revealing ? 'Let’s see how you stacked up.' : 'That’s today’s tower.';
  $('skipRevealButton').classList.toggle('hidden', !revealing);
  $('resultDetails').classList.toggle('hidden', revealing);
  $('towerLeaderboardCard').classList.toggle('hidden', revealing);
  renderDailyProgress();
}

function renderResultDetails() {
  $('resultTitle').textContent = state.result.correctPlacements === 6 ? 'A perfect tower. Nicely built.' : `${state.result.correctPlacements} of 6 in the right place.`;
  $('resultCopy').textContent = `This level: ${state.result.score.toLocaleString()} points. Today’s total: ${state.totalScore.toLocaleString()} points.`;
  const next = state.difficulties.find(level => level.id === state.nextDifficulty);
  $('resetCopy').textContent = next ? `${next.label} is unlocked. Continue when you’re ready.`
    : `Today’s available levels are finished. Come back after midnight (${state.timeZone}) for new questions.`;
  const heading = document.createElement('strong'); heading.textContent = 'CHECK THE FACTS';
  $('factSources').replaceChildren(heading);
  for (const source of state.result.sources) {
    const link = document.createElement('a'); link.href = source.url; link.textContent = `${source.title} ↗`; link.target = '_blank'; link.rel = 'noopener noreferrer'; $('factSources').append(link);
  }
}

function finishReveal({ animatePosition = 0 } = {}) {
  clearTimeout(revealTimer); revealTimer = null; revealing = false;
  revealedCount = state.puzzle.items.length;
  renderTowers({ animatePosition }); updateRevealProgress(); renderResultDetails(); renderLeaderboard(state.leaderboard); renderDifficulties();
}

function revealNextPlacement() {
  revealTimer = null;
  if (!revealing || !state?.finished) return;
  revealedCount += 1;
  const placement = state.result.placements.find(placement => placement.position === revealedCount);
  const answer = state.puzzle.items.find(item => item.id === state.result.correctOrder[revealedCount - 1]);
  const guess = state.puzzle.items.find(item => item.id === placement.id);
  $('towerFeedback').textContent = placement.correct
    ? `Position ${revealedCount}: ${answer.label}. Correct! +${placement.points} points.`
    : `Position ${revealedCount}: ${answer.label}. You placed ${guess.label}. Incorrect — 0 points.`;
  if (revealedCount === state.puzzle.items.length) finishReveal({ animatePosition: revealedCount });
  else {
    renderTowers({ animatePosition: revealedCount }); updateRevealProgress();
    revealTimer = setTimeout(revealNextPlacement, REVEAL_STEP_MS);
  }
  // Keep the row being checked in view on phones, where a tower is taller
  // than the viewport. The player's full submitted order stays visible.
  $('answerTower').querySelector(`[data-position="${revealedCount}"]`).scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest'
  });
}

function render(nextState, { animateReveal = false } = {}) {
  const previousRect = animateReveal ? document.querySelector('.player-frame').getBoundingClientRect() : null;
  clearTimeout(revealTimer); revealTimer = null;
  state = nextState;
  difficulty = state.difficulty;
  writeStorage('triviaTowerDifficulty', difficulty);
  revealing = Boolean(animateReveal && state.finished && !state.exhausted);
  revealedCount = state.finished && !revealing ? state.puzzle?.items.length || 0 : 0;
  $('joinCard').classList.add('hidden'); $('retryButton').classList.add('hidden'); $('pageMessage').textContent = '';
  $('exhaustedCard').classList.toggle('hidden', !state.exhausted);
  $('towerGame').classList.toggle('hidden', state.exhausted);
  $('dailyDate').textContent = `${state.date} · ${state.timeZone}`;
  $('contentRefreshNotice').classList.toggle('hidden', !state.contentRevision);
  renderDifficulties();
  if (state.exhausted) return;
  $('towerStage').classList.toggle('is-locked', state.finished);
  $('answerFrame').classList.toggle('hidden', !state.finished);
  order = state.finished ? [...state.result.submittedOrder] : state.puzzle.items.map(item => item.id);
  if (!state.finished) {
    try { const draft = JSON.parse(readStorage(draftKey())); if (validDraft(draft, state.puzzle.items)) order = draft; } catch {}
  }
  $('towerPlayerName').textContent = state.displayName;
  $('questionInstructions').textContent = state.puzzle.instructions;
  $('questionNote').textContent = state.puzzle.note;
  for (const prefix of ['your', 'answer']) {
    $(`${prefix}HighLabel`).textContent = state.puzzle.highLabel;
    $(`${prefix}LowLabel`).textContent = state.puzzle.lowLabel;
  }
  $('lockButton').classList.toggle('hidden', state.finished);
  $('moveHelp').classList.toggle('hidden', state.finished);
  $('buildGuide').classList.toggle('hidden', state.finished);
  $('resultDetails').classList.toggle('hidden', !state.finished);
  $('towerLeaderboardCard').classList.remove('hidden');
  $('skipRevealButton').classList.add('hidden');
  $('towerScore').textContent = state.finished ? state.result.score : state.maxScore;
  $('scoreLabel').textContent = state.finished ? 'THIS LEVEL’S SCORE' : 'UP FOR GRABS';
  $('scoreDetail').textContent = state.finished ? `${state.result.correctPlacements}/6 correct placements` : `6 correct spots = ${state.maxScore.toLocaleString()} points`;
  $('answerSubtitle').textContent = state.finished ? 'The complete ranking' : 'Revealed when you lock in';
  $('towerFeedback').textContent = '';
  $('refreshButton').classList.add('hidden');
  $('towerHeading').textContent = state.finished ? 'That’s today’s tower.' : 'Build your way to the top.';
  renderTowers(); renderLeaderboard(state.leaderboard);
  if (animateReveal) animateTowerReveal(previousRect);
  if (state.finished) {
    updateRevealProgress();
    if (revealing) {
      $('towerFeedback').textContent = 'Your tower is locked. Starting at the bottom…';
      revealTimer = setTimeout(revealNextPlacement, REVEAL_INITIAL_DELAY_MS);
    } else renderResultDetails();
    try { localStorage.removeItem(draftKey()); } catch {}
  }
}

async function load(nextDifficulty) {
  // Opening or refreshing resumes the next unfinished level. Explicit buttons
  // can also revisit completed levels without changing the daily total.
  if (typeof nextDifficulty !== 'string') nextDifficulty = undefined;
  const sequence = ++loadSequence;
  $('retryButton').classList.add('hidden');
  if (!userId) { $('joinCard').classList.remove('hidden'); $('pageMessage').textContent = ''; return; }
  loading = true;
  $('lockButton').disabled = true;
  if (state) renderDifficulties();
  try {
    const levelQuery = nextDifficulty ? `&difficulty=${encodeURIComponent(nextDifficulty)}` : '';
    const next = await api(`/api/tower/state?userId=${encodeURIComponent(userId)}${levelQuery}`);
    if (sequence === loadSequence) render(next);
  }
  catch (error) {
    if (sequence !== loadSequence) return;
    if (error.status === 404) { userId = ''; $('joinCard').classList.remove('hidden'); $('pageMessage').textContent = 'Enter your name to join today’s tower.'; }
    else { $('pageMessage').textContent = error.message; $('retryButton').classList.remove('hidden'); }
  }
  finally {
    if (sequence === loadSequence) {
      loading = false; $('lockButton').disabled = busy;
      if (state) renderDifficulties();
      if (state?.puzzle && !state.finished) renderTowers();
    }
  }
}

$('towerJoinForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return; busy = true;
  try {
    const player = await api('/api/register', { displayName: $('towerName').value.trim() });
    userId = player.userId; writeStorage(playerKey, userId); await load();
  } catch (error) { $('pageMessage').textContent = error.message; }
  finally {
    busy = false;
    $('lockButton').disabled = false;
    if (state) renderDifficulties();
    if (state?.puzzle && !state.finished) renderTowers();
  }
});

$('lockButton').addEventListener('click', async () => {
  if (busy || loading || !state || state.finished) return;
  busy = true; $('lockButton').disabled = true; $('lockButton').textContent = 'Locking in…'; renderTowers();
  $('towerLeaderboardCard').classList.add('hidden');
  try {
    renderDifficulties();
    render(await api('/api/tower/submit', { userId, date: state.date, puzzleId: state.puzzle.id, difficulty, order }), { animateReveal: true });
  } catch (error) {
    $('towerFeedback').textContent = error.message;
    if (error.status === 409) $('refreshButton').classList.remove('hidden');
  } finally {
    busy = false; $('lockButton').disabled = false; $('lockButton').textContent = 'Lock in my tower ↗';
    renderDifficulties();
    if (!state.finished) {
      renderTowers();
      $('towerLeaderboardCard').classList.remove('hidden');
    }
  }
});

$('retryButton').addEventListener('click', load);
$('refreshButton').addEventListener('click', load);
$('skipRevealButton').addEventListener('click', () => {
  if (!revealing) return;
  finishReveal();
  $('towerFeedback').textContent = 'All six placements checked.';
});
$('nextLevelButton').addEventListener('click', async () => {
  if (busy || loading || revealing || !state?.finished || !state.nextDifficulty) return;
  await load(state.nextDifficulty);
});
const events = new EventSource('/api/events');
events.addEventListener('tower-reset', event => {
  try {
    const reset = JSON.parse(event.data);
    if (state && reset.date === state.date && reset.revision !== state.contentRevision) load();
  } catch {}
});
events.addEventListener('leaderboard', event => {
  try {
    const payload = JSON.parse(event.data);
    if (state && payload.game === 'tower' && payload.date === state.date) {
      state.leaderboard = payload.leaderboard;
      if (!revealing && !busy) {
        renderLeaderboard(payload.leaderboard);
        const mine = payload.leaderboard.find(row => row.userId === userId);
        if (mine) { state.totalScore = mine.score; state.completedLevels = mine.completedLevels; renderDailyProgress(); }
      }
    }
  } catch {}
});
$('rulesButton').addEventListener('click', () => $('rulesDialog').showModal());
$('rulesDialog').showModal();
load();
