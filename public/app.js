const storageKey = 'yappersPuzzleUserId';
let userId = localStorage.getItem(storageKey) || '';
let state = null;
let menuState = null;
let currentGame = '';
let busy = false;

const $ = id => document.getElementById(id);
const joinView = $('joinView');
const menuView = $('menuView');
const gameView = $('gameView');
const puzzleCard = $('puzzleCard');
const finishedCard = $('finishedCard');
const giveUpModal = $('giveUpModal');

const events = new EventSource('/api/events');
events.addEventListener('leaderboard', event => {
  try {
    const payload = JSON.parse(event.data);
    if (state && currentGame && payload.game === currentGame && payload.date === state.date) {
      renderLeaderboard(payload.leaderboard);
    }
  } catch {}
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;'
  }[c]));
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function hideAllViews() {
  joinView.classList.add('hidden');
  menuView.classList.add('hidden');
  gameView.classList.add('hidden');
}

function resetHeader() {
  $('headerEyebrow').textContent = 'YAPPERS DAILY GAMES';
  $('headerTitle').textContent = 'Yappers Puzzle';
  $('todayPill').textContent = menuState?.date ? `${menuState.date} · Rebus + Chainly` : 'Rebus + Chainly daily';
}

function showJoin() {
  state = null;
  currentGame = '';
  hideAllViews();
  joinView.classList.remove('hidden');
  resetHeader();
}

function renderMenu(nextMenu) {
  menuState = nextMenu;
  state = null;
  currentGame = '';
  hideAllViews();
  menuView.classList.remove('hidden');
  resetHeader();
  $('menuPlayerName').textContent = nextMenu.displayName;

  for (const game of nextMenu.games || []) {
    const status = $(`${game.id}Status`);
    const button = $(`${game.id}PlayButton`);
    if (!status || !button) continue;

    status.innerHTML = `
      <span><strong>${game.completed}/5</strong> completed</span>
      <span><strong>${Number(game.score || 0).toLocaleString()}</strong> pts</span>
    `;

    if (game.finished) button.textContent = 'View results';
    else if (game.completed > 0) button.textContent = `Continue ${game.label}`;
    else button.textContent = `Play ${game.label}`;
  }
}

function showGame() {
  hideAllViews();
  gameView.classList.remove('hidden');
}

function renderLeaderboard(rows = []) {
  const root = $('leaderboard');
  if (!rows.length) {
    root.innerHTML = '<div class="empty">No scores yet. Be the first!</div>';
    return;
  }

  root.innerHTML = rows.map(row => `
    <div class="leader-row ${row.userId === userId ? 'you' : ''}">
      <div class="rank">#${row.rank}</div>
      <div class="leader-name">${escapeHtml(row.displayName)}<span class="leader-sub">${row.completed}/5 completed · ${row.solved} solved</span></div>
      <div class="leader-score">${Number(row.score || 0).toLocaleString()}</div>
    </div>
  `).join('');
}

function renderBreakdown() {
  const root = $('dailyBreakdown');
  root.innerHTML = (state.completed || []).map((item, i) => `
    <div class="breakdown-row">
      <span>Puzzle ${i + 1} · ${item.status === 'solved' ? 'Solved' : `Gave up — ${escapeHtml(item.answer || '')}`}</span>
      <strong>${item.score} pts</strong>
    </div>
  `).join('');
}

function renderState(nextState) {
  state = nextState;
  currentGame = state.game;
  showGame();

  $('headerEyebrow').textContent = state.gameEyebrow;
  $('headerTitle').textContent = `Yappers · ${state.gameLabel}`;
  $('todayPill').textContent = `${state.date} · 5 puzzles`;
  $('gameEyebrow').textContent = state.gameEyebrow;
  $('gameTitle').textContent = state.gameLabel;
  $('playerName').textContent = state.displayName;
  $('totalScore').textContent = Number(state.totalScore || 0).toLocaleString();
  $('progress').textContent = `${state.completed.length} / 5`;
  $('leaderboardTitle').textContent = `${state.gameLabel} leaderboard`;
  renderLeaderboard(state.leaderboard || []);

  if (state.finished) {
    puzzleCard.classList.add('hidden');
    finishedCard.classList.remove('hidden');
    $('finalScore').textContent = Number(state.totalScore || 0).toLocaleString();
    $('finishedTitle').textContent = `You finished today’s ${state.gameLabel}!`;
    $('finishedMessage').textContent = `Come back after the daily reset for five new ${state.gameLabel} puzzles.`;
    renderBreakdown();
    return;
  }

  finishedCard.classList.add('hidden');
  puzzleCard.classList.remove('hidden');
  $('puzzleNumber').textContent = `Puzzle ${state.puzzle.number} of ${state.puzzle.total}`;
  $('puzzleQuestion').textContent = state.puzzle.question;
  $('puzzleVisual').innerHTML = state.puzzle.prompt;
  $('puzzleCredit').classList.toggle('hidden', !state.puzzle.source);
  $('answerInput').placeholder = state.puzzle.placeholder || 'Type your answer…';
  $('answerInput').value = '';
  $('answerMessage').textContent = '';
  $('answerInput').focus();
}

function flashResult(text, type = 'success') {
  const banner = $('resultBanner');
  banner.textContent = text;
  banner.classList.remove('hidden');
  if (type === 'giveup') {
    banner.style.borderColor = 'rgba(245,158,11,.35)';
    banner.style.background = 'rgba(245,158,11,.1)';
    banner.style.color = '#fde68a';
  } else {
    banner.removeAttribute('style');
  }
  setTimeout(() => banner.classList.add('hidden'), 2800);
}

async function refreshMenu() {
  const data = await api(`/api/menu?userId=${encodeURIComponent(userId)}`);
  renderMenu(data);
}

async function startGame(game) {
  if (busy) return;
  busy = true;
  try {
    const nextState = await api(`/api/state?userId=${encodeURIComponent(userId)}&game=${encodeURIComponent(game)}`);
    renderState(nextState);
  } catch (err) {
    alert(err.message);
  } finally {
    busy = false;
  }
}

$('joinForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('joinError').textContent = '';
  const displayName = $('displayName').value.trim();
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ userId, displayName })
    });
    userId = data.userId;
    localStorage.setItem(storageKey, userId);
    renderMenu(data.menu);
  } catch (err) {
    $('joinError').textContent = err.message;
  }
});

document.querySelectorAll('.game-select').forEach(button => {
  button.addEventListener('click', () => startGame(button.dataset.game));
});

$('switchPlayerButton').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  userId = '';
  menuState = null;
  $('displayName').value = '';
  showJoin();
  $('displayName').focus();
});

async function goBackToGames() {
  try {
    await refreshMenu();
  } catch {
    showJoin();
  }
}

$('backToGames').addEventListener('click', goBackToGames);
$('finishedBackToGames').addEventListener('click', goBackToGames);

$('answerForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (busy || !currentGame) return;
  const answer = $('answerInput').value.trim();
  if (!answer) return;

  busy = true;
  $('answerMessage').textContent = '';
  try {
    const data = await api('/api/answer', {
      method: 'POST',
      body: JSON.stringify({ userId, game: currentGame, answer })
    });
    if (!data.correct) {
      $('answerMessage').textContent = data.message;
      $('answerInput').select();
    } else {
      flashResult(`Correct! +${data.earned} points.`);
      renderState(data.state);
    }
  } catch (err) {
    $('answerMessage').textContent = err.message;
  } finally {
    busy = false;
  }
});

$('giveUpButton').addEventListener('click', () => giveUpModal.classList.remove('hidden'));
$('cancelGiveUp').addEventListener('click', () => giveUpModal.classList.add('hidden'));
$('confirmGiveUp').addEventListener('click', async () => {
  if (busy || !currentGame) return;
  busy = true;
  try {
    const data = await api('/api/give-up', {
      method: 'POST',
      body: JSON.stringify({ userId, game: currentGame })
    });
    giveUpModal.classList.add('hidden');
    flashResult(`Gave up. The answer was “${data.answer}”. 0 points.`, 'giveup');
    renderState(data.state);
  } catch (err) {
    $('answerMessage').textContent = err.message;
    giveUpModal.classList.add('hidden');
  } finally {
    busy = false;
  }
});

giveUpModal.addEventListener('click', e => {
  if (e.target === giveUpModal) giveUpModal.classList.add('hidden');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') giveUpModal.classList.add('hidden');
});

(async function boot() {
  if (!userId) return showJoin();
  try {
    await refreshMenu();
  } catch {
    localStorage.removeItem(storageKey);
    userId = '';
    showJoin();
  }
})();
