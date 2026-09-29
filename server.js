const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const rebusPuzzles = require('./puzzles');
const chainPuzzles = require('./chain-puzzles');
const { initialRotation, selectPuzzles } = require('./schedule');

const PORT = Number(process.env.PORT || 3000);
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Regina';
const DAILY_COUNT = 5;
const MAX_SCORE = 1000;
const POINTS_LOST_PER_SECOND = 10;
const MIN_SOLVED_SCORE = 100;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'game-data.json');
const sseClients = new Set();

const GAME_CONFIGS = {
  rebus: {
    id: 'rebus',
    label: 'Rebus',
    eyebrow: 'DAILY REBUS CHALLENGE',
    description: 'Decode visual word and phrase puzzles.',
    question: 'What phrase does this represent?',
    placeholder: 'Type your answer…',
    puzzles: rebusPuzzles,
    daysField: 'days',
    rotationField: 'rotation'
  },
  chain: {
    id: 'chain',
    label: 'Chain Reaction',
    eyebrow: 'DAILY WORD CHAIN',
    description: 'Find the two missing words that connect the chain.',
    question: 'Find the two missing words in order.',
    placeholder: 'Example: box, office',
    puzzles: chainPuzzles,
    daysField: 'chainDays',
    rotationField: 'chainRotation'
  }
};

if ((process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT_ID) && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  throw new Error('Yappers Puzzle needs a Railway volume. Attach one to this service at /app/data, then redeploy.');
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
let db = loadDb();

function loadDb() {
  if (fs.existsSync(DATA_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!parsed.users || typeof parsed.users !== 'object') parsed.users = {};
    if (!parsed.days || typeof parsed.days !== 'object') parsed.days = {};
    if (!parsed.chainDays || typeof parsed.chainDays !== 'object') parsed.chainDays = {};
    if (!parsed.chainlyDays || typeof parsed.chainlyDays !== 'object') parsed.chainlyDays = {};
    return parsed;
  }
  return { users: {}, days: {}, chainDays: {}, chainlyDays: {} };
}

function saveDb() {
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DATA_FILE);
}

function dayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function gameConfig(gameId) {
  return GAME_CONFIGS[gameId] || null;
}

function requestedGame(value) {
  const gameId = String(value || 'rebus').toLowerCase();
  return gameConfig(gameId) ? gameId : null;
}

function ensureDay(gameId, key) {
  const config = gameConfig(gameId);
  if (!config) throw new Error('Unknown game.');
  if (!db[config.daysField] || typeof db[config.daysField] !== 'object') db[config.daysField] = {};
  const days = db[config.daysField];

  if (!days[key]) {
    const ids = config.puzzles.map(p => p.id);
    const rotation = db[config.rotationField] || initialRotation(days, ids);
    const result = selectPuzzles(rotation, ids, key, DAILY_COUNT);
    db[config.rotationField] = result.rotation;
    days[key] = { puzzleIds: result.puzzleIds, players: {} };
    saveDb();
  }

  if (!days[key].players || typeof days[key].players !== 'object') days[key].players = {};
  return days[key];
}

function getPuzzle(gameId, id) {
  return gameConfig(gameId)?.puzzles.find(p => p.id === id);
}

function normalizeAnswer(value) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function chainMiddleWords(puzzle) {
  return puzzle.words.slice(1, -1);
}

function answerMatches(gameId, puzzle, answer) {
  const normalized = normalizeAnswer(answer);
  if (gameId === 'chain') {
    return normalized === normalizeAnswer(chainMiddleWords(puzzle).join(' '));
  }
  return puzzle.answers.some(candidate => normalizeAnswer(candidate) === normalized);
}

function canonicalAnswer(gameId, puzzle) {
  if (gameId === 'chain') return chainMiddleWords(puzzle).join(' → ');
  return puzzle.answers[0];
}

function sanitizeName(name) {
  return String(name || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

function ensurePlayer(userId, key, gameId) {
  const day = ensureDay(gameId, key);
  if (!day.players[userId]) {
    day.players[userId] = {
      currentIndex: 0,
      startedAt: null,
      totalScore: 0,
      completed: [],
      finishedAt: null
    };
  }
  return day.players[userId];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

function chainPrompt(puzzle) {
  const [first, , , last] = puzzle.words;
  return `<div class="chain-puzzle" aria-label="${escapeHtml(first)} to ${escapeHtml(last)} word chain">
    <span class="chain-word chain-anchor">${escapeHtml(first.toUpperCase())}</span>
    <span class="chain-arrow">→</span>
    <span class="chain-word chain-blank">?</span>
    <span class="chain-arrow">→</span>
    <span class="chain-word chain-blank">?</span>
    <span class="chain-arrow">→</span>
    <span class="chain-word chain-anchor">${escapeHtml(last.toUpperCase())}</span>
  </div>`;
}

function publicPuzzle(gameId, puzzle, index) {
  const config = gameConfig(gameId);
  return {
    id: puzzle.id,
    prompt: gameId === 'chain' ? chainPrompt(puzzle) : puzzle.prompt,
    number: index + 1,
    total: DAILY_COUNT,
    question: config.question,
    placeholder: config.placeholder
  };
}

function leaderboardFor(key, gameId) {
  const day = ensureDay(gameId, key);
  return Object.entries(day.players).map(([userId, player]) => ({
    userId,
    displayName: db.users[userId]?.displayName || 'Anonymous',
    score: player.totalScore,
    solved: player.completed.filter(x => x.status === 'solved').length,
    completed: player.completed.length,
    finishedAt: player.finishedAt
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (a.completed !== b.completed) return b.completed - a.completed;
    const af = a.finishedAt ? new Date(a.finishedAt).getTime() : Infinity;
    const bf = b.finishedAt ? new Date(b.finishedAt).getTime() : Infinity;
    return af - bf;
  }).slice(0, 100).map((row, i) => ({ ...row, rank: i + 1 }));
}

function gameSummary(userId, gameId, key) {
  const config = gameConfig(gameId);
  const day = ensureDay(gameId, key);
  const player = day.players[userId];
  return {
    id: gameId,
    label: config.label,
    eyebrow: config.eyebrow,
    description: config.description,
    completed: player?.completed?.length || 0,
    score: player?.totalScore || 0,
    finished: Boolean(player?.currentIndex >= DAILY_COUNT)
  };
}

function menuFor(userId) {
  const user = db.users[userId];
  if (!user) return null;
  const key = dayKey();
  return {
    date: key,
    timeZone: APP_TIMEZONE,
    displayName: user.displayName,
    games: Object.keys(GAME_CONFIGS).map(gameId => gameSummary(userId, gameId, key))
  };
}

function getState(userId, gameId) {
  const config = gameConfig(gameId);
  const key = dayKey();
  const day = ensureDay(gameId, key);
  const player = ensurePlayer(userId, key, gameId);
  const user = db.users[userId];
  if (!user) return null;

  const base = {
    game: gameId,
    gameLabel: config.label,
    gameEyebrow: config.eyebrow,
    date: key,
    timeZone: APP_TIMEZONE,
    displayName: user.displayName,
    totalScore: player.totalScore,
    completed: player.completed,
    leaderboard: leaderboardFor(key, gameId)
  };

  if (player.currentIndex >= DAILY_COUNT) {
    return { ...base, finished: true };
  }

  if (!player.startedAt) {
    player.startedAt = new Date().toISOString();
    saveDb();
  }

  const puzzle = getPuzzle(gameId, day.puzzleIds[player.currentIndex]);
  if (!puzzle) throw new Error(`Missing ${gameId} puzzle referenced by saved day.`);

  return {
    ...base,
    finished: false,
    startedAt: player.startedAt,
    puzzle: publicPuzzle(gameId, puzzle, player.currentIndex)
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 32768) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendLeaderboard(gameId) {
  const key = dayKey();
  const payload = JSON.stringify({
    date: key,
    game: gameId,
    leaderboard: leaderboardFor(key, gameId)
  });
  for (const res of sseClients) res.write(`event: leaderboard\ndata: ${payload}\n\n`);
}

// Chainly keeps its puzzle and guesses in the browser. Only its daily standing
// is stored here, alongside the Rebus accounts and in the same Railway volume.
function chainlyDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  const today = Date.parse(`${dayKey()}T00:00:00Z`);
  return Math.abs(timestamp - today) <= 86400000 ? value : null;
}

function chainlyLeaderboard(key) {
  const players = db.chainlyDays[key]?.players || {};
  const stage = status => status === 'won' ? 0 : status === 'playing' ? 1 : 2;
  return Object.entries(players).map(([userId, player]) => ({
    userId,
    displayName: db.users[userId]?.displayName || 'Anonymous',
    guesses: player.guesses,
    solved: player.solved,
    status: player.status,
    finishedAt: player.finishedAt
  })).sort((a, b) => {
    if (stage(a.status) !== stage(b.status)) return stage(a.status) - stage(b.status);
    if (a.status === 'playing' && a.solved !== b.solved) return b.solved - a.solved;
    if (a.guesses !== b.guesses) return a.guesses - b.guesses;
    return (a.finishedAt || '').localeCompare(b.finishedAt || '') || a.displayName.localeCompare(b.displayName);
  }).slice(0, 100).map((row, i) => ({ ...row, rank: i + 1 }));
}

function sendChainlyLeaderboard(key) {
  const payload = JSON.stringify({ game: 'chainly', date: key, leaderboard: chainlyLeaderboard(key) });
  for (const res of sseClients) res.write(`event: leaderboard\ndata: ${payload}\n\n`);
}

function serveStatic(reqPath, res) {
  let rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;

  const ext = path.extname(file).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  const noCache = ['.html', '.css', '.js'].includes(ext);
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600'
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      date: dayKey(),
      timeZone: APP_TIMEZONE,
      puzzlesPerDay: DAILY_COUNT,
      games: Object.keys(GAME_CONFIGS)
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/menu') {
    const userId = String(url.searchParams.get('userId') || '');
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });
    return json(res, 200, menuFor(userId));
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const userId = String(url.searchParams.get('userId') || '');
    const gameId = requestedGame(url.searchParams.get('game'));
    if (!gameId) return json(res, 400, { error: 'Unknown game.' });
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });
    return json(res, 200, getState(userId, gameId));
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    const gameId = requestedGame(url.searchParams.get('game'));
    if (!gameId) return json(res, 400, { error: 'Unknown game.' });
    const key = dayKey();
    return json(res, 200, { date: key, game: gameId, leaderboard: leaderboardFor(key, gameId) });
  }

  if (req.method === 'GET' && url.pathname === '/api/chainly/leaderboard') {
    const key = chainlyDate(url.searchParams.get('date'));
    if (!key) return json(res, 400, { error: 'Invalid daily puzzle date.' });
    return json(res, 200, { date: key, game: 'chainly', leaderboard: chainlyLeaderboard(key) });
  }

  if (req.method === 'POST' && url.pathname === '/api/chainly/progress') {
    const body = await readJson(req);
    const userId = String(body.userId || '');
    const key = chainlyDate(body.date);
    const { status, guesses, solved } = body;
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });
    if (!key || !['playing', 'won', 'gave-up'].includes(status) ||
        !Number.isInteger(guesses) || guesses < 0 || guesses > 999 ||
        !Number.isInteger(solved) || solved < 0 || solved > 5 || solved > guesses ||
        (status === 'won' && solved !== 5) || (status !== 'won' && solved === 5)) {
      return json(res, 400, { error: 'Invalid Chainly progress.' });
    }
    const day = db.chainlyDays[key] ||= { players: {} };
    const previous = day.players[userId];
    if (previous?.status === 'won' || previous?.status === 'gave-up') {
      return json(res, 200, { date: key, game: 'chainly', leaderboard: chainlyLeaderboard(key) });
    }
    if (previous && (guesses < previous.guesses || solved < previous.solved)) {
      return json(res, 409, { error: 'An older progress update was ignored.' });
    }
    day.players[userId] = {
      guesses, solved, status,
      finishedAt: status === 'playing' ? null : new Date().toISOString()
    };
    saveDb();
    const payload = { date: key, game: 'chainly', leaderboard: chainlyLeaderboard(key) };
    json(res, 200, payload);
    sendChainlyLeaderboard(key);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/register') {
    const body = await readJson(req);
    const requestedId = String(body.userId || '').trim();
    const displayName = sanitizeName(body.displayName);
    if (displayName.length < 2) {
      return json(res, 400, { error: 'Please enter a name with at least 2 characters.' });
    }

    let userId = requestedId;
    if (!userId || !db.users[userId]) {
      userId = crypto.randomUUID();
      db.users[userId] = { displayName, createdAt: new Date().toISOString() };
    } else {
      db.users[userId].displayName = displayName;
    }

    saveDb();
    return json(res, 200, { userId, menu: menuFor(userId) });
  }

  if (req.method === 'POST' && url.pathname === '/api/answer') {
    const body = await readJson(req);
    const userId = String(body.userId || '');
    const gameId = requestedGame(body.game);
    const answer = String(body.answer || '');
    if (!gameId) return json(res, 400, { error: 'Unknown game.' });
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });

    const key = dayKey();
    const day = ensureDay(gameId, key);
    const player = ensurePlayer(userId, key, gameId);
    if (player.currentIndex >= DAILY_COUNT) {
      return json(res, 200, { correct: true, state: getState(userId, gameId) });
    }

    if (!player.startedAt) player.startedAt = new Date().toISOString();
    const puzzle = getPuzzle(gameId, day.puzzleIds[player.currentIndex]);
    if (!answerMatches(gameId, puzzle, answer)) {
      saveDb();
      return json(res, 200, { correct: false, message: 'Not quite. Try again or give up.' });
    }

    const solvedAt = new Date();
    const elapsedMs = Math.max(0, solvedAt.getTime() - new Date(player.startedAt).getTime());
    const score = Math.max(MIN_SOLVED_SCORE, MAX_SCORE - Math.floor((elapsedMs / 1000) * POINTS_LOST_PER_SECOND));

    player.completed.push({
      puzzleId: puzzle.id,
      status: 'solved',
      score,
      elapsedMs,
      completedAt: solvedAt.toISOString()
    });
    player.totalScore += score;
    player.currentIndex += 1;
    player.startedAt = player.currentIndex < DAILY_COUNT ? solvedAt.toISOString() : null;
    if (player.currentIndex >= DAILY_COUNT) player.finishedAt = solvedAt.toISOString();

    saveDb();
    const payload = { correct: true, earned: score, elapsedMs, state: getState(userId, gameId) };
    json(res, 200, payload);
    sendLeaderboard(gameId);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/give-up') {
    const body = await readJson(req);
    const userId = String(body.userId || '');
    const gameId = requestedGame(body.game);
    if (!gameId) return json(res, 400, { error: 'Unknown game.' });
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });

    const key = dayKey();
    const day = ensureDay(gameId, key);
    const player = ensurePlayer(userId, key, gameId);
    if (player.currentIndex >= DAILY_COUNT) {
      return json(res, 200, { state: getState(userId, gameId) });
    }

    const puzzle = getPuzzle(gameId, day.puzzleIds[player.currentIndex]);
    const now = new Date();
    const elapsedMs = player.startedAt ? Math.max(0, now.getTime() - new Date(player.startedAt).getTime()) : 0;
    const revealedAnswer = canonicalAnswer(gameId, puzzle);

    player.completed.push({
      puzzleId: puzzle.id,
      status: 'gave-up',
      score: 0,
      elapsedMs,
      answer: revealedAnswer,
      completedAt: now.toISOString()
    });
    player.currentIndex += 1;
    player.startedAt = player.currentIndex < DAILY_COUNT ? now.toISOString() : null;
    if (player.currentIndex >= DAILY_COUNT) player.finishedAt = now.toISOString();

    saveDb();
    const payload = { answer: revealedAnswer, state: getState(userId, gameId) };
    json(res, 200, payload);
    sendLeaderboard(gameId);
    return;
  }

  json(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method === 'GET' && serveStatic(url.pathname, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Server error.' });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Yappers Puzzle running at http://localhost:${PORT}`);
  console.log(`Daily reset timezone: ${APP_TIMEZONE}`);
  console.log(`Game data: ${DATA_DIR}`);
});
