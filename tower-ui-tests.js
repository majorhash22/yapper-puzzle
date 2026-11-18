const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tower = require('./trivia-tower');

// Exercise the actual browser script with the same small DOM approach as
// Chainly's tests. This covers interactions, not browser layout or rendering.
async function page({ storage = new Map(), reducedMotion = false } = {}) {
  const animations = [];
  const timers = new Map();
  let nextTimer = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {};
      this.listeners = {}; this.textContent = ''; this.disabled = false;
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle: (name, force = !classes.has(name)) => force ? classes.add(name) : classes.delete(name)
      };
      Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => {
        classes.clear(); value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
      } });
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    async click() {
      if (this.disabled) return;
      for (const handler of this.listeners.click || []) await handler({ target: this });
    }
    async emit(name, extra = {}) {
      for (const handler of this.listeners[name] || []) await handler({ preventDefault() {}, target: this, ...extra });
    }
    querySelector(selector) {
      const match = selector.match(/\[data-(item-id|position)="([^"]+)"\]/);
      return match ? this.children.find(child => String(child.dataset[match[1] === 'item-id' ? 'itemId' : 'position']) === match[2]) : null;
    }
    focus() {}
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    getBoundingClientRect() { return { left: 100, top: 100, width: 400, height: 600 }; }
    animate(keyframes, options) { animations.push({ keyframes, options }); }
  }
  const html = fs.readFileSync(path.join(__dirname, 'public/tower/index.html'), 'utf8');
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const playerFrame = new Element();
  const storageApi = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const fixtures = {};
  for (const [difficulty, config] of Object.entries(tower.DIFFICULTIES)) {
    const puzzle = tower.puzzles.find(question => question.difficulty === difficulty);
    fixtures[difficulty] = { puzzle, day: tower.ensureTowerDay({}, '2030-01-01', [puzzle], difficulty), player: null, ...config };
  }
  function state(difficulty) {
    const level = fixtures[difficulty];
    return {
      date: '2030-01-01', timeZone: 'America/Regina', displayName: 'UI Player', difficulty,
      difficulties: Object.entries(fixtures).map(([id, level]) => ({ id, label: level.label,
        pointsPerPlacement: level.pointsPerPlacement, maxScore: level.pointsPerPlacement * 6,
        finished: Boolean(level.player), exhausted: false })),
      pointsPerPlacement: level.pointsPerPlacement, maxScore: level.pointsPerPlacement * 6,
      finished: Boolean(level.player), exhausted: false, puzzle: tower.publicTowerPuzzle(level.puzzle, level.day),
      result: level.player ? tower.revealResult(level.puzzle, level.player) : null, leaderboard: []
    };
  }
  let failure = false;
  const fetch = async (url, options) => {
    if (url === '/api/register') return { ok: true, json: async () => ({ userId: 'ui-player' }) };
    if (failure) return { ok: false, status: 503, json: async () => ({ error: 'Connection interrupted. Try again.' }) };
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body);
      const level = fixtures[body.difficulty];
      level.player ||= { order: body.order, pointsPerPlacement: level.pointsPerPlacement };
      return { ok: true, json: async () => state(body.difficulty) };
    }
    const difficulty = new URL(url, 'http://localhost').searchParams.get('difficulty');
    return { ok: true, json: async () => state(difficulty) };
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id], createElement: tag => new Element(tag), querySelector: () => playerFrame, querySelectorAll: () => [] },
    localStorage: storageApi, fetch, matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: id => timers.delete(id),
    EventSource: class { addEventListener() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'public/tower/script.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { elements, storage, fixtures, animations, call: code => vm.runInContext(code, context),
    fail: value => { failure = value; },
    tick: () => { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); }
  };
}

async function main() {
  const app = await page(); const el = app.elements;
  assert.equal(el.rulesDialog.open, true, 'Opening Trivia Tower shows the rules first');
  el.rulesDialog.close(); await el.rulesButton.click(); assert.equal(el.rulesDialog.open, true);
  el.rulesDialog.close();
  el.towerName.value = 'UI Player'; await el.towerJoinForm.emit('submit');
  assert.equal(app.call('difficulty'), 'easy');
  assert.equal(el.answerFrame.classList.contains('hidden'), true);
  assert.equal(el.answerTower.children.length, 0, 'The answer tower has no rows before lock-in');
  assert.equal(el.playerTower.children.length, 6);
  const firstDraft = app.call('order.join()');
  const movable = el.playerTower.children[1];
  await movable.emit('keydown', { key: 'ArrowDown' });
  const movedDraft = app.call('order.join()'); assert.notEqual(movedDraft, firstDraft);
  const switching = el.difficultyPicker.children[1].click();
  assert.equal(el.lockButton.disabled, true, 'Lock-in is disabled while changing difficulty');
  await el.lockButton.click(); assert.equal(app.call('state.finished'), false);
  await switching; assert.equal(app.call('difficulty'), 'medium');
  assert.equal(el.towerScore.textContent, 900);
  await el.difficultyPicker.children[0].click();
  assert.equal(app.call('order.join()'), movedDraft, 'Switching difficulties restores the draft');
  app.fail(true); await el.difficultyPicker.children[2].click();
  assert.equal(app.call('difficulty'), 'easy', 'A failed level load keeps the current playable tower');
  assert.equal(app.call('order.join()'), movedDraft);
  assert.equal(el.lockButton.disabled, false);
  app.fail(true); await el.lockButton.click();
  assert.equal(app.call('state.finished'), false);
  assert.equal(el.answerFrame.classList.contains('hidden'), true, 'Failed submissions cannot reveal or move towers');
  assert.match(el.towerFeedback.textContent, /Connection interrupted/);
  assert.equal(el.lockButton.disabled, false);
  app.fail(false); await el.lockButton.click();
  assert.equal(el.answerFrame.classList.contains('hidden'), false);
  assert.equal(el.towerStage.classList.contains('is-locked'), true);
  assert.equal(app.animations.length, 2, 'Player and answer towers both animate on successful lock-in');
  assert.equal(app.call('revealedCount'), 0);
  assert.equal(el.resultDetails.classList.contains('hidden'), true);
  assert.ok(el.difficultyPicker.children.every(button => button.disabled), 'Levels cannot change during reveal');
  app.tick(); assert.equal(app.call('revealedCount'), 1, 'Answers reveal from the bottom, one at a time');
  await el.skipRevealButton.click(); assert.equal(app.call('revealedCount'), 6);
  assert.equal(el.resultDetails.classList.contains('hidden'), false);
  await el.difficultyPicker.children[2].click();
  assert.equal(app.call('difficulty'), 'hard'); assert.equal(el.towerScore.textContent, 1200);
  assert.equal(el.answerFrame.classList.contains('hidden'), true);
  await el.difficultyPicker.children[0].click();
  assert.equal(app.call('state.finished'), true); assert.equal(app.call('revealedCount'), 6);
  assert.equal(app.call('revealing'), false, 'Reopening a completed level shows its saved result immediately');
  assert.equal(app.animations.length, 2, 'Saved results do not replay the tower animation');

  const reduced = await page({ storage: new Map([['yappersPuzzleUserId', 'ui-player']]), reducedMotion: true });
  await reduced.elements.lockButton.click(); assert.equal(reduced.animations.length, 0);
  for (let count = 0; count < 6; count++) reduced.tick();
  assert.equal(reduced.call('revealedCount'), 6); assert.equal(reduced.call('revealing'), false);
  assert.equal(reduced.elements.resultDetails.classList.contains('hidden'), false);
  console.log('Passed: rules popup, keyboard moves, separate drafts, difficulty selection and points, submission recovery, hidden answers, tower animations, ordered/skip reveal, saved results, and reduced motion (DOM interaction checks).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
