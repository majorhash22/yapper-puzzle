const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const tower = require('./trivia-tower');

assert.equal(tower.puzzles.length, 340, 'The rebalanced bank expands to 340 active questions');
assert.equal(require('./trivia-tower-extra-puzzles').length, 200);
const refreshPack = require('./trivia-tower-refresh');
const approachablePack = require('./trivia-tower-approachable');
assert.equal(approachablePack.length, 120);
assert.equal(refreshPack.puzzles.length, 175); assert.equal(tower.retiredPuzzles.length, 255);
const previousBank = [...require('./trivia-tower-puzzles').filter(puzzle => !refreshPack.retiredIds.includes(puzzle.id)), ...refreshPack.puzzles];
for (const previous of previousBank) {
  const current = tower.getPuzzle(previous.id);
  const expectedDifficulty = previous.difficulty === 'medium' ? 'hard' : previous.difficulty;
  assert.deepEqual({ ...current, items: current.items.map(({ id, ...item }) => item), contentKey: undefined },
    { ...previous, difficulty: expectedDifficulty, contentKey: undefined }, `${previous.id} must preserve its wording, facts, sources, and stable identity`);
  assert.equal(tower.puzzles.some(puzzle => puzzle.id === previous.id), previous.difficulty !== 'hard');
}
assert.ok(approachablePack.every(puzzle => puzzle.difficulty === 'medium' && !previousBank.some(previous => previous.id === puzzle.id)), 'Medium consists entirely of newly authored questions');
for (const id of refreshPack.retiredIds) {
  assert.ok(!tower.puzzles.some(puzzle => puzzle.id === id), `${id} must leave the playable pool`);
  assert.equal(tower.getPuzzle(id).id, id, 'Retired questions remain readable for saved-game compatibility');
}
const labelSets = new Set();
for (const puzzle of tower.puzzles) {
  const key = tower.questionKey(puzzle);
  assert.ok(!labelSets.has(key), `${puzzle.id} must use a distinct six-item set`);
  labelSets.add(key);
}
const counts = Object.fromEntries(Object.keys(tower.DIFFICULTIES).map(difficulty => [difficulty, tower.puzzles.filter(puzzle => puzzle.difficulty === difficulty).length]));
assert.deepEqual(counts, { easy: 60, medium: 120, hard: 160 });
for (const count of Object.values(counts)) assert.ok(count >= 30, 'Every level needs a substantial question pool');
for (const [id, difficulty] of Object.entries({
  'wildlife-size': 'easy', 'animal-legs': 'easy', 'lion-king-story': 'easy', 'frozen-story': 'easy',
  'food-through-the-body': 'medium', 'disney-across-generations': 'medium', 'poker-hand-strengths': 'medium',
  'spicy-peppers': 'hard', 'country-area': 'hard', 'minecraft-mob-health': 'hard'
})) assert.equal(tower.puzzles.find(puzzle => puzzle.id === id).difficulty, difficulty, `${id} needs the reviewed difficulty`);
for (const puzzle of tower.puzzles) {
  assert.match(puzzle.instructions, /^Put /);
  assert.match(puzzle.instructions, /bottom/);
  assert.ok(puzzle.instructions.length < 180, `${puzzle.id} needs concise directions`);
}
assert.equal(tower.puzzles.find(puzzle => puzzle.id === 'country-area').instructions,
  'Put the country with the smallest area at the bottom and the largest area at the top.');
assert.ok(new Set(tower.puzzles.map(puzzle => puzzle.category)).size >= 10, 'Questions should cover varied subjects');
const shapes = tower.getPuzzle('famous-ships-lengths');
const expected = ['Cutty Sark', 'Bismarck', 'RMS Titanic', 'RMS Queen Mary', 'Queen Mary 2', 'Seawise Giant'];
const perfect = expected.map(label => shapes.items.find(item => item.label === label).id);
assert.deepEqual(tower.correctOrder(shapes), perfect, 'The ship comparison must have an accurate bottom-to-top answer');
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
assert.equal(used.size, tower.puzzles.length);
assert.equal(tower.ensureTowerDay(days, '2031-01-01').puzzleId, null, 'Exhaustion must not recycle questions');
assert.equal(tower.ensureTowerDay(days, '2031-01-02').puzzleId, null);
const extra = { ...shapes, id: 'new-question', difficulty: 'medium' };
assert.equal(tower.ensureTowerDay(days, '2031-01-03', [...tower.puzzles, extra]).puzzleId, extra.id, 'New questions join without resetting history');
assert.equal(tower.ensureTowerDay(days, '2031-01-04', [{ ...extra, id: 'renamed-question' }]).puzzleId, null,
  'Changing a used question ID cannot make its content available again');
const movedPuzzle = tower.getPuzzle('country-area');
const movedDays = { '2026-11-01': { puzzleId: movedPuzzle.id, players: {} } };
assert.equal(tower.ensureTowerDay(movedDays, '2031-02-01', [movedPuzzle], 'hard').puzzleId, null,
  'A question shown at the old Medium level stays unavailable at Hard');
assert.equal(movedDays['2026-11-01'].contentKey, tower.questionKey(movedPuzzle), 'Legacy reservations acquire durable content identity');
const alias = { ...shapes, id: 'edited-directions', difficulty: 'medium', instructions: 'Different wording',
  items: [...shapes.items].reverse().map(item => ({ ...item, label: `  ${item.label.toUpperCase().replace(/’/g, "'")}!!!  ` })) };
assert.equal(tower.questionKey(alias), tower.questionKey(shapes), 'Content identity ignores item order, case, punctuation, and instructions');
assert.equal(tower.questionKey({ items: [{ label: 'Pokémon' }] }), tower.questionKey({ items: [{ label: 'POKEMON' }] }));
assert.equal(tower.questionKey({ items: [{ label: 'Spider-Man' }] }), tower.questionKey({ items: [{ label: 'Spider Man' }] }));
assert.equal(tower.questionKey({ items: [{ label: 'O’Neal' }] }), tower.questionKey({ items: [{ label: 'ONeal' }] }));
assert.equal(tower.ensureTowerDay({ 'old:hard': { puzzleId: shapes.id, players: {} } }, '2031-03-01', [alias]).puzzleId, null,
  'Legacy history without content keys still blocks renamed archived content');
const unknownHistory = JSON.parse(JSON.stringify({ 'old:medium': { puzzleId: 'no-longer-in-any-bank', contentKey: tower.questionKey(alias), players: {} } }));
assert.equal(tower.ensureTowerDay(unknownHistory, '2031-04-01', [alias]).puzzleId, null,
  'Persisted content identity prevents repeats even if a historical ID is absent from every bank');
const rebalanceDays = { '2032-01-01:easy': { puzzleId: shapes.id, order: perfect, players: {} } };
const rebalanced = tower.ensureTowerDay(rebalanceDays, '2032-01-01', tower.puzzles, 'easy');
assert.equal(tower.puzzles.find(puzzle => puzzle.id === rebalanced.puzzleId).difficulty, 'easy');
assert.ok(Object.values(rebalanceDays).some(day => day.puzzleId === shapes.id && day.retiredReason === 'difficulty-review'), 'A replaced unplayed question remains reserved');
const submittedDay = { puzzleId: shapes.id, order: perfect, players: { existing: { order: partial } } };
assert.equal(tower.ensureTowerDay({ '2032-01-01:easy': submittedDay }, '2032-01-01', tower.puzzles, 'easy'), submittedDay, 'Submitted days keep the same question for everyone');
const obsoleteDays = { '2032-01-01:hard': { puzzleId: shapes.id, order: perfect, players: {} } };
const updatedHard = tower.ensureTowerDay(obsoleteDays, '2032-01-01', tower.puzzles, 'hard');
assert.equal(tower.getPuzzle(updatedHard.puzzleId).difficulty, 'hard', 'Unsubmitted retired Hard questions receive the newly calibrated difficulty');
assert.notEqual(updatedHard.puzzleId, shapes.id);
assert.ok(Object.values(obsoleteDays).some(day => day.puzzleId === shapes.id && day.retiredReason === 'difficulty-review'));
const oldMediumDays = { '2032-01-01': { puzzleId: movedPuzzle.id, order: tower.correctOrder(movedPuzzle), players: {} } };
assert.equal(tower.getPuzzle(tower.ensureTowerDay(oldMediumDays, '2032-01-01').puzzleId).difficulty, 'medium');
assert.equal(tower.ensureTowerDay(oldMediumDays, '2032-01-01', [movedPuzzle], 'hard').puzzleId, null,
  'Replacing an unanswered Medium question reserves it before Hard selection on the same day');
for (const puzzle of tower.puzzles) {
  const day = tower.ensureTowerDay({}, '2030-01-01', [puzzle], puzzle.difficulty);
  assert.equal(day.contentKey, tower.questionKey(puzzle), 'New selections persist their content identity');
  const publicPuzzle = tower.publicTowerPuzzle(puzzle, day);
  for (const item of publicPuzzle.items) {
    assert.deepEqual(Object.keys(item).sort(), ['color', 'id', 'label'], 'Public items must not leak values or ranks');
    assert.match(item.id, /^[a-f0-9]{12}$/, 'Item IDs must not encode answer positions');
  }
  assert.equal(publicPuzzle.sources, undefined, 'Sources are revealed only after the single submission');
  assert.equal(publicPuzzle.title, undefined, 'Decorative titles are not part of the public question');
  assert.notDeepEqual(day.order, tower.correctOrder(puzzle), 'A fresh tower must not start already solved');
}

// The content refresh resets only the explicitly authorized date, once. Old
// question reservations and every earlier date stay intact.
const refreshDate = tower.CONTENT_REFRESH.date;
const retiredQuestion = tower.getPuzzle('calendar-months');
const retiredOrder = tower.correctOrder(retiredQuestion);
const savedDay = (puzzleId, players = {}) => ({ puzzleId, contentKey: tower.questionKey(tower.getPuzzle(puzzleId)), order: tower.correctOrder(tower.getPuzzle(puzzleId)), players });
const historical = savedDay('calendar-months', { alice: { order: retiredOrder, score: 600, correctPlacements: 6 } });
const resetDb = {
  users: { alice: { displayName: 'Alice' }, bob: { displayName: 'Bob' } },
  days: { [refreshDate]: { players: { alice: { totalScore: 3000 } } } },
  towerDays: {
    '2026-11-17': historical,
    [refreshDate]: savedDay('atomic-numbers', { alice: { score: 800 } }),
    [`${refreshDate}:easy`]: savedDay('calendar-months', { alice: { score: 600 }, bob: { score: 400 } }),
    [`${refreshDate}:hard`]: savedDay('polygon-sides', { bob: { score: 1200 } }),
    [`${refreshDate}:retired:earlier-question`]: savedDay('roman-numerals', { alice: { score: 600 } })
  }
};
const beforeOtherData = JSON.stringify({ users: resetDb.users, days: resetDb.days, historical });
assert.equal(tower.refreshDailyTowers(resetDb, '2026-11-19'), false, 'A later day cannot trigger the dated reset');
assert.equal(tower.refreshDailyTowers(resetDb, refreshDate), true);
assert.equal(resetDb.towerContentRefreshes[tower.CONTENT_REFRESH.id].resetPlayerCount, 2);
assert.equal(JSON.stringify({ users: resetDb.users, days: resetDb.days, historical: resetDb.towerDays['2026-11-17'] }), beforeOtherData);
for (const [key, day] of Object.entries(resetDb.towerDays)) {
  if (key === refreshDate || key.startsWith(`${refreshDate}:`)) assert.deepEqual(day.players, {}, 'Every current-day score and attempt is cleared, including retired selections');
}
for (const [difficulty, id] of Object.entries(tower.CONTENT_REFRESH.showcase)) {
  const day = resetDb.towerDays[`${refreshDate}:${difficulty}`];
  const stillEligible = tower.puzzles.some(puzzle => puzzle.id === id && puzzle.difficulty === difficulty);
  if (stillEligible) assert.equal(day.puzzleId, id);
  assert.equal(tower.getPuzzle(day.puzzleId).difficulty, difficulty, 'Historical refreshes use the currently active difficulty calibration');
}
for (const id of ['calendar-months','atomic-numbers','polygon-sides','roman-numerals']) {
  assert.ok(Object.values(resetDb.towerDays).some(day => day.puzzleId === id), 'Removed selections stay reserved against future reuse');
}
resetDb.towerDays[`${refreshDate}:easy`].players.alice = { score: 400 };
const restartedDb = JSON.parse(JSON.stringify(resetDb));
assert.equal(tower.refreshDailyTowers(restartedDb, refreshDate), false);
assert.equal(restartedDb.towerDays[`${refreshDate}:easy`].players.alice.score, 400, 'A restart cannot wipe points earned after the reset');
const usedShowcaseDb = { towerDays: { '2026-11-17': savedDay('wildlife-size') } };
tower.refreshDailyTowers(usedShowcaseDb, refreshDate);
assert.notEqual(usedShowcaseDb.towerDays[`${refreshDate}:easy`].puzzleId, 'wildlife-size', 'A refresh cannot recycle an already used showcase question');

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

async function liveScore(reader, score) {
  const decoder = new TextDecoder(); let content = '';
  const timeout = setTimeout(() => reader.cancel(), 5000);
  try {
    while (!content.includes(`"score":${score}`)) {
      const { value, done } = await reader.read();
      if (done) break;
      content += decoder.decode(value, { stream: true });
    }
    assert.match(content, /"game":"tower"/);
    assert.ok(content.includes(`"score":${score}`), 'The live stream must deliver the new combined score');
  } finally { clearTimeout(timeout); await reader.cancel(); }
}

async function main() {
  const mediumPuzzle = tower.puzzles.find(puzzle => puzzle.id === 'food-through-the-body');
  const easyPuzzle = tower.puzzles.find(puzzle => puzzle.id === 'lion-king-story');
  const hardPuzzle = tower.puzzles.find(puzzle => puzzle.id === 'country-area');
  const fixtures = { easy: easyPuzzle, medium: mediumPuzzle, hard: hardPuzzle };
  const mediumPerfect = tower.correctOrder(mediumPuzzle);
  const mediumPartial = [...mediumPerfect]; [mediumPartial[0], mediumPartial[1]] = [mediumPartial[1], mediumPartial[0]];
  const easyPartial = tower.correctOrder(easyPuzzle); [easyPartial[0], easyPartial[1]] = [easyPartial[1], easyPartial[0]];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yappers-tower-test-'));
  const port = await freePort(); const date = today();
  const published = puzzle => ({ puzzleId: puzzle.id, order: [...tower.correctOrder(puzzle)].reverse(), players: {} });
  fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify({
    users: {}, days: {}, chainDays: {}, chainlyDays: {},
    towerContentRefreshes: { [tower.CONTENT_REFRESH.id]: { date: tower.CONTENT_REFRESH.date } },
    towerDays: { [date]: published(mediumPuzzle), [`${date}:easy`]: published(easyPuzzle), [`${date}:hard`]: published(hardPuzzle) }
  }));
  let running;
  try {
    running = await launch(dataDir, port); let base = running.base;
    const body = (userId, difficulty, order = tower.correctOrder(fixtures[difficulty])) => ({
      userId, difficulty, date, puzzleId: fixtures[difficulty].id, order, score: 999999, totalScore: 999999
    });
    const state = (userId, difficulty) => request(base, `/api/tower/state?userId=${userId}${difficulty ? `&difficulty=${difficulty}` : ''}`);
    const html = await (await fetch(`${base}/tower/index.html`)).text();
    assert.match(html, /Correct answers/); assert.match(html, /playerTower/);
    assert.match(html, /<dialog id="rulesDialog"/); assert.match(html, /difficultyPicker/);
    assert.match(html, /dailyScore/); assert.match(html, /nextLevelButton/);
    assert.match(await (await fetch(base)).text(), /Play Trivia Tower/);
    for (const file of ['trivia-tower-puzzles.js', 'trivia-tower-extra-puzzles.js', 'trivia-tower-content.js', 'trivia-tower-refresh.js', 'trivia-tower-approachable.js']) {
      assert.equal((await fetch(`${base}/${file}`)).status, 404, 'The answer bank stays server-side');
    }
    await request(base, '/api/tower/state?userId=missing', undefined, 404);
    const alice = await request(base, '/api/register', { displayName: 'Alice' });
    const bob = await request(base, '/api/register', { displayName: 'Bob' });
    assert.equal(alice.menu.games.find(game => game.id === 'tower').completed, 0);
    const initial = await state(alice.userId);
    assert.equal(initial.difficulty, 'easy'); assert.equal(initial.finished, false);
    assert.equal(initial.result, null); assert.equal(initial.totalScore, 0);
    assert.equal(initial.dailyMaxScore, 2600); assert.equal(initial.completedLevels, 0);
    assert.deepEqual(initial.difficulties.map(level => level.locked), [false, true, true]);
    assert.deepEqual(initial.puzzle, (await state(bob.userId)).puzzle);
    for (const difficulty of ['medium', 'hard']) {
      const gated = await state(alice.userId, difficulty);
      assert.equal(gated.difficulty, 'easy', 'Locked puzzle requests resume the unfinished level');
      assert.deepEqual(gated.puzzle, initial.puzzle, 'Locked requests cannot expose the next question');
      const blocked = await request(base, '/api/tower/submit', body(alice.userId, difficulty), 403);
      assert.match(blocked.error, /Finish Easy/);
    }
    for (const invalid of ['impossible', '__proto__', 'constructor']) {
      await request(base, `/api/tower/state?userId=${alice.userId}&difficulty=${invalid}`, undefined, 400);
      await request(base, `/api/tower/leaderboard?difficulty=${invalid}`, undefined, 400);
      await request(base, '/api/tower/submit', { userId: alice.userId, difficulty: invalid }, 400);
    }
    const easySubmission = body(alice.userId, 'easy', easyPartial);
    await request(base, '/api/tower/submit', { ...easySubmission, date: '2000-01-01' }, 409);
    await request(base, '/api/tower/submit', { ...easySubmission, puzzleId: 'old-question' }, 409);
    for (const order of [null, [], easyPartial.slice(1), [...easyPartial, 'extra'], Array(6).fill(easyPartial[0]), [...easyPartial.slice(0, 5), 'unknown']]) {
      await request(base, '/api/tower/submit', { ...easySubmission, order }, 400);
    }
    assert.equal((await state(alice.userId)).completedLevels, 0, 'Invalid attempts cannot unlock a level');
    const events = await fetch(`${base}/api/events`); let reader = events.body.getReader(); await reader.read();
    const easyResult = await request(base, '/api/tower/submit', easySubmission);
    assert.equal(easyResult.result.score, 400); assert.equal(easyResult.totalScore, 400);
    assert.equal(easyResult.completedLevels, 1); assert.equal(easyResult.nextDifficulty, 'medium');
    assert.deepEqual(easyResult.difficulties.map(level => level.locked), [false, false, true]);
    await liveScore(reader, 400);
    assert.equal((await state(alice.userId)).difficulty, 'medium', 'Refresh resumes the next unfinished level');
    await request(base, '/api/tower/submit', body(alice.userId, 'hard'), 403);
    const zero = await request(base, '/api/tower/submit', body(bob.userId, 'easy', [...tower.correctOrder(easyPuzzle)].reverse()));
    assert.equal(zero.result.score, 0); assert.equal(zero.nextDifficulty, 'medium', 'Finishing, not a perfect score, unlocks the next level');
    assert.ok(zero.leaderboard.some(row => row.userId === bob.userId && row.score === 0));

    const submission = body(alice.userId, 'medium', mediumPartial);
    const mediumResult = await request(base, '/api/tower/submit', submission);
    assert.equal(mediumResult.result.score, 533); assert.equal(mediumResult.totalScore, 933);
    assert.equal(mediumResult.nextDifficulty, 'hard'); assert.equal(mediumResult.maxScore, 800);
    assert.deepEqual(mediumResult.result.correctOrder, mediumPerfect);
    assert.ok(mediumResult.result.facts.every(fact => fact.valueLabel)); assert.ok(mediumResult.result.sources.length);
    const bobMedium = await request(base, '/api/tower/submit', body(bob.userId, 'medium', mediumPartial));
    assert.equal(bobMedium.totalScore, 533);
    assert.equal(bobMedium.leaderboard.find(row => row.userId === alice.userId).score, 933, 'The leaderboard sums all completed levels');
    const hardEvents = await fetch(`${base}/api/events`); reader = hardEvents.body.getReader(); await reader.read();
    const hardResult = await request(base, '/api/tower/submit', body(alice.userId, 'hard'));
    assert.equal(hardResult.totalScore, 2133); assert.equal(hardResult.result.score, 1200);
    assert.equal(hardResult.nextDifficulty, null); assert.equal(hardResult.completedLevels, 3);
    const aliceRow = hardResult.leaderboard.find(row => row.userId === alice.userId);
    assert.equal(aliceRow.score, 2133); assert.equal(aliceRow.completedLevels, 3); assert.equal(aliceRow.correctPlacements, 14);
    await liveScore(reader, 2133);
    const duplicate = await request(base, '/api/tower/submit', body(alice.userId, 'medium'));
    assert.equal(duplicate.result.score, 533); assert.equal(duplicate.totalScore, 2133, 'Retries cannot double-count or improve a locked level');
    assert.equal((await state(alice.userId, 'easy')).totalScore, 2133, 'Revisiting a completed level preserves the daily total');
    const menu = (await request(base, `/api/menu?userId=${alice.userId}`)).games.find(game => game.id === 'tower');
    assert.equal(menu.completed, 3); assert.equal(menu.score, 2133); assert.equal(menu.finished, true);
    assert.equal((await request(base, `/api/state?game=rebus&userId=${alice.userId}`)).totalScore, 0);
    const leaderboard = await request(base, '/api/tower/leaderboard');
    assert.deepEqual(leaderboard.leaderboard, hardResult.leaderboard);
    assert.deepEqual((await request(base, '/api/tower/leaderboard?difficulty=easy')).leaderboard, leaderboard.leaderboard);

    for (const name of ['Perfect player', 'Tied player']) {
      const fresh = await request(base, '/api/register', { displayName: name });
      for (const [index, difficulty] of ['easy', 'medium', 'hard'].entries()) {
        const scored = await request(base, '/api/tower/submit', body(fresh.userId, difficulty));
        assert.equal(scored.totalScore, [600, 1400, 2600][index]);
      }
    }
    const tied = await request(base, '/api/tower/leaderboard');
    assert.deepEqual(tied.leaderboard.map(row => row.rank), [1, 1, 3, 4]);
    assert.equal(new Set(tied.leaderboard.map(row => row.userId)).size, 4, 'Each player has one combined leaderboard row');

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
    const restored = await state(alice.userId, 'medium');
    assert.equal(restored.result.score, 533); assert.equal(restored.totalScore, 2133);
    assert.deepEqual(restored.result.submittedOrder, mediumPartial);
    assert.equal(restored.leaderboard.find(row => row.userId === alice.userId).score, 2133);
    assert.equal((await state(bob.userId)).difficulty, 'hard', 'Unlocks survive server restarts');

    await stop(running.child);
    let saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    saved.towerDays['2000-01-01'] = saved.towerDays[date]; delete saved.towerDays[date];
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port); base = running.base;
    const newMedium = await state(alice.userId);
    assert.equal(newMedium.difficulty, 'medium'); assert.equal(newMedium.maxScore, 800);
    const puzzle = tower.puzzles.find(puzzle => puzzle.id === newMedium.puzzle.id);
    const newResult = await request(base, '/api/tower/submit', { userId: alice.userId, date, difficulty: 'medium', puzzleId: puzzle.id, order: tower.correctOrder(puzzle) });
    assert.equal(newResult.totalScore, 2400); assert.equal(newResult.result.score, 800);
    await stop(running.child);
    saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    assert.equal(saved.towerDays['2000-01-01'].players[alice.userId].score, 533);
    assert.equal(saved.towerDays['1999-01-01'].players[alice.userId].score, 600);

    // Model an update arriving after players have submitted the old Medium
    // and Hard. Their questions, orders, scores, and shared day stay locked.
    const previouslyPublished = (questionId, difficulty) => {
      const oldPuzzle = tower.getPuzzle(questionId);
      const maxScore = tower.DIFFICULTIES[difficulty].maxScore;
      const order = tower.correctOrder(oldPuzzle);
      return { puzzleId: questionId, difficulty, maxScore, scoringVersion: tower.SCORING_VERSION, order,
        players: { [alice.userId]: { order, score: maxScore, maxScore, correctPlacements: 6 } } };
    };
    saved.towerDays = {
      [`${date}:easy`]: previouslyPublished(easyPuzzle.id, 'easy'),
      [`${date}:medium`]: previouslyPublished('country-area', 'medium'),
      [`${date}:hard`]: previouslyPublished('famous-ships-lengths', 'hard')
    };
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port); base = running.base;
    const oldMediumResult = await state(alice.userId, 'medium');
    const oldHardResult = await state(alice.userId, 'hard');
    assert.equal(oldMediumResult.puzzle.id, 'country-area');
    assert.equal(oldMediumResult.result.score, 800);
    assert.equal(oldHardResult.puzzle.id, 'famous-ships-lengths');
    assert.equal(oldHardResult.result.score, 1200);
    assert.equal(oldHardResult.totalScore, 2600);
    assert.deepEqual(oldHardResult.result.submittedOrder, perfect);
    assert.equal((await state(bob.userId, 'hard')).difficulty, 'easy');
    await stop(running.child);
    saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));

    // The same update can replace both unanswered levels. The displaced
    // Medium question must be reserved before selecting the new Hard tower.
    for (const day of Object.values(saved.towerDays)) day.players = {};
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port); base = running.base;
    await state(alice.userId);
    await stop(running.child);
    saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    assert.equal(tower.getPuzzle(saved.towerDays[`${date}:medium`].puzzleId).difficulty, 'medium');
    assert.equal(tower.getPuzzle(saved.towerDays[`${date}:hard`].puzzleId).difficulty, 'hard');
    assert.notEqual(saved.towerDays[`${date}:hard`].puzzleId, 'country-area');
    for (const questionId of ['country-area', 'famous-ships-lengths']) {
      assert.ok(Object.values(saved.towerDays).some(day => day.puzzleId === questionId && day.retiredReason === 'difficulty-review'),
        'The server persists displaced question reservations');
    }
    for (const difficulty of Object.keys(tower.DIFFICULTIES)) {
      const day = saved.towerDays[`${date}:${difficulty}`];
      if (difficulty !== 'easy') assert.equal(day.contentKey, tower.questionKey(tower.getPuzzle(day.puzzleId)));
    }

    saved.towerDays = {};
    for (const [index, puzzle] of tower.puzzles.filter(puzzle => puzzle.difficulty === 'easy').entries()) {
      saved.towerDays[`used-easy-${index}`] = published(puzzle);
    }
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port); base = running.base;
    const noEasy = await state(alice.userId);
    assert.equal(noEasy.difficulties[0].exhausted, true); assert.equal(noEasy.difficulty, 'medium');
    assert.equal(noEasy.difficulties[2].locked, true, 'Unavailable levels are skipped without skipping an available level');
    await stop(running.child);
    saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8')); saved.towerDays = {};
    for (const [index, puzzle] of tower.puzzles.entries()) saved.towerDays[`used-${index}`] = published(puzzle);
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
    running = await launch(dataDir, port); base = running.base;
    const exhausted = await state(alice.userId);
    assert.equal(exhausted.exhausted, true); assert.equal(exhausted.puzzle, null);
    assert.equal(exhausted.totalScore, 0); assert.equal(exhausted.result, null); assert.equal(exhausted.leaderboard.length, 0);
    if (date === refreshDate) {
      await stop(running.child);
      const oldPublished = id => {
        const puzzle = tower.getPuzzle(id); const order = tower.correctOrder(puzzle);
        return { puzzleId: id, order, players: { [alice.userId]: { order, score: 600, correctPlacements: 6 }, [bob.userId]: { order, score: 400, correctPlacements: 4 } } };
      };
      saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
      const rebusBeforeReset = JSON.stringify(saved.days);
      saved.towerContentRefreshes = {};
      saved.towerDays = { '2026-11-17': oldPublished('roman-numerals'),
        [date]: oldPublished('atomic-numbers'), [`${date}:easy`]: oldPublished('calendar-months'), [`${date}:hard`]: oldPublished('polygon-sides') };
      fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify(saved));
      running = await launch(dataDir, port); base = running.base;
      for (const userId of [alice.userId, bob.userId]) {
        const reset = await state(userId);
        assert.equal(reset.totalScore, 0); assert.equal(reset.completedLevels, 0); assert.equal(reset.result, null);
        assert.equal(reset.difficulty, 'easy'); assert.equal(reset.puzzle.id, 'wildlife-size');
        assert.deepEqual(reset.difficulties.map(level => level.locked), [false, true, true]);
        assert.equal(reset.leaderboard.length, 0); assert.equal(reset.contentRevision, tower.CONTENT_REFRESH.id);
      }
      await request(base, '/api/tower/submit', { userId: alice.userId, date, difficulty: 'easy', puzzleId: 'calendar-months', order: retiredOrder }, 409);
      const newEasy = await state(alice.userId);
      const newEasyPuzzle = tower.getPuzzle(newEasy.puzzle.id);
      const playedAfterReset = await request(base, '/api/tower/submit', { userId: alice.userId, date, difficulty: 'easy', puzzleId: newEasyPuzzle.id, order: tower.correctOrder(newEasyPuzzle) });
      assert.equal(playedAfterReset.totalScore, 600);
      await stop(running.child); running = await launch(dataDir, port); base = running.base;
      assert.equal((await state(alice.userId)).totalScore, 600, 'Production startup migration runs once, not on every restart');
      const persistedReset = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
      assert.equal(JSON.stringify(persistedReset.days), rebusBeforeReset);
      assert.equal(persistedReset.towerDays['2026-11-17'].players[alice.userId].score, 600);
    }
    console.log('Passed: 340 active questions with 120 approachable additions, unchanged Easy, former Medium promoted to Hard, archived compatibility, content-based nonrepeating selection, one-time date-scoped reset for all players, earlier days and Rebus preserved, progression, accumulated scores, live standings, and restart persistence.');
  } finally {
    if (running) await stop(running.child);
    const resolved = fs.realpathSync(dataDir);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('yappers-tower-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
