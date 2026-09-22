const storageKey = 'yappersPuzzleUserId';
let userId = localStorage.getItem(storageKey) || '';
let state = null;
let busy = false;

const $ = id => document.getElementById(id);
const joinView = $('joinView');
const gameView = $('gameView');
const puzzleCard = $('puzzleCard');
const finishedCard = $('finishedCard');
const giveUpModal = $('giveUpModal');

const events = new EventSource('/api/events');
events.addEventListener('leaderboard', event => {
  try {
    const payload = JSON.parse(event.data);
    if (state && payload.date === state.date) renderLeaderboard(payload.leaderboard);
  } catch {}
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
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

function showJoin() {
  joinView.classList.remove('hidden');
  gameView.classList.add('hidden');
}

function showGame() {
  joinView.classList.add('hidden');
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
      <div class="leader-score">${row.score.toLocaleString()}</div>
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
  showGame();
  $('playerName').textContent = state.displayName;
  $('totalScore').textContent = state.totalScore.toLocaleString();
  $('progress').textContent = `${state.completed.length} / 5`;
  $('todayPill').textContent = `${state.date} · 5 puzzles`;
  renderLeaderboard(state.leaderboard || []);

  if (state.finished) {
      puzzleCard.classList.add('hidden');
    finishedCard.classList.remove('hidden');
    $('finalScore').textContent = state.totalScore.toLocaleString();
    renderBreakdown();
    return;
  }

  finishedCard.classList.add('hidden');
  puzzleCard.classList.remove('hidden');
  $('puzzleNumber').textContent = `Puzzle ${state.puzzle.number} of ${state.puzzle.total}`;
  $('puzzleVisual').innerHTML = state.puzzle.prompt;
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
    renderState(data.state);
  } catch (err) {
    $('joinError').textContent = err.message;
  }
});

$('answerForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  const answer = $('answerInput').value.trim();
  if (!answer) return;
  busy = true;
  $('answerMessage').textContent = '';
  try {
    const data = await api('/api/answer', {
      method: 'POST',
      body: JSON.stringify({ userId, answer })
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
  if (busy) return;
  busy = true;
  try {
    const data = await api('/api/give-up', {
      method: 'POST',
      body: JSON.stringify({ userId })
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
    const nextState = await api(`/api/state?userId=${encodeURIComponent(userId)}`);
    renderState(nextState);
  } catch {
    localStorage.removeItem(storageKey);
    userId = '';
    showJoin();
  }
})();
