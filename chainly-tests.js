const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Small DOM shim exercises the real browser script without adding dependencies.
function page(storage = new Map()) {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {};
      this.listeners = {}; this.style = {}; this.textContent = ''; this.disabled = false;
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
      };
      Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); } });
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    focus() {}
    querySelector(selector) { return selector === '.word-row.active' ? this.children.find(child => child.classList.contains('active')) : this.children.find(child => child.tagName === 'BUTTON'); }
    click() { for (const handler of this.listeners.click || []) handler({ target: this }); }
  }
  const ids = ['puzzleNumber','guessCount','topDirection','bottomDirection','giveUpButton','board','message','keyboard',
    'helpButton','statsButton','resultStatsButton','resultLeaderboardButton','keepPlaying','confirmReveal','shareButton','statsGrid',
    'distribution','resultSymbol','resultEyebrow','resultsTitle','resultSummary','shareGrid','countdown',
    'helpModal','statsModal','resultsModal','confirmModal','leaderboardJoin','leaderboard',
    'leaderboardStatus','leaderboardPlayer','leaderboardName','leaderboardCard'];
  const elements = Object.fromEntries(ids.map(id => [id,new Element()]));
  const overlays = ['helpModal','statsModal','resultsModal','confirmModal'].map(id => elements[id]);
  overlays.forEach(el => el.classList.add('hidden'));
  const document = {
    activeElement: new Element('body'),
    getElementById: id => elements[id],
    createElement: tag => new Element(tag),
    querySelectorAll: selector => selector === '.overlay' ? overlays : [],
    addEventListener() {}
  };
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key,value) => storage.set(key,value)
  };
  const context = vm.createContext({document,localStorage,Date,Math,JSON,Number,String,Object,Array,
    navigator:{},setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,HTMLInputElement:class {},HTMLTextAreaElement:class {},HTMLElement:Element});
  const code = fs.readFileSync(require('node:path').join(__dirname,'public/chainly/script.js'),'utf8');
  vm.runInContext(code,context);
  const call = expression => vm.runInContext(expression,context);
  return {call,elements,storage};
}

const storage = new Map();
let app = page(storage);
assert.equal(app.call('words().length'),7);
assert.equal(app.call('activeIndex()'),1);
app.call("handleKey('Enter')");
assert.equal(app.call('progress.guesses'),0,'Short submissions must not count');
const first = app.call('words()[1]');
app.call(`input=${JSON.stringify('Z'.repeat(first.length))}; submit()`);
assert.equal(app.call('progress.guesses'),1);
assert.equal(app.call('progress.misses[0]'),1);
assert.equal(app.call('input'),first[0],'Wrong guess must reveal the first letter');
app.call("selectDirection('bottom')");
assert.equal(app.call('activeIndex()'),5);
assert.equal(app.call('progress.guesses'),1);
app = page(storage);
assert.equal(app.call('progress.misses[0]'),1,'Hints survive refresh');
assert.equal(app.call('progress.direction'),'bottom','Direction survives refresh');
for (const index of [5,4,3,2,1]) app.call(`input=words()[${index}]; submit()`);
assert.equal(app.call('progress.status'),'won');
assert.equal(app.call('progress.guesses'),6);
assert.equal(app.call('stats.played'),1);
assert.equal(app.call('stats.wins'),1);
assert.equal(app.call('stats.streak'),1);
app = page(storage);
assert.equal(app.call('progress.status'),'won');
assert.equal(app.call('stats.played'),1,'Reloading results must not duplicate statistics');

const second = page(new Map());
second.elements.confirmReveal.click();
assert.equal(second.call('progress.status'),'gave-up');
assert.equal(second.call('stats.streak'),0);
assert.equal(second.call('stats.wins'),0);
console.log('Passed: Chainly wrong-length validation, hints, bidirectional solving, refresh persistence, win/streak stats, and give up.');
