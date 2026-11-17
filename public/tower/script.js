const $ = id => document.getElementById(id);
const playerKey = 'yappersPuzzleUserId';
let userId = readStorage(playerKey) || '';
let state = null;
let order = [];
let busy = false;
let draggedId = null;

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch {
    $('towerFeedback').textContent = 'Your browser could not save this draft. Keep this page open until you lock in.';
  }
}

function draftKey() { return `triviaTower:${userId}:${state.date}:${state.puzzle.id}`; }

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
    const detail = document.createElement('span'); detail.className = 'leader-sub'; detail.textContent = `${row.correctPlacements}/6 placements correct`; name.append(detail);
    const score = document.createElement('div'); score.className = 'leader-score'; score.textContent = row.score;
    entry.append(rank, name, score); root.append(entry);
  }
}

function moveItem(id, delta) {
  if (busy || state.finished) return;
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

function itemRow(item, position, answer = false) {
  const row = document.createElement('li');
  row.className = 'tower-row'; row.dataset.itemId = item.id; row.dataset.color = item.color;
  row.style.setProperty('--level', position - 1);
  const number = document.createElement('span'); number.className = 'row-position'; number.textContent = position;
  const label = document.createElement('span'); label.className = 'row-label'; label.textContent = item.label;
  row.append(number, label);
  if (answer) {
    const fact = state.result.facts.find(fact => fact.id === item.id);
    const value = document.createElement('span'); value.className = 'row-value'; value.textContent = fact.valueLabel; label.append(value);
  } else if (state.finished) {
    const correct = state.result.placements.find(placement => placement.position === position).correct;
    const mark = document.createElement('span'); mark.className = `placement-mark${correct ? '' : ' missed'}`;
    mark.textContent = correct ? `✓ +${state.pointsPerPlacement}` : '✕';
    mark.setAttribute('aria-label', correct ? 'Correct placement' : 'Incorrect placement'); row.append(mark);
  } else {
    row.draggable = !busy; row.tabIndex = 0;
    row.setAttribute('aria-label', `${item.label}, position ${position} from the bottom. Use arrow keys to move.`);
    const controls = document.createElement('div'); controls.className = 'row-controls';
    for (const [delta, symbol, direction] of [[1, '↑', 'up'], [-1, '↓', 'down']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol;
      button.setAttribute('aria-label', `Move ${item.label} ${direction}`);
      button.disabled = busy || position + delta < 1 || position + delta > order.length;
      button.addEventListener('click', () => moveItem(item.id, delta)); controls.append(button);
    }
    row.append(controls);
    row.addEventListener('keydown', event => {
      if (event.target !== row || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); moveItem(item.id, event.key === 'ArrowUp' ? 1 : -1);
    });
    row.addEventListener('dragstart', event => {
      if (busy) { event.preventDefault(); return; }
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

function renderTowers() {
  const byId = new Map(state.puzzle.items.map(item => [item.id, item]));
  $('playerTower').replaceChildren(...[...order].reverse().map((id, index) => itemRow(byId.get(id), 6 - index)));
  if (state.finished) {
    $('answerTower').replaceChildren(...[...state.result.correctOrder].reverse().map((id, index) => itemRow(byId.get(id), 6 - index, true)));
  } else {
    const placeholders = Array.from({ length: 6 }, (_, index) => {
      const row = document.createElement('li'); row.className = 'tower-row placeholder-row';
      const number = document.createElement('span'); number.className = 'row-position'; number.textContent = 6 - index;
      const label = document.createElement('span'); label.className = 'row-label'; label.textContent = 'Waiting to reveal';
      row.append(number, label); return row;
    });
    $('answerTower').replaceChildren(...placeholders);
  }
}

function render(nextState) {
  state = nextState;
  $('joinCard').classList.add('hidden'); $('retryButton').classList.add('hidden'); $('pageMessage').textContent = '';
  $('exhaustedCard').classList.toggle('hidden', !state.exhausted);
  $('towerGame').classList.toggle('hidden', state.exhausted);
  $('dailyDate').textContent = `${state.date} · ${state.timeZone}`;
  if (state.exhausted) return;
  order = state.finished ? [...state.result.submittedOrder] : state.puzzle.items.map(item => item.id);
  if (!state.finished) {
    try { const draft = JSON.parse(readStorage(draftKey())); if (validDraft(draft, state.puzzle.items)) order = draft; } catch {}
  }
  $('towerPlayerName').textContent = state.displayName;
  $('questionTitle').textContent = state.puzzle.title;
  $('questionCategory').textContent = state.puzzle.category;
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
  $('towerScore').textContent = state.finished ? state.result.score : state.maxScore;
  $('scoreLabel').textContent = state.finished ? 'YOUR DAILY SCORE' : 'UP FOR GRABS';
  $('scoreDetail').textContent = state.finished ? `${state.result.correctPlacements}/6 correct placements` : `${state.pointsPerPlacement} points per correct placement`;
  $('answerSubtitle').textContent = state.finished ? 'The complete ranking' : 'Revealed when you lock in';
  $('towerFeedback').textContent = '';
  $('refreshButton').classList.add('hidden');
  $('towerHeading').textContent = state.finished ? 'That’s today’s tower.' : 'Build your way to the top.';
  renderTowers(); renderLeaderboard(state.leaderboard);
  if (state.finished) {
    $('playerTower').classList.add('revealed'); $('answerTower').classList.add('revealed');
    $('resultTitle').textContent = state.result.correctPlacements === 6 ? 'A perfect tower. Nicely built.' : `${state.result.correctPlacements} of 6 in the right place.`;
    $('resultCopy').textContent = 'Every exact placement earns points, even if a lower row is wrong. Compare your tower with the answers above.';
    $('resetCopy').textContent = `Come back after midnight (${state.timeZone}) for a different question.`;
    const heading = document.createElement('strong'); heading.textContent = 'CHECK THE FACTS';
    $('factSources').replaceChildren(heading);
    for (const source of state.result.sources) {
      const link = document.createElement('a'); link.href = source.url; link.textContent = `${source.title} ↗`; link.target = '_blank'; link.rel = 'noopener noreferrer'; $('factSources').append(link);
    }
    try { localStorage.removeItem(draftKey()); } catch {}
  } else {
    $('playerTower').classList.remove('revealed'); $('answerTower').classList.remove('revealed');
  }
}

async function load() {
  $('retryButton').classList.add('hidden');
  if (!userId) { $('joinCard').classList.remove('hidden'); $('pageMessage').textContent = ''; return; }
  try { render(await api(`/api/tower/state?userId=${encodeURIComponent(userId)}`)); }
  catch (error) {
    if (error.status === 404) { userId = ''; $('joinCard').classList.remove('hidden'); $('pageMessage').textContent = 'Enter your name to join today’s tower.'; }
    else { $('pageMessage').textContent = error.message; $('retryButton').classList.remove('hidden'); }
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
    if (state?.puzzle && !state.finished) renderTowers();
  }
});

$('lockButton').addEventListener('click', async () => {
  if (busy || !state || state.finished) return;
  busy = true; $('lockButton').disabled = true; $('lockButton').textContent = 'Locking in…'; renderTowers();
  try {
    render(await api('/api/tower/submit', { userId, date: state.date, puzzleId: state.puzzle.id, order }));
    $('resultDetails').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  } catch (error) {
    $('towerFeedback').textContent = error.message;
    if (error.status === 409) $('refreshButton').classList.remove('hidden');
  } finally {
    busy = false; $('lockButton').disabled = false; $('lockButton').textContent = 'Lock in my tower ↗';
    if (!state.finished) renderTowers();
  }
});

$('retryButton').addEventListener('click', load);
$('refreshButton').addEventListener('click', load);
const events = new EventSource('/api/events');
events.addEventListener('leaderboard', event => {
  try { const payload = JSON.parse(event.data); if (state && payload.game === 'tower' && payload.date === state.date) renderLeaderboard(payload.leaderboard); } catch {}
});
load();
