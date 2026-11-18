const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const tower = require('./trivia-tower');

assert.equal(tower.puzzles.length, 300, 'Keep the original 100 and add 200 different questions');
assert.equal(require('./trivia-tower-extra-puzzles').length, 200);
const labelSets = new Set();
for (const puzzle of tower.puzzles) {
  const key = puzzle.items.map(item => item.label.toLowerCase()).sort().join('|');
  assert.ok(!labelSets.has(key), `${puzzle.id} must use a distinct six-item set`);
  labelSets.add(key);
}
const counts = Object.fromEntries(Object.keys(tower.DIFFICULTIES).map(difficulty => [difficulty, tower.puzzles.filter(puzzle => puzzle.difficulty === difficulty).length]));
for (const count of Object.values(counts)) assert.ok(count >= 30, 'Every level needs a substantial question pool');
for (const [id, difficulty] of Object.entries({
  'calendar-months': 'easy', 'animal-legs': 'easy', 'small-polygons': 'easy', 'cubes-mixed': 'easy',
  'atomic-numbers': 'medium', 'country-area': 'medium', 'rainbow-wavelength': 'medium',
  'chess-piece-mobility': 'medium', 'solid-face-counts': 'medium',
  'moon-sizes': 'hard', 'binary-storage': 'hard', 'saturn-moon-densities': 'hard', 'network-port-numbers': 'hard'
})) assert.equal(tower.puzzles.find(puzzle => puzzle.id === id).difficulty, difficulty, `${id} needs the reviewed difficulty`);
for (const puzzle of tower.puzzles) {
  assert.match(puzzle.instructions, /^Put /);
  assert.match(puzzle.instructions, /bottom/);
  assert.ok(puzzle.instructions.length < 180, `${puzzle.id} needs concise directions`);
}
assert.equal(tower.puzzles.find(puzzle => puzzle.id === 'country-area').instructions,
  'Put the country with the smallest area at the bottom and the largest area at the top.');
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
assert.deepEqual(Array.from({ length: 7 }, (_, count) => tower.scoreForPlacements(count, 800)), [0,133,267,400,533,667,800]);
for (const maxScore of [600, 800, 1200]) {
  for (const order of [perfect, partial, [...perfect].reverse()]) {
    const result = tower.scoreOrder(shapes, order, maxScore);
    assert.equal(result.score, Math.round(result.correctPlacements * maxScore / 6));
    assert.equal(result.placements.reduce((sum, placement) => sum + placement.points, 0), result.score);
    assert.ok(result.placements.every(placement => Number.isInteger(placement.points) && (placement.correct || placement.points === 0)));
  }
}

let days = {};
const used = new Set();
for (let index = 0; index < Math.max(...Object.values(counts)); index++) {
  const date = new Date(Date.UTC(2030, 0, index + 1)).toISOString().slice(0, 10);
  for (const difficulty of Object.keys(tower.DIFFICULTIES)) {
    const day = tower.ensureTowerDay(days, date, tower.puzzles, difficulty);
    if (index >= counts[difficulty]) { assert.equal(day.puzzleId, null, 'An exhausted level cannot borrow or repeat another level’s questions'); continue; }
    assert.ok(!used.has(day.puzzleId), 'A published trivia question must never repeat at any level');
    used.add(day.puzzleId);
    assert.equal(tower.puzzles.find(puzzle => puzzle.id === day.puzzleId).difficulty, difficulty);
    assert.equal(new Set(day.order).size, 6);
    assert.equal(day.maxScore, tower.DIFFICULTIES[difficulty].maxScore);
    assert.deepEqual(tower.ensureTowerDay(days, date, tower.puzzles, difficulty), day, 'All players share a fixed daily selection and shuffle');
  }
  days = JSON.parse(JSON.stringify(days)); // Simulate durable saves and restarts.
}
assert.equal(used.size, 300);
assert.equal(tower.ensureTowerDay(days, '2031-01-01').puzzleId, null, 'Exhaustion must not recycle questions');
assert.equal(tower.ensureTowerDay(days, '2031-01-02').puzzleId, null);
const extra = { ...shapes, id: 'new-question', difficulty: 'medium' };
assert.equal(tower.ensureTowerDay(days, '2031-01-03', [...tower.puzzles, extra]).puzzleId, extra.id, 'New questions join without resetting history');
const rebalanceDays = { '2032-01-01:easy': { puzzleId: shapes.id, order: perfect, players: {} } };
const rebalanced = tower.ensureTowerDay(rebalanceDays, '2032-01-01', tower.puzzles, 'easy');
assert.equal(tower.puzzles.find(puzzle => puzzle.id === rebalanced.puzzleId).difficulty, 'easy');
assert.ok(Object.values(rebalanceDays).some(day => day.puzzleId === shapes.id && day.retiredReason === 'difficulty-review'), 'A replaced unplayed question remains reserved');
const submittedDay = { puzzleId: shapes.id, order: perfect, players: { existing: { order: partial } } };
assert.equal(tower.ensureTowerDay({ '2032-01-01:easy': submittedDay }, '2032-01-01', tower.puzzles, 'easy'), submittedDay, 'Submitted days keep the same question for everyone');
for (const puzzle of tower.puzzles) {
  const day = tower.ensureTowerDay({}, '2030-01-01', [puzzle], puzzle.difficulty);
  const publicPuzzle = tower.publicTowerPuzzle(puzzle, day);
  for (const item of publicPuzzle.items) {
    assert.deepEqual(Object.keys(item).sort(), ['color', 'id', 'label'], 'Public items must not leak values or ranks');
    assert.match(item.id, /^[a-f0-9]{12}$/, 'Item IDs must not encode answer positions');
  }
  assert.equal(publicPuzzle.sources, undefined, 'Sources are revealed only after the single submission');
  assert.equal(publicPuzzle.title, undefined, 'Decorative titles are not part of the public question');
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
  // Use a reviewed Medium question for a previously published Medium day.
  const shapes = tower.puzzles.find(puzzle => puzzle.id === 'country-area');
  const perfect = tower.correctOrder(shapes);
  const partial = [...perfect]; [partial[0], partial[1]] = [partial[1], partial[0]];
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
    assert.match(html, /<dialog id="rulesDialog"/); assert.match(html, /difficultyPicker/);
    assert.match(await (await fetch(base)).text(), /Play Trivia Tower/);
    assert.equal((await fetch(`${base}/trivia-tower-puzzles.js`)).status, 404, 'Answer bank must not be served');
    assert.equal((await fetch(`${base}/trivia-tower-extra-puzzles.js`)).status, 404);
    await request(base, '/api/tower/state?userId=missing', undefined, 404);
    const alice = await request(base, '/api/register', { displayName: 'Alice' });
    const bob = await request(base, '/api/register', { displayName: 'Bob' });
    assert.equal(alice.menu.games.find(game => game.id === 'tower').completed, 0);
    const initial = await request(base, `/api/tower/state?userId=${alice.userId}`);
    const second = await request(base, `/api/tower/state?userId=${bob.userId}`);
    assert.equal(initial.result, null);
    assert.equal(initial.finished, false);
    assert.equal(initial.difficulty, 'medium');
    assert.equal(initial.maxScore, 800, 'Existing Medium days use the requested maximum');
    assert.equal(initial.difficulties.length, 3);
    for (const invalid of ['impossible', '__proto__', 'constructor']) {
      await request(base, `/api/tower/state?userId=${alice.userId}&difficulty=${invalid}`, undefined, 400);
      await request(base, `/api/tower/leaderboard?difficulty=${invalid}`, undefined, 400);
      await request(base, '/api/tower/submit', { userId: alice.userId, difficulty: invalid }, 400);
    }
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
    assert.equal(result.finished, true); assert.equal(result.result.score, 533, 'The server computes a rounded score, ignoring client points');
    assert.equal(result.result.correctPlacements, 4);
    assert.deepEqual(result.result.correctOrder, perfect);
    assert.ok(result.result.facts.every(fact => fact.valueLabel)); assert.ok(result.result.sources.length);
    const live = new TextDecoder().decode((await reader.read()).value);
    assert.match(live, /"game":"tower"/); assert.match(live, /"score":533/); await reader.cancel();

    const duplicate = await request(base, '/api/tower/submit', { ...submission, order: perfect });
    assert.equal(duplicate.result.score, 533, 'A locked result cannot be replaced by a better submission');
    const bobResult = await request(base, '/api/tower/submit', { ...submission, userId: bob.userId });
    assert.deepEqual(bobResult.leaderboard.map(row => row.rank), [1, 1], 'Equal tower scores share a rank');
    const menu = await request(base, `/api/menu?userId=${alice.userId}`);
    assert.equal(menu.games.find(game => game.id === 'tower').score, 533);
    const rebus = await request(base, `/api/state?game=rebus&userId=${alice.userId}`);
    assert.equal(rebus.totalScore, 0, 'Tower scores must not change Rebus progress');

    await stop(running.child);
    const oldScoring = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    const oldDay = oldScoring.towerDays[date];
    oldDay.pointsPerPlacement = 150; delete oldDay.maxScore; delete oldDay.scoringVersion;
    for (const player of Object.values(oldDay.players)) {
      player.pointsPerPlacement = 150; player.score = player.correctPlacements * 150; delete player.maxScore;
    }
    oldScoring.towerDays['1999-01-01'] = JSON.parse(JSON.stringify(oldDay));
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(oldScoring));
    running = await launch(dataDir, port); base = running.base;
    const restored = await request(base, `/api/tower/state?userId=${alice.userId}`);
    assert.equal(restored.result.score, 533); assert.equal(restored.puzzle.id, shapes.id);
    assert.equal(restored.maxScore, 800);
    assert.ok(restored.leaderboard.every(row => row.score === 533), 'Existing daily leaderboard scores migrate along with results');
    assert.deepEqual(restored.result.submittedOrder, partial, 'The exact locked tower must survive a restart');
    const fresh = await request(base, '/api/register', { displayName: 'Perfect player' });
    const best = await request(base, '/api/tower/submit', { ...submission, userId: fresh.userId, order: perfect });
    assert.equal(best.result.score, 800);
    assert.deepEqual(best.leaderboard.map(row => row.rank), [1, 2, 2]);

    for (const difficulty of ['easy', 'hard']) {
      const level = await request(base, `/api/tower/state?userId=${alice.userId}&difficulty=${difficulty}`);
      const shared = await request(base, `/api/tower/state?userId=${bob.userId}&difficulty=${difficulty}`);
      assert.deepEqual(level.puzzle, shared.puzzle);
      assert.equal(level.finished, false, 'Each difficulty has its own daily attempt');
      const puzzle = tower.puzzles.find(question => question.id === level.puzzle.id);
      assert.equal(puzzle.difficulty, difficulty);
      assert.equal(level.maxScore, tower.DIFFICULTIES[difficulty].maxScore);
      const body = { userId: alice.userId, date, difficulty, puzzleId: puzzle.id, order: tower.correctOrder(puzzle), pointsPerPlacement: 99999, maxScore: 99999 };
      await request(base, '/api/tower/submit', { ...body, puzzleId: shapes.id }, 409);
      const scored = await request(base, '/api/tower/submit', body);
      const max = difficulty === 'easy' ? 600 : 1200;
      assert.equal(scored.result.score, max, 'Difficulty points are chosen by the server');
      assert.equal(scored.maxScore, max);
      assert.equal(scored.leaderboard.length, 1, 'Leaderboards are separate for each level');
      assert.equal((await request(base, '/api/tower/submit', { ...body, order: [...body.order].reverse() })).result.score, max);
    }
    const completedMenu = (await request(base, `/api/menu?userId=${alice.userId}`)).games.find(game => game.id === 'tower');
    assert.equal(completedMenu.completed, 3); assert.equal(completedMenu.total, 3);
    assert.equal(completedMenu.finished, true); assert.equal(completedMenu.score, 2333);
    assert.equal((await request(base, `/api/tower/state?userId=${alice.userId}`)).result.score, 533, 'Other levels cannot overwrite a saved result');
    await stop(running.child); running = await launch(dataDir, port); base = running.base;
    assert.equal((await request(base, `/api/tower/state?userId=${alice.userId}&difficulty=hard`)).result.score, 1200);

    await stop(running.child);
    let saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    saved.towerDays['2000-01-01'] = saved.towerDays[date];
    delete saved.towerDays[date];
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port); base = running.base;
    const newMedium = await request(base, `/api/tower/state?userId=${alice.userId}&difficulty=medium`);
    assert.equal(newMedium.maxScore, 800);
    const mediumPuzzle = tower.puzzles.find(puzzle => puzzle.id === newMedium.puzzle.id);
    const mediumResult = await request(base, '/api/tower/submit', {
      userId: alice.userId, date, difficulty: 'medium', puzzleId: mediumPuzzle.id, order: tower.correctOrder(mediumPuzzle)
    });
    assert.equal(mediumResult.result.score, 800, 'A perfect Medium tower is worth exactly 800');
    await stop(running.child);
    saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    assert.equal(saved.towerDays['2000-01-01'].players[alice.userId].score, 533);
    assert.equal(saved.towerDays['1999-01-01'].players[alice.userId].score, 600, 'Earlier dates keep their historical scores');
    saved.towerDays = {};
    for (const [index, puzzle] of tower.puzzles.entries()) {
      saved.towerDays[`used-${index}`] = { puzzleId: puzzle.id, order: puzzle.items.map(item => item.id), players: {} };
    }
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port);
    const exhausted = await request(running.base, `/api/tower/state?userId=${alice.userId}`);
    assert.equal(exhausted.exhausted, true); assert.equal(exhausted.puzzle, null);
    assert.equal(exhausted.result, null); assert.equal(exhausted.leaderboard.length, 0);
    console.log('Passed: 300 reviewed questions, subject-specific directions, meaningful difficulty levels, 600/800/1200 scoring, rounded reveal totals, daily score migration, no repeats, private answers, immutable attempts, tied ranks, live updates, and restart persistence.');
  } finally {
    if (running) await stop(running.child);
    const resolved = fs.realpathSync(dataDir);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('yappers-tower-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
