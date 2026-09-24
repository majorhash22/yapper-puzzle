const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const puzzles = require('./puzzles');
const { initialRotation, selectPuzzles } = require('./schedule');

const PORT = Number(process.env.PORT || 3000);
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Regina';
const DAILY_COUNT = 5;
const MAX_SCORE = 1000;
const POINTS_LOST_PER_SECOND = 10;
const MIN_SOLVED_SCORE = 100;
const PUBLIC_DIR = path.join(__dirname, 'public');
// Railway exposes this path when a persistent volume is attached.
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'game-data.json');
const sseClients = new Set();

if ((process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT_ID) && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  throw new Error('Yappers Puzzle needs a Railway volume. Attach one to this service at /app/data, then redeploy.');
}
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
let db = loadDb();

function loadDb() {
  // A damaged or inaccessible database must never be replaced with an empty one.
  if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return { users: {}, days: {} };
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

function getPuzzle(id) { return puzzles.find(p => p.id === id); }

function ensureDay(key) {
  if (!db.days[key]) {
    const ids = puzzles.map(p => p.id);
    const rotation = db.rotation || initialRotation(db.days, ids);
    const result = selectPuzzles(rotation, ids, key, DAILY_COUNT);
    db.rotation = result.rotation;
    db.days[key] = { puzzleIds: result.puzzleIds, players: {} };
    saveDb();
  }
  return db.days[key];
}

function normalizeAnswer(value) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function answerMatches(puzzle, answer) {
  const normalized = normalizeAnswer(answer);
  return puzzle.answers.some(a => normalizeAnswer(a) === normalized);
}

function sanitizeName(name) {
  return String(name || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

function ensurePlayer(userId, key) {
  const day = ensureDay(key);
  if (!day.players[userId]) {
    day.players[userId] = { currentIndex: 0, startedAt: null, totalScore: 0, completed: [], finishedAt: null };
  }
  return day.players[userId];
}

function publicPuzzle(puzzle, index) {
  return { id: puzzle.id, prompt: puzzle.prompt, number: index + 1, total: DAILY_COUNT };
}

function leaderboardFor(key) {
  const day = ensureDay(key);
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

function getState(userId) {
  const key = dayKey();
  const day = ensureDay(key);
  const player = ensurePlayer(userId, key);
  const user = db.users[userId];
  if (!user) return null;

  if (player.currentIndex >= DAILY_COUNT) {
    return { date: key, timeZone: APP_TIMEZONE, displayName: user.displayName, finished: true,
      totalScore: player.totalScore, completed: player.completed, leaderboard: leaderboardFor(key) };
  }

  if (!player.startedAt) {
    player.startedAt = new Date().toISOString();
    saveDb();
  }

  const puzzle = getPuzzle(day.puzzleIds[player.currentIndex]);
  return { date: key, timeZone: APP_TIMEZONE, displayName: user.displayName, finished: false,
    totalScore: player.totalScore, completed: player.completed, startedAt: player.startedAt,
    puzzle: publicPuzzle(puzzle, player.currentIndex), leaderboard: leaderboardFor(key) };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
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

function sendLeaderboard() {
  const key = dayKey();
  const payload = JSON.stringify({ date: key, leaderboard: leaderboardFor(key) });
  for (const res of sseClients) res.write(`event: leaderboard\ndata: ${payload}\n\n`);
}

function serveStatic(reqPath, res) {
  let rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, date: dayKey(), timeZone: APP_TIMEZONE, puzzlesPerDay: DAILY_COUNT });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const userId = String(url.searchParams.get('userId') || '');
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });
    return json(res, 200, getState(userId));
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    const key = dayKey();
    return json(res, 200, { date: key, leaderboard: leaderboardFor(key) });
  }

  if (req.method === 'POST' && url.pathname === '/api/register') {
    const body = await readJson(req);
    const requestedId = String(body.userId || '').trim();
    const displayName = sanitizeName(body.displayName);
    if (displayName.length < 2) return json(res, 400, { error: 'Please enter a name with at least 2 characters.' });

    let userId = requestedId;
    if (!userId || !db.users[userId]) {
      userId = crypto.randomUUID();
      db.users[userId] = { displayName, createdAt: new Date().toISOString() };
    } else db.users[userId].displayName = displayName;

    ensurePlayer(userId, dayKey());
    saveDb();
    const payload = { userId, state: getState(userId) };
    json(res, 200, payload);
    sendLeaderboard();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/answer') {
    const body = await readJson(req);
    const userId = String(body.userId || '');
    const answer = String(body.answer || '');
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });

    const key = dayKey();
    const day = ensureDay(key);
    const player = ensurePlayer(userId, key);
    if (player.currentIndex >= DAILY_COUNT) return json(res, 200, { correct: true, state: getState(userId) });
    if (!player.startedAt) player.startedAt = new Date().toISOString();
    const puzzle = getPuzzle(day.puzzleIds[player.currentIndex]);

    if (!answerMatches(puzzle, answer)) {
      saveDb();
      return json(res, 200, { correct: false, message: 'Not quite. Try again or give up.' });
    }

    const solvedAt = new Date();
    const elapsedMs = Math.max(0, solvedAt.getTime() - new Date(player.startedAt).getTime());
    const score = Math.max(MIN_SOLVED_SCORE, MAX_SCORE - Math.floor((elapsedMs / 1000) * POINTS_LOST_PER_SECOND));
    player.completed.push({ puzzleId: puzzle.id, status: 'solved', score, elapsedMs, completedAt: solvedAt.toISOString() });
    player.totalScore += score;
    player.currentIndex += 1;
    player.startedAt = player.currentIndex < DAILY_COUNT ? solvedAt.toISOString() : null;
    if (player.currentIndex >= DAILY_COUNT) player.finishedAt = solvedAt.toISOString();
    saveDb();
    const payload = { correct: true, earned: score, elapsedMs, state: getState(userId) };
    json(res, 200, payload);
    sendLeaderboard();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/give-up') {
    const body = await readJson(req);
    const userId = String(body.userId || '');
    if (!db.users[userId]) return json(res, 404, { error: 'Player not found.' });

    const key = dayKey();
    const day = ensureDay(key);
    const player = ensurePlayer(userId, key);
    if (player.currentIndex >= DAILY_COUNT) return json(res, 200, { state: getState(userId) });

    const puzzle = getPuzzle(day.puzzleIds[player.currentIndex]);
    const now = new Date();
    const elapsedMs = player.startedAt ? Math.max(0, now.getTime() - new Date(player.startedAt).getTime()) : 0;
    player.completed.push({ puzzleId: puzzle.id, status: 'gave-up', score: 0, elapsedMs, answer: puzzle.answers[0], completedAt: now.toISOString() });
    player.currentIndex += 1;
    player.startedAt = player.currentIndex < DAILY_COUNT ? now.toISOString() : null;
    if (player.currentIndex >= DAILY_COUNT) player.finishedAt = now.toISOString();
    saveDb();
    const payload = { answer: puzzle.answers[0], state: getState(userId) };
    json(res, 200, payload);
    sendLeaderboard();
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
