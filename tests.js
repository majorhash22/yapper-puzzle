const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const puzzles = require('./puzzles');

assert.ok(puzzles.length >= 25, 'Puzzle bank should have at least 25 puzzles');
assert.equal(new Set(puzzles.map(p => p.id)).size, puzzles.length, 'Puzzle IDs must be unique');
for (const p of puzzles) {
  assert.ok(p.id && p.prompt, `Puzzle ${p.id || '?'} needs id and prompt`);
  assert.ok(Array.isArray(p.answers) && p.answers.length > 0, `${p.id} needs answers`);
}

async function freePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

async function launch(dataDir, port) {
  const env = { ...process.env, RAILWAY_SERVICE_ID: 'test-service', RAILWAY_VOLUME_MOUNT_PATH: dataDir, PORT: String(port) };
  delete env.DATA_DIR;
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe']
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
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
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
      cwd: __dirname, env: missingVolumeEnv, encoding: 'utf8', timeout: 5000
    });
    assert.notEqual(noVolume.status, 0, 'Railway must refuse to start without persistent storage');
    assert.match(noVolume.stderr, /needs a Railway volume/);

    running = await launch(dataDir, port);
    const { base } = running;
    const page = await fetch(base);
    assert.ok((await page.text()).includes('Yappers Puzzle'));

    const alice = await request(base, '/api/register', { displayName: 'Alice' });
    const bob = await request(base, '/api/register', { displayName: 'Bob' });
    assert.notEqual(alice.userId, bob.userId);
    assert.equal(alice.state.puzzle.id, bob.state.puzzle.id, 'Daily puzzles must match across players');

    const wrong = await request(base, '/api/answer', { userId: alice.userId, answer: 'a completely wrong guess' });
    assert.equal(wrong.correct, false);
    const afterWrong = await request(base, `/api/state?userId=${alice.userId}`);
    assert.equal(afterWrong.puzzle.id, alice.state.puzzle.id, 'A wrong answer must not advance');

    const skipped = await request(base, '/api/give-up', { userId: alice.userId });
    assert.equal(skipped.state.completed[0].score, 0);
    assert.equal(skipped.state.puzzle.number, 2);
    const second = puzzles.find(p => p.id === skipped.state.puzzle.id);
    const solved = await request(base, '/api/answer', { userId: alice.userId, answer: second.answers[0] });
    assert.equal(solved.correct, true);
    assert.ok(solved.earned >= 100 && solved.earned <= 1000);
    assert.equal(solved.state.puzzle.number, 3);
    assert.equal(solved.state.totalScore, solved.earned);
    const board = await request(base, '/api/leaderboard');
    assert.equal(board.leaderboard[0].displayName, 'Alice');
    assert.equal(board.leaderboard.length, 2);

    await stop(running.child);
    running = await launch(dataDir, port);
    const restored = await request(running.base, `/api/state?userId=${alice.userId}`);
    assert.equal(restored.totalScore, solved.earned, 'Score must survive a restart');
    assert.equal(restored.puzzle.number, 3, 'Puzzle progress must survive a restart');
    assert.equal((await request(running.base, '/api/leaderboard')).leaderboard.length, 2);
    console.log(`Passed: ${puzzles.length} puzzles, multiplayer, give up, scoring, volume requirement, and restart persistence.`);
  } finally {
    if (running) await stop(running.child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
