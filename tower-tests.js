const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const tower = require('./trivia-tower');

assert.equal(tower.puzzles.length, 100, 'Ship 100 different questions');
assert.ok(new Set(tower.puzzles.map(puzzle => puzzle.category)).size >= 10, 'Questions should cover varied subjects');
const shapes = tower.puzzles.find(puzzle => puzzle.id === 'polygon-sides');
const expected = ['Hendecagon', 'Tetradecagon', 'Pentadecagon', 'Heptadecagon', 'Octadecagon', 'Icosagon'];
const perfect = expected.map(label => shapes.items.find(item => item.label === label).id);
assert.deepEqual(tower.correctOrder(shapes), perfect, 'The screenshot example must have an accurate bottom-to-top answer');
assert.equal(tower.scoreOrder(shapes, perfect).score, 600);
assert.equal(tower.scoreOrder(shapes, [...perfect].reverse()).score, 0);
const partial = [...perfect];
[partial[0], partial[1]] = [partial[1], partial[0]];
assert.equal(tower.scoreOrder(shapes, partial).score, 400, 'Correct upper placements still count when lower ones are wrong');
assert.deepEqual(tower.scoreOrder(shapes, partial).placements.map(item => item.correct), [false, false, true, true, true, true]);
assert.throws(() => tower.scoreOrder(shapes, Array(6).fill(perfect[0])), /exactly once/);

let days = {};
const used = new Set();
for (let index = 0; index < 100; index++) {
  const date = new Date(Date.UTC(2030, 0, index + 1)).toISOString().slice(0, 10);
  const day = tower.ensureTowerDay(days, date);
  assert.ok(!used.has(day.puzzleId), 'A published trivia question must never repeat');
  used.add(day.puzzleId);
  assert.equal(new Set(day.order).size, 6);
  assert.deepEqual(tower.ensureTowerDay(days, date), day, 'All players share a fixed daily selection and shuffle');
  days = JSON.parse(JSON.stringify(days)); // Simulate durable saves and restarts.
}
assert.equal(used.size, 100);
assert.equal(tower.ensureTowerDay(days, '2031-01-01').puzzleId, null, 'Exhaustion must not recycle questions');
assert.equal(tower.ensureTowerDay(days, '2031-01-02').puzzleId, null);
const extra = { ...shapes, id: 'new-question' };
assert.equal(tower.ensureTowerDay(days, '2031-01-03', [...tower.puzzles, extra]).puzzleId, extra.id, 'New questions join without resetting history');
for (const puzzle of tower.puzzles) {
  const day = tower.ensureTowerDay({}, '2030-01-01', [puzzle]);
  const publicPuzzle = tower.publicTowerPuzzle(puzzle, day);
  for (const item of publicPuzzle.items) {
    assert.deepEqual(Object.keys(item).sort(), ['color', 'id', 'label'], 'Public items must not leak values or ranks');
    assert.match(item.id, /^[a-f0-9]{12}$/, 'Item IDs must not encode answer positions');
  }
  assert.equal(publicPuzzle.sources, undefined, 'Sources are revealed only after the single submission');
  assert.notDeepEqual(day.order, tower.correctOrder(puzzle), 'A fresh tower must not start already solved');
}

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'America/Regina', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

async function freePort() {
  const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve)); return port;
}

async function launch(dataDir, port) {
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname, env: { ...process.env, RAILWAY_VOLUME_MOUNT_PATH: dataDir, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let errors = ''; child.stderr.on('data', chunk => errors += chunk);
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(errors);
    try { if ((await fetch(`${base}/api/health`)).ok) return { child, base }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill(); throw new Error(`Tower test server did not start: ${errors}`);
}

async function stop(child) { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } }

async function request(base, route, body, status = 200) {
  const response = await fetch(`${base}${route}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  assert.equal(response.status, status, route); return response.json();
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yappers-tower-test-'));
  const port = await freePort(); const date = today();
  fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify({
    users: {}, days: {}, chainDays: {}, chainlyDays: {},
    towerDays: { [date]: { puzzleId: shapes.id, order: [...perfect].reverse(), players: {} } }
  }));
  let running;
  try {
    running = await launch(dataDir, port); let base = running.base;
    const html = await (await fetch(`${base}/tower/index.html`)).text();
    assert.match(html, /Correct answers/); assert.match(html, /playerTower/);
    assert.match(await (await fetch(base)).text(), /Play Trivia Tower/);
    assert.equal((await fetch(`${base}/trivia-tower-puzzles.js`)).status, 404, 'Answer bank must not be served');
    await request(base, '/api/tower/state?userId=missing', undefined, 404);
    const alice = await request(base, '/api/register', { displayName: 'Alice' });
    const bob = await request(base, '/api/register', { displayName: 'Bob' });
    assert.equal(alice.menu.games.find(game => game.id === 'tower').completed, 0);
    const initial = await request(base, `/api/tower/state?userId=${alice.userId}`);
    const second = await request(base, `/api/tower/state?userId=${bob.userId}`);
    assert.equal(initial.result, null);
    assert.equal(initial.finished, false);
    assert.deepEqual(initial.puzzle, second.puzzle, 'The daily question and item colors must be identical for all players');
    const submission = { userId: alice.userId, date, puzzleId: shapes.id, order: partial, score: 999999 };
    await request(base, '/api/tower/submit', { ...submission, date: '2000-01-01' }, 409);
    await request(base, '/api/tower/submit', { ...submission, puzzleId: 'old-question' }, 409);
    for (const order of [null, [], perfect.slice(1), [...perfect, 'extra'], Array(6).fill(perfect[0]), [...perfect.slice(0, 5), 'unknown']]) {
      await request(base, '/api/tower/submit', { ...submission, order }, 400);
    }
    assert.equal((await request(base, `/api/tower/state?userId=${alice.userId}`)).finished, false, 'Invalid submissions must not use the daily attempt');

    const eventResponse = await fetch(`${base}/api/events`); const reader = eventResponse.body.getReader(); await reader.read();
    const result = await request(base, '/api/tower/submit', submission);
    assert.equal(result.finished, true); assert.equal(result.result.score, 400, 'The server computes the score, ignoring client points');
    assert.equal(result.result.correctPlacements, 4);
    assert.deepEqual(result.result.correctOrder, perfect);
    assert.ok(result.result.facts.every(fact => fact.valueLabel)); assert.ok(result.result.sources.length);
    const live = new TextDecoder().decode((await reader.read()).value);
    assert.match(live, /"game":"tower"/); assert.match(live, /"score":400/); await reader.cancel();

    const duplicate = await request(base, '/api/tower/submit', { ...submission, order: perfect });
    assert.equal(duplicate.result.score, 400, 'A locked result cannot be replaced by a better submission');
    const bobResult = await request(base, '/api/tower/submit', { ...submission, userId: bob.userId });
    assert.deepEqual(bobResult.leaderboard.map(row => row.rank), [1, 1], 'Equal tower scores share a rank');
    const menu = await request(base, `/api/menu?userId=${alice.userId}`);
    assert.equal(menu.games.find(game => game.id === 'tower').score, 400);
    const rebus = await request(base, `/api/state?game=rebus&userId=${alice.userId}`);
    assert.equal(rebus.totalScore, 0, 'Tower scores must not change Rebus progress');

    await stop(running.child); running = await launch(dataDir, port); base = running.base;
    const restored = await request(base, `/api/tower/state?userId=${alice.userId}`);
    assert.equal(restored.result.score, 400); assert.equal(restored.puzzle.id, shapes.id);
    assert.deepEqual(restored.result.submittedOrder, partial, 'The exact locked tower must survive a restart');
    const fresh = await request(base, '/api/register', { displayName: 'Perfect player' });
    const best = await request(base, '/api/tower/submit', { ...submission, userId: fresh.userId, order: perfect });
    assert.equal(best.result.score, 600);
    assert.deepEqual(best.leaderboard.map(row => row.rank), [1, 2, 2]);

    await stop(running.child);
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    saved.towerDays = {};
    for (const [index, puzzle] of tower.puzzles.entries()) {
      saved.towerDays[`used-${index}`] = { puzzleId: puzzle.id, order: puzzle.items.map(item => item.id), players: {} };
    }
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port);
    const exhausted = await request(running.base, `/api/tower/state?userId=${alice.userId}`);
    assert.equal(exhausted.exhausted, true); assert.equal(exhausted.puzzle, null);
    assert.equal(exhausted.result, null); assert.equal(exhausted.leaderboard.length, 0);
    console.log('Passed: 100 unique sourced towers, no repeats through exhaustion and restart, daily consistency, private answers, exact-placement scoring, one submission, invalid/stale requests, tied ranks, live updates, and persistence.');
  } finally {
    if (running) await stop(running.child);
    const resolved = fs.realpathSync(dataDir);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('yappers-tower-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
