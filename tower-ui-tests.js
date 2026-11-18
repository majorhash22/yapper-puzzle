const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tower = require('./trivia-tower');

// Exercise the actual browser script with the same small DOM approach as
// Chainly's tests. This covers interactions, not browser layout or rendering.
async function page({ storage = new Map(), reducedMotion = false, savedPlayers = {}, browserNavigator = {}, legacyCopy = false } = {}) {
  const animations = [];
  const requests = [];
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
    select() { this.selected = true; }
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
    fixtures[difficulty] = { puzzle, day: tower.ensureTowerDay({}, '2030-01-01', [puzzle], difficulty), player: savedPlayers[difficulty] || null, ...config };
  }
  let contentRevision = null;
  function state(requestedDifficulty) {
    const levels = Object.entries(fixtures).map(([id, level]) => ({ id, label: level.label, maxScore: level.maxScore,
      finished: Boolean(level.player), exhausted: false,
      score: level.player ? tower.scoreOrder(level.puzzle, level.player.order, level.maxScore).score : 0 }));
    for (const [index, level] of levels.entries()) {
      const prerequisite = levels.slice(0, index).find(previous => !previous.finished);
      level.locked = !level.finished && Boolean(prerequisite); level.unlockAfter = prerequisite?.label || null;
    }
    const next = levels.find(level => !level.finished && !level.locked);
    const requested = levels.find(level => level.id === requestedDifficulty);
    const selected = requested && !requested.locked ? requested : next || [...levels].reverse().find(level => level.finished) || levels[0];
    const difficulty = selected.id;
    const level = fixtures[difficulty];
    const completedLevels = levels.filter(level => level.finished).length;
    const totalScore = levels.reduce((sum, level) => sum + level.score, 0);
    const correctPlacements = Object.values(fixtures).reduce((sum, level) => sum + (level.player ? tower.scoreOrder(level.puzzle, level.player.order, level.maxScore).correctPlacements : 0), 0);
    return {
      date: '2030-01-01', timeZone: 'America/Regina', displayName: 'UI Player', difficulty, contentRevision,
      difficulties: levels, totalScore, dailyMaxScore: 2600, completedLevels, nextDifficulty: next?.id || null,
      maxScore: level.maxScore,
      finished: Boolean(level.player), exhausted: false, puzzle: tower.publicTowerPuzzle(level.puzzle, level.day),
      result: level.player ? tower.revealResult(level.puzzle, level.player) : null,
      leaderboard: completedLevels ? [{ userId: 'ui-player', displayName: 'UI Player', score: totalScore, correctPlacements, completedLevels, rank: 1 }] : []
    };
  }
  let failure = false;
  const fetch = async (url, options) => {
    requests.push({ url, method: options?.method || 'GET' });
    if (url === '/api/register') return { ok: true, json: async () => ({ userId: 'ui-player' }) };
    if (failure) return { ok: false, status: 503, json: async () => ({ error: 'Connection interrupted. Try again.' }) };
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body);
      const level = fixtures[body.difficulty];
      level.player ||= { order: body.order, maxScore: level.maxScore };
      return { ok: true, json: async () => state(body.difficulty) };
    }
    const difficulty = new URL(url, 'http://localhost').searchParams.get('difficulty');
    return { ok: true, json: async () => state(difficulty) };
  };
  const eventHandlers = {};
  const context = vm.createContext({
    document: { getElementById: id => elements[id], createElement: tag => new Element(tag), querySelector: () => playerFrame, querySelectorAll: () => [], execCommand: command => command === 'copy' && legacyCopy },
    navigator: browserNavigator, location: { origin: 'https://puzzle.example' },
    localStorage: storageApi, fetch, matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: id => timers.delete(id),
    EventSource: class { addEventListener(name, handler) { eventHandlers[name] = handler; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'public/tower/script.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { elements, storage, fixtures, animations, requests, call: code => vm.runInContext(code, context),
    fail: value => { failure = value; },
    tick: () => { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); },
    emitLeaderboard: payload => eventHandlers.leaderboard({ data: JSON.stringify(payload) }),
    emitReset: async () => {
      eventHandlers['tower-reset']({ data: JSON.stringify({ date: '2030-01-01', revision: tower.CONTENT_REFRESH.id }) });
      await new Promise(resolve => setImmediate(resolve));
    },
    refreshContent: () => {
      for (const fixture of Object.values(fixtures)) fixture.player = null;
      const puzzle = tower.getPuzzle('wildlife-size');
      fixtures.easy.puzzle = puzzle;
      fixtures.easy.day = tower.ensureTowerDay({}, '2030-01-01', [puzzle], 'easy');
      contentRevision = tower.CONTENT_REFRESH.id;
    }
  };
}

async function main() {
  const copied = []; const nativeShares = [];
  const browserNavigator = { clipboard: { writeText: async content => copied.push(content) } };
  const app = await page({ browserNavigator }); const el = app.elements;
  const solve = async difficulty => {
    const expected = tower.correctOrder(app.fixtures[difficulty].puzzle);
    for (const [index, id] of expected.entries()) {
      let row = el.playerTower.children.find(row => row.dataset.itemId === id);
      while (row.dataset.position !== index + 1) {
        await row.children[2].children[row.dataset.position < index + 1 ? 0 : 1].click();
        row = el.playerTower.children.find(row => row.dataset.itemId === id);
      }
    }
  };
  assert.equal(el.rulesDialog.open, true);
  el.rulesDialog.close(); await el.rulesButton.click(); assert.equal(el.rulesDialog.open, true); el.rulesDialog.close();
  el.towerName.value = 'UI Player'; await el.towerJoinForm.emit('submit');
  assert.equal(app.call('difficulty'), 'easy');
  assert.equal(el.answerFrame.classList.contains('hidden'), true); assert.equal(el.answerTower.children.length, 0);
  assert.equal(el.playerTower.children.length, 6);
  assert.equal(el.questionInstructions.textContent, app.call('state.puzzle.instructions'));
  assert.equal(el.questionTitle, undefined); assert.equal(el.questionCategory, undefined);
  assert.equal(el.dailyScore.textContent, '0');
  assert.equal(el.contentRefreshNotice.classList.contains('hidden'), true);
  assert.equal(el.shareLevelButton.classList.contains('hidden'), true);
  await el.shareLevelButton.click(); assert.ok(!el.shareDialog.open, 'Unfinished answers cannot be shared');
  assert.equal(el.difficultyPicker.children[1].disabled, true); assert.equal(el.difficultyPicker.children[2].disabled, true);
  await el.difficultyPicker.children[2].click(); assert.equal(app.call('difficulty'), 'easy', 'Hard stays locked before finishing Easy');
  const firstDraft = app.call('order.join()');
  await el.playerTower.children[1].emit('keydown', { key: 'ArrowDown' });
  const movedDraft = app.call('order.join()'); assert.notEqual(movedDraft, firstDraft);
  const draftReload = await page({ storage: app.storage });
  assert.equal(draftReload.call('order.join()'), movedDraft, 'Refreshing restores the unfinished level’s draft');
  app.fail(true); await el.lockButton.click();
  assert.equal(app.call('state.finished'), false); assert.equal(el.answerFrame.classList.contains('hidden'), true);
  assert.match(el.towerFeedback.textContent, /Connection interrupted/); assert.equal(el.lockButton.disabled, false);
  assert.equal(el.difficultyPicker.children[1].disabled, true, 'A failed submission cannot unlock Medium');
  app.fail(false); await el.lockButton.click();
  const easyPoints = app.call('state.result.score');
  assert.equal(el.answerFrame.classList.contains('hidden'), false); assert.equal(el.towerStage.classList.contains('is-locked'), true);
  assert.equal(app.animations.length, 2); assert.equal(app.call('revealedCount'), 0);
  assert.equal(el.dailyScore.textContent, '0', 'The daily total does not spoil the current reveal');
  assert.equal(el.nextLevelButton.classList.contains('hidden'), true);
  assert.equal(el.shareLevelButton.classList.contains('hidden'), true, 'Sharing waits until the reveal finishes');
  await el.shareLevelButton.click(); assert.ok(!el.shareDialog.open);
  assert.ok(el.difficultyPicker.children.every(button => button.disabled));
  app.tick(); assert.equal(app.call('revealedCount'), 1);
  await el.skipRevealButton.click(); assert.equal(app.call('revealedCount'), 6);
  assert.equal(el.dailyScore.textContent, easyPoints.toLocaleString());
  assert.equal(el.dailyLevelProgress.textContent, '1/3 levels finished');
  assert.equal(el.difficultyPicker.children[1].disabled, false); assert.equal(el.difficultyPicker.children[2].disabled, true);
  assert.equal(el.nextLevelButton.classList.contains('hidden'), false); assert.equal(el.nextLevelButton.textContent, 'Continue to Medium');
  assert.equal(el.shareLevelButton.textContent, 'Share Easy answers');
  assert.equal(el.shareDayButton.classList.contains('hidden'), true);
  await el.shareLevelButton.click(); assert.equal(el.shareDialog.open, true);
  const easyShare = el.sharePreview.value;
  assert.match(easyShare, /Trivia Tower · 2030-01-01/); assert.match(easyShare, /UI Player’s answers/);
  assert.ok(easyShare.includes(`Easy · ${easyPoints}/600 points`));
  assert.ok(easyShare.includes(app.fixtures.easy.puzzle.instructions));
  const submittedEasy = app.call('state.result');
  for (const placement of submittedEasy.placements) {
    const label = app.fixtures.easy.puzzle.items.find(item => item.id === placement.id).label;
    assert.ok(easyShare.includes(`${placement.position}. ${placement.correct ? '✅' : '❌'} ${label}`), 'Share the actual submitted order, including mistakes');
  }
  assert.ok(easyShare.indexOf('\n6. ') < easyShare.indexOf('\n1. '), 'The shared tower reads from top to bottom');
  assert.ok(easyShare.endsWith('https://puzzle.example/tower/index.html'));
  assert.ok(!easyShare.includes('ui-player')); assert.ok(!easyShare.includes('userId='), 'Shared links contain no player credentials');
  assert.equal(el.nativeShareButton.classList.contains('hidden'), true);
  await el.copyAnswersButton.click(); assert.equal(copied.at(-1), easyShare); assert.match(el.shareStatus.textContent, /Answers copied/);
  el.shareDialog.close(); await el.shareDialog.emit('close'); assert.equal(el.sharePreview.value, '');

  const switching = el.nextLevelButton.click();
  assert.equal(el.lockButton.disabled, true); await switching;
  assert.equal(app.call('difficulty'), 'medium'); assert.equal(el.towerScore.textContent, 800);
  assert.equal(el.dailyScore.textContent, easyPoints.toLocaleString(), 'Starting a new level keeps the previous points');
  assert.equal(el.rulesMediumPoints.textContent, '800 points max');
  await el.difficultyPicker.children[2].click(); assert.equal(app.call('difficulty'), 'medium');
  app.fail(true); await el.difficultyPicker.children[0].click();
  assert.equal(app.call('difficulty'), 'medium'); assert.equal(el.lockButton.disabled, false);
  app.fail(false); await solve('medium'); await el.lockButton.click();
  assert.equal(el.dailyScore.textContent, easyPoints.toLocaleString());
  app.tick(); assert.equal(el.towerScore.textContent, 133); assert.equal(el.dailyScore.textContent, (easyPoints + 133).toLocaleString());
  app.tick(); assert.equal(el.towerScore.textContent, 267); assert.equal(el.dailyScore.textContent, (easyPoints + 267).toLocaleString());
  for (let step = 0; step < 4; step++) app.tick();
  assert.equal(el.towerScore.textContent, 800); assert.equal(el.dailyScore.textContent, (easyPoints + 800).toLocaleString());
  assert.equal(el.scoreDetail.textContent, '6/6 correct placements');
  assert.equal(el.dailyLevelProgress.textContent, '2/3 levels finished');
  assert.equal(el.nextLevelButton.textContent, 'Continue to Hard');
  assert.equal(el.shareLevelButton.textContent, 'Share Medium answers');
  assert.equal(el.shareDayButton.classList.contains('hidden'), false);
  const beforeShareRequests = app.requests.length;
  await el.shareDayButton.click();
  assert.match(el.sharePreview.value, /Easy ·/); assert.match(el.sharePreview.value, /Medium · 800\/800/);
  assert.ok(!el.sharePreview.value.includes('Hard ·'), 'Unfinished levels never enter a shared result');
  assert.deepEqual(app.requests.slice(beforeShareRequests).map(request => new URL(request.url, 'http://localhost').searchParams.get('difficulty')), ['easy', 'medium'], 'Sharing fetches only completed levels');
  app.fail(true); el.shareDialog.close(); await el.shareDayButton.click();
  assert.equal(el.sharePreview.value, ''); assert.equal(el.copyAnswersButton.disabled, true);
  assert.match(el.shareStatus.textContent, /Connection interrupted/);
  app.fail(false); el.shareDialog.close();
  await el.nextLevelButton.click(); assert.equal(app.call('difficulty'), 'hard');
  assert.equal(el.towerScore.textContent, 1200); assert.equal(el.answerFrame.classList.contains('hidden'), true);
  await solve('hard'); await el.lockButton.click(); await el.skipRevealButton.click();
  const total = easyPoints + 2000;
  assert.equal(el.dailyScore.textContent, total.toLocaleString()); assert.equal(el.dailyLevelProgress.textContent, '3/3 levels finished');
  assert.equal(el.nextLevelButton.classList.contains('hidden'), true);
  assert.match(el.resultCopy.textContent, new RegExp(total.toLocaleString()));
  assert.equal(el.towerLeaderboard.children.length, 1);
  assert.match(el.towerLeaderboard.children[0].children[1].children[0].textContent, /3\/3 levels/);
  assert.equal(el.shareLevelButton.textContent, 'Share Hard answers');
  await el.shareDayButton.click();
  const allAnswers = el.sharePreview.value;
  assert.ok(allAnswers.indexOf('Easy ·') < allAnswers.indexOf('Medium ·'));
  assert.ok(allAnswers.indexOf('Medium ·') < allAnswers.indexOf('Hard ·'));
  assert.ok(allAnswers.includes(`Today’s total: ${total.toLocaleString()}/2,600 points · 3/3 levels finished`));
  browserNavigator.share = async payload => nativeShares.push(payload);
  el.shareDialog.close(); await el.shareDayButton.click();
  assert.equal(el.nativeShareButton.classList.contains('hidden'), false);
  await el.nativeShareButton.click(); assert.equal(nativeShares[0].text, allAnswers);
  assert.equal(nativeShares[0].title, 'Trivia Tower · 2030-01-01');
  browserNavigator.share = async () => { const error = new Error('Cancelled'); error.name = 'AbortError'; throw error; };
  await el.nativeShareButton.click(); assert.equal(el.shareStatus.textContent, ''); assert.equal(el.nativeShareButton.disabled, false);
  browserNavigator.share = async () => { throw new Error('Not allowed'); };
  await el.nativeShareButton.click(); assert.match(el.shareStatus.textContent, /Use Copy answers/);
  browserNavigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
  await el.copyAnswersButton.click(); assert.equal(el.sharePreview.selected, true); assert.match(el.shareStatus.textContent, /Select the text above/);
  const pendingShare = el.shareDayButton.click();
  app.call('clearShare()'); await pendingShare;
  assert.equal(el.sharePreview.value, '', 'Closing a pending preview cannot bring old answers back');
  await el.difficultyPicker.children[0].click();
  assert.equal(app.call('state.finished'), true); assert.equal(app.call('revealing'), false);
  assert.equal(el.dailyScore.textContent, total.toLocaleString(), 'Revisiting a result cannot add its points again');
  assert.equal(app.animations.length, 6, 'Saved results do not replay animations');
  const savedPlayers = Object.fromEntries(Object.entries(app.fixtures).map(([id, level]) => [id, level.player]));
  const restored = await page({ storage: app.storage, savedPlayers });
  assert.equal(restored.elements.dailyScore.textContent, total.toLocaleString());
  assert.equal(restored.call('difficulty'), 'hard', 'A completed day restores its final result');
  await restored.elements.shareLevelButton.click(); assert.match(restored.elements.sharePreview.value, /Hard · 1,200\/1,200/);
  const legacy = await page({ storage: app.storage, savedPlayers, legacyCopy: true });
  await legacy.elements.shareLevelButton.click(); await legacy.elements.copyAnswersButton.click();
  assert.match(legacy.elements.shareStatus.textContent, /Answers copied/, 'Browsers without the Clipboard API can use the selected-text fallback');
  const freshDay = await page({ storage: new Map([['yappersPuzzleUserId','ui-player'],['triviaTowerDifficulty','hard']]) });
  assert.equal(freshDay.call('difficulty'), 'easy', 'A saved Hard preference cannot bypass the next day’s Easy level');
  assert.equal(freshDay.elements.dailyScore.textContent, '0'); assert.equal(freshDay.elements.difficultyPicker.children[1].disabled, true);
  app.emitLeaderboard({ game: 'tower', date: '2030-01-01', difficulty: 'hard', leaderboard: [
    { userId: 'ui-player', displayName: 'UI Player', score: total, correctPlacements: 12, completedLevels: 3, rank: 1 },
    { userId: 'other', displayName: 'Another player', score: 1000, correctPlacements: 7, completedLevels: 2, rank: 2 }
  ] });
  assert.equal(el.towerLeaderboard.children.length, 2, 'Combined live standings update while viewing a different level');

  await app.elements.shareDayButton.click();
  app.refreshContent(); await app.emitReset();
  assert.equal(el.shareDialog.open, false); assert.equal(el.sharePreview.value, '', 'A content reset clears any open share preview');
  assert.equal(app.call('state.puzzle.id'), 'wildlife-size'); assert.equal(app.call('difficulty'), 'easy');
  assert.equal(el.dailyScore.textContent, '0'); assert.equal(el.dailyLevelProgress.textContent, '0/3 levels finished');
  assert.equal(el.contentRefreshNotice.classList.contains('hidden'), false);
  assert.equal(el.answerFrame.classList.contains('hidden'), true);
  assert.equal(el.difficultyPicker.children[1].disabled, true); assert.equal(el.difficultyPicker.children[2].disabled, true);
  assert.equal(el.towerLeaderboard.children.length, 1, 'The old leaderboard is replaced with the empty-state row');
  await solve('easy'); await el.lockButton.click(); await el.skipRevealButton.click();
  assert.equal(el.dailyScore.textContent, '600');
  await app.emitReset();
  assert.equal(el.dailyScore.textContent, '600', 'Reconnecting with the same reset revision preserves newly earned points');

  const reduced = await page({ storage: new Map([['yappersPuzzleUserId', 'ui-player']]), reducedMotion: true });
  await reduced.elements.lockButton.click(); assert.equal(reduced.animations.length, 0);
  for (let count = 0; count < 6; count++) reduced.tick();
  assert.equal(reduced.call('revealedCount'), 6); assert.equal(reduced.call('revealing'), false);
  assert.equal(reduced.elements.nextLevelButton.textContent, 'Continue to Medium');
  console.log('Passed: rules, progression, cumulative reveals, single-level and combined answer sharing, submitted-order accuracy, clipboard and manual fallbacks, native sharing and cancellation, share failures, reset and restart recovery, standings, drafts, and reduced motion (DOM interaction checks).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
