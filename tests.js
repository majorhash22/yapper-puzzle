const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const rebusPuzzles = require('./puzzles');
const chainPuzzles = require('./chain-puzzles');
const { initialRotation, selectPuzzles } = require('./schedule');

function validateRotation(puzzles, daysToExhaust) {
  const ids = puzzles.map(p => p.id);
  const used = new Set();
  let rotation = initialRotation({}, ids);
  let yesterday = [];

  for (let day = 1; day <= daysToExhaust; day++) {
    const key = `2026-10-${String(day).padStart(2, '0')}`;
    const result = selectPuzzles(rotation, ids, key, 5);
    assert.equal(new Set(result.puzzleIds).size, 5, 'A daily set must have five distinct puzzles');
    assert.ok(result.puzzleIds.every(id => !yesterday.includes(id)), 'No puzzle may repeat from the previous day');
    assert.ok(result.puzzleIds.every(id => !used.has(id)), 'No puzzle may repeat before the complete bank is exhausted');
    result.puzzleIds.forEach(id => used.add(id));
    yesterday = result.puzzleIds;
    rotation = result.rotation;
  }

  assert.equal(used.size, puzzles.length, 'The first rotation must use every puzzle exactly once');
  const recycled = selectPuzzles(rotation, ids, '2026-11-01', 5);
  assert.ok(recycled.puzzleIds.every(id => !yesterday.includes(id)), 'A recycled bank must still avoid yesterday’s puzzles');
}

assert.equal(rebusPuzzles.length, 35, 'Expected the existing 35 Rebus puzzles');
assert.equal(new Set(rebusPuzzles.map(p => p.id)).size, rebusPuzzles.length, 'Rebus IDs must be unique');
validateRotation(rebusPuzzles, 7);

assert.equal(chainPuzzles.length, 100, 'Chain Reaction should contain 100 puzzles');
assert.equal(new Set(chainPuzzles.map(p => p.id)).size, chainPuzzles.length, 'Chain Reaction IDs must be unique');
assert.equal(new Set(chainPuzzles.map(p => p.words.join('|').toLowerCase())).size, chainPuzzles.length, 'Chain Reaction chains must be unique');
for (const puzzle of chainPuzzles) {
  assert.equal(puzzle.words.length, 4, `${puzzle.id} must contain four words`);
}
validateRotation(chainPuzzles, 20);

async function freePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

async function launch(dataDir, port) {
  const env = {
    ...process.env,
    RAILWAY_SERVICE_ID: 'test-service',
    RAILWAY_VOLUME_MOUNT_PATH: dataDir,
    PORT: String(port)
  };
  delete env.DATA_DIR;

  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let logs = '';
  child.stderr.on('data', chunk => { logs += chunk; });
  const base = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited during startup: ${logs}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return { child, base };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  child.kill();
  throw new Error(`Server did not become healthy: ${logs}`);
}

async function request(base, url, body) {
  const response = await fetch(`${base}${url}`, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  assert.ok(response.ok, `${url} returned HTTP ${response.status}`);
  return response.json();
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await once(child, 'exit');
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yappers-test-'));
  const port = await freePort();
  let running;

  try {
    const missingVolumeEnv = { ...process.env, RAILWAY_SERVICE_ID: 'test-service' };
    delete missingVolumeEnv.RAILWAY_VOLUME_MOUNT_PATH;
    delete missingVolumeEnv.DATA_DIR;
    const noVolume = spawnSync(process.execPath, [path.join(__dirname, 'server.js')], {
      cwd: __dirname,
      env: missingVolumeEnv,
      encoding: 'utf8',
      timeout: 5000
    });
    assert.notEqual(noVolume.status, 0, 'Railway must refuse to start without persistent storage');
    assert.match(noVolume.stderr, /needs a Railway volume/);

    const originalIds = rebusPuzzles.map(p => p.id);
    fs.writeFileSync(path.join(dataDir, 'game-data.json'), JSON.stringify({
      users: {},
      days: { '2026-01-01': { puzzleIds: originalIds.slice(0, 5), players: {} } }
    }));

    running = await launch(dataDir, port);
    const { base } = running;

    const page = await fetch(base);
    const html = await page.text();
    assert.ok(html.includes('Chain Reaction'), 'Game menu must include Chain Reaction');
    assert.ok(html.includes('Rebus'), 'Game menu must include Rebus');

    const alice = await request(base, '/api/register', { displayName: 'Alice' });
    const bob = await request(base, '/api/register', { displayName: 'Bob' });
    assert.notEqual(alice.userId, bob.userId);
    assert.equal(alice.menu.games.length, 2, 'Menu should return both games');

    const aliceRebus = await request(base, `/api/state?userId=${alice.userId}&game=rebus`);
    const bobRebus = await request(base, `/api/state?userId=${bob.userId}&game=rebus`);
    assert.equal(aliceRebus.puzzle.id, bobRebus.puzzle.id, 'Rebus daily puzzles must match across players');

    const aliceChain = await request(base, `/api/state?userId=${alice.userId}&game=chain`);
    const bobChain = await request(base, `/api/state?userId=${bob.userId}&game=chain`);
    assert.equal(aliceChain.puzzle.id, bobChain.puzzle.id, 'Chain Reaction daily puzzles must match across players');
    assert.match(aliceChain.puzzle.prompt, /chain-blank/, 'Chain Reaction must hide the two middle words');

    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'game-data.json'), 'utf8'));
    assert.ok(saved.days['2026-01-01'], 'Upgrade must preserve existing Rebus history');
    assert.ok(saved.chainDays, 'Upgrade must add separate Chain Reaction day storage');
    assert.ok(saved.days[aliceRebus.date].puzzleIds.every(id => !originalIds.slice(0, 5).includes(id)),
      'First upgraded Rebus day must avoid already served puzzles');

    const wrong = await request(base, '/api/answer', {
      userId: alice.userId,
      game: 'chain',
      answer: 'totally wrong words'
    });
    assert.equal(wrong.correct, false);
    const afterWrong = await request(base, `/api/state?userId=${alice.userId}&game=chain`);
    assert.equal(afterWrong.puzzle.id, aliceChain.puzzle.id, 'Wrong Chain Reaction answer must not advance');

    const skipped = await request(base, '/api/give-up', { userId: alice.userId, game: 'chain' });
    assert.equal(skipped.state.completed[0].score, 0);
    assert.equal(skipped.state.puzzle.number, 2);
    assert.match(skipped.answer, / → /, 'Give Up should reveal both missing Chain Reaction words');

    const secondChain = chainPuzzles.find(p => p.id === skipped.state.puzzle.id);
    const chainAnswer = secondChain.words.slice(1, -1).join(', ');
    const chainSolved = await request(base, '/api/answer', {
      userId: alice.userId,
      game: 'chain',
      answer: chainAnswer
    });
    assert.equal(chainSolved.correct, true);
    assert.ok(chainSolved.earned >= 100 && chainSolved.earned <= 1000);
    assert.equal(chainSolved.state.puzzle.number, 3);

    const chainBoard = await request(base, '/api/leaderboard?game=chain');
    assert.equal(chainBoard.game, 'chain');
    assert.equal(chainBoard.leaderboard[0].displayName, 'Alice');
    assert.equal(chainBoard.leaderboard.length, 2);

    const rebusBoardBefore = await request(base, '/api/leaderboard?game=rebus');
    const aliceRebusRow = rebusBoardBefore.leaderboard.find(row => row.userId === alice.userId);
    assert.equal(aliceRebusRow.score, 0, 'Chain Reaction score must not affect the Rebus leaderboard');

    await stop(running.child);
    running = await launch(dataDir, port);

    const restoredChain = await request(running.base, `/api/state?userId=${alice.userId}&game=chain`);
    assert.equal(restoredChain.totalScore, chainSolved.earned, 'Chain Reaction score must survive restart');
    assert.equal(restoredChain.puzzle.number, 3, 'Chain Reaction progress must survive restart');

    const restoredRebus = await request(running.base, `/api/state?userId=${alice.userId}&game=rebus`);
    assert.equal(restoredRebus.puzzle.id, aliceRebus.puzzle.id, 'Rebus progress must remain independent and persistent');

    console.log(`Passed: ${rebusPuzzles.length} Rebus + ${chainPuzzles.length} Chain Reaction puzzles, menu, separate leaderboards, scoring, non-repeat rotation, migration, and restart persistence.`);
  } finally {
    if (running) await stop(running.child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
