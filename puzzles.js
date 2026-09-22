const puzzles = [
  {
    id: 'head-over-heels',
    prompt: '<div class="stack huge"><span>HEAD</span><span class="gap-lg">HEELS</span></div>',
    answers: ['head over heels']
  },
  {
    id: 'i-understand',
    prompt: '<div class="stack huge"><span>STAND</span><span class="small-gap">I</span></div>',
    answers: ['i understand', 'understand']
  },
  {
    id: 'mind-over-matter',
    prompt: '<div class="stack huge"><span>MIND</span><span class="gap-lg">MATTER</span></div>',
    answers: ['mind over matter']
  },
  {
    id: 'split-decision',
    prompt: '<div class="huge tracking">DECI&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SION</div>',
    answers: ['split decision']
  },
  {
    id: 'cycle-cycle-cycle',
    prompt: '<div class="huge">CYCLE&nbsp;&nbsp;CYCLE&nbsp;&nbsp;CYCLE</div>',
    answers: ['tricycle', 'tri cycle']
  },
  {
    id: 'reading-between-lines',
    prompt: '<div class="line"></div><div class="huge pad-y">READING</div><div class="line"></div>',
    answers: ['reading between the lines', 'read between the lines']
  },
  {
    id: 'just-between-you-me',
    prompt: '<div class="huge spaced"><span>YOU</span><span>JUST</span><span>ME</span></div>',
    answers: ['just between you and me', 'between you and me']
  },
  {
    id: 'backward-glance',
    prompt: '<div class="huge mirror">GLANCE</div>',
    answers: ['backward glance', 'a backward glance']
  },
  {
    id: 'man-overboard',
    prompt: '<div class="stack huge"><span>MAN</span><span class="board">BOARD</span></div>',
    answers: ['man overboard']
  },
  {
    id: 'life-after-death',
    prompt: '<div class="huge spaced"><span>DEATH</span><span>LIFE</span></div>',
    answers: ['life after death']
  },
  {
    id: 'broken-heart',
    prompt: '<div class="huge tracking">HEA&nbsp;&nbsp;&nbsp;&nbsp;RT</div>',
    answers: ['broken heart', 'a broken heart']
  },
  {
    id: 'long-time-no-see',
    prompt: '<div class="huge">TIME <span class="wide-space"></span> TIME</div><div class="caption">NO C</div>',
    answers: ['long time no see']
  },
  {
    id: 'stand-in-line',
    prompt: '<div class="huge">L I N <span class="boxed">STAND</span> E</div>',
    answers: ['stand in line', 'standing in line']
  },
  {
    id: 'top-secret',
    prompt: '<div class="stack huge"><span>SECRET</span><span class="top-label">TOP</span></div>',
    answers: ['top secret']
  },
  {
    id: 'middle-of-nowhere',
    prompt: '<div class="huge">NOW<span class="boxed">HERE</span></div>',
    answers: ['middle of nowhere', 'in the middle of nowhere']
  },
  {
    id: 'once-in-blue-moon',
    prompt: '<div class="moon"><span>ONCE</span></div>',
    answers: ['once in a blue moon']
  },
  {
    id: 'double-cross',
    prompt: '<div class="huge stack"><span>CROSS</span><span>CROSS</span></div>',
    answers: ['double cross', 'double-cross']
  },
  {
    id: 'crossroads',
    prompt: '<div class="crossroads"><span>ROAD</span><span>ROAD</span></div>',
    answers: ['crossroads', 'cross roads']
  },
  {
    id: 'small-talk',
    prompt: '<div class="tiny-word">TALK</div>',
    answers: ['small talk']
  },
  {
    id: 'big-deal',
    prompt: '<div class="mega">DEAL</div>',
    answers: ['big deal']
  },
  {
    id: 'mixed-feelings',
    prompt: '<div class="huge scramble">F E E L I N G S</div>',
    answers: ['mixed feelings']
  },
  {
    id: 'upside-down',
    prompt: '<div class="huge upside">DOWN</div>',
    answers: ['upside down']
  },
  {
    id: 'down-town',
    prompt: '<div class="stack huge"><span>T</span><span>O</span><span>W</span><span>N</span></div>',
    answers: ['downtown', 'down town']
  },
  {
    id: 'right-between-eyes',
    prompt: '<div class="huge spaced"><span>EYE</span><span>RIGHT</span><span>EYE</span></div>',
    answers: ['right between the eyes']
  },
  {
    id: 'two-left-feet',
    prompt: '<div class="huge">LEFT FOOT&nbsp;&nbsp;&nbsp;LEFT FOOT</div>',
    answers: ['two left feet', 'two left feet']
  },
  {
    id: 'water-under-bridge',
    prompt: '<div class="stack huge"><span class="bridge">BRIDGE</span><span class="water">WATER WATER WATER</span></div>',
    answers: ['water under the bridge']
  },
  {
    id: 'high-five',
    prompt: '<div class="huge high-word">5</div>',
    answers: ['high five', 'high 5']
  },
  {
    id: 'low-profile',
    prompt: '<div class="huge low-word">PROFILE</div>',
    answers: ['low profile']
  },
  {
    id: 'falling-in-love',
    prompt: '<div class="falling-love"><span>L</span><span>O</span><span>V</span><span>E</span></div>',
    answers: ['falling in love']
  },
  {
    id: 'missing-link',
    prompt: '<div class="huge">L I N <span class="missing">?</span></div>',
    answers: ['missing link', 'the missing link']
  },
  {
    id: 'half-baked',
    prompt: '<div class="huge half">BAKED</div>',
    answers: ['half baked', 'half-baked']
  },
  {
    id: 'first-aid',
    prompt: '<div class="huge">AID <sup>1st</sup></div>',
    answers: ['first aid']
  },
  {
    id: 'neon-lights',
    prompt: '<div class="huge spaced"><span>NE</span><span>ON</span></div>',
    answers: ['neon lights', 'neon light']
  },
  {
    id: 'long-distance',
    prompt: '<div class="huge"><span>DIST</span><span class="wide-space"></span><span>ANCE</span></div>',
    answers: ['long distance']
  },
  {
    id: 'forever-and-ever',
    prompt: '<div class="huge">EVER&nbsp;&nbsp;4&nbsp;&nbsp;EVER</div>',
    answers: ['forever and ever', 'for ever and ever']
  }
];

module.exports = puzzles;
