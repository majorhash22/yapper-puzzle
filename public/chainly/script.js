// Each adjacent pair is a common phrase or compound word; a day's index is stable
// for everyone whose device shows the same local calendar date.
const puzzles = [
  {top:'SUN',answers:['FLOWER','POT','HOLE','PUNCH','LINE'],bottom:'DANCE'},
  {top:'STAR',answers:['FISH','TANK','TOP','SECRET','AGENT'],bottom:'ORANGE'},
  {top:'FOOT',answers:['BALL','PARK','BENCH','MARK','DOWN'],bottom:'TOWN'},
  {top:'KEY',answers:['BOARD','GAME','NIGHT','LIGHT','HOUSE'],bottom:'PLANT'},
  {top:'DAY',answers:['DREAM','TEAM','WORK','FORCE','FIELD'],bottom:'TRIP'},
  {top:'HEAD',answers:['LIGHT','HOUSE','BOAT','RIDE','SHARE'],bottom:'HOLDER'},
  {top:'NEWS',answers:['PAPER','CLIP','BOARD','ROOM','SERVICE'],bottom:'DOG'},
  {top:'TOOTH',answers:['BRUSH','FIRE','WORK','SHOP','FLOOR'],bottom:'PLAN'},
  {top:'MAIL',answers:['BOX','OFFICE','SPACE','BAR','CODE'],bottom:'NAME'},
  {top:'BACK',answers:['PACK','RAT','RACE','CAR','POOL'],bottom:'SIDE'},
  {top:'WATER',answers:['FALL','OUT','SIDE','WALK','WAY'],bottom:'STATION'},
  {top:'BRAIN',answers:['STORM','CLOUD','COVER','STORY','BOOK'],bottom:'CASE'},
  {top:'BLACK',answers:['BOARD','ROOM','SERVICE','DOG','HOUSE'],bottom:'PARTY'},
  {top:'SEA',answers:['FOOD','COURT','CASE','STUDY','HALL'],bottom:'PASS'},
  {top:'COFFEE',answers:['BREAK','DOWN','TOWN','HOUSE','PLANT'],bottom:'FOOD'},
  {top:'TABLE',answers:['TOP','SECRET','AGENT','ORANGE','JUICE'],bottom:'BOX'},
  {top:'ROCK',answers:['STAR','FISH','TANK','TOP','SECRET'],bottom:'AGENT'},
  {top:'BED',answers:['ROOM','SERVICE','DOG','HOUSE','PARTY'],bottom:'ANIMAL'},
  {top:'FIRE',answers:['FLY','PAPER','CUT','GLASS','HOUSE'],bottom:'PARTY'},
  {top:'BUTTER',answers:['FLY','TRAP','DOOR','BELL','BOTTOM'],bottom:'LINE'},
  {top:'BASE',answers:['BALL','ROOM','SERVICE','DOG','HOUSE'],bottom:'PARTY'},
  {top:'BOOK',answers:['MARK','DOWN','HILL','SIDE','WALK'],bottom:'WAY'},
  {top:'PLAY',answers:['GROUND','FLOOR','BOARD','GAME','NIGHT'],bottom:'LIGHT'},
  {top:'BREAK',answers:['FAST','FOOD','COURT','CASE','STUDY'],bottom:'HALL'},
  {top:'BLUE',answers:['BIRD','HOUSE','BOAT','RIDE','SHARE'],bottom:'HOLDER'},
  {top:'GOLD',answers:['FISH','BOWL','GAME','NIGHT','LIGHT'],bottom:'HOUSE'},
  {top:'CAT',answers:['FISH','MARKET','PLACE','SETTING','SUN'],bottom:'FLOWER'},
  {top:'DOG',answers:['HOUSE','PARTY','ANIMAL','SHELTER','BELT'],bottom:'BUCKLE'},
  {top:'ARM',answers:['CHAIR','LIFT','OFF','SHORE','LINE'],bottom:'DANCE'},
  {top:'STREET',answers:['LIGHT','YEAR','BOOK','CASE','STUDY'],bottom:'HALL'},
  {top:'NOTE',answers:['BOOK','CASE','STUDY','HALL','PASS'],bottom:'WORD'}
];

const START_DATE = '2026-09-29';
const PROGRESS_KEY = 'chainly.progress.v1';
const STATS_KEY = 'chainly.stats.v1';
const $ = id => document.getElementById(id);
const emptyStats = () => ({played:0,wins:0,streak:0,best:0,lastPlayed:null,distribution:{}});
const stored = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ } };
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dayNumber = date => { const [y,m,d] = date.split('-').map(Number); return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(2026,8,29))/86400000); };
const indexForDate = date => ((dayNumber(date) % puzzles.length) + puzzles.length) % puzzles.length;
const todayPuzzle = date => puzzles[indexForDate(date)];
const words = () => [puzzle.top,...puzzle.answers,puzzle.bottom];
let date = localDate();
let puzzle = todayPuzzle(date);
let progress;
let stats = {...emptyStats(),...(stored(STATS_KEY)||{})};
let input = '';
let lastFocused = null;
let lockedAnimation = -1;
let messageTimer;
let leaderboardUserId = '';
let leaderboardQueue = Promise.resolve();
const leaderboardAvailable = typeof location !== 'undefined' && location.protocol !== 'file:';

function sharedPlayerId() {
  try { return localStorage.getItem('yappersPuzzleUserId') || ''; } catch { return ''; }
}
function setSharedPlayerId(id) {
  try { localStorage.setItem('yappersPuzzleUserId', id); } catch { /* The daily game still works without storage. */ }
}
async function leaderboardApi(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Leaderboard unavailable.');
  return body;
}
function showLeaderboardPlayer(name) {
  $('leaderboardJoin').classList.add('hidden');
  $('leaderboardPlayer').classList.remove('hidden');
  $('leaderboardPlayer').textContent = `Playing as ${name}`;
  $('leaderboardStatus').textContent = '';
}
function renderLeaderboard(rows) {
  const root = $('leaderboard'); root.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = 'No scores yet. Be the first!'; root.append(empty); return;
  }
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = `leader-row${row.userId === leaderboardUserId ? ' you' : ''}`;
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = `#${row.rank}`;
    const name = document.createElement('span'); name.className = 'leader-name'; name.textContent = row.displayName;
    const detail = document.createElement('small'); detail.className = 'leader-sub';
    detail.textContent = row.status === 'won' ? 'Solved 5 / 5' : row.status === 'gave-up' ? 'Revealed' : `${row.solved} / 5 solved`;
    name.append(detail);
    const score = document.createElement('strong'); score.className = 'leader-score';
    score.textContent = row.status === 'gave-up' ? '—' : `${row.guesses} ${row.guesses === 1 ? 'guess' : 'guesses'}`;
    item.append(rank, name, score); root.append(item);
  }
}
async function refreshLeaderboard() {
  if (!leaderboardAvailable) return;
  try {
    const data = await leaderboardApi(`/api/chainly/leaderboard?date=${encodeURIComponent(date)}`);
    if (data.date === date) renderLeaderboard(data.leaderboard);
  } catch {
    $('leaderboardStatus').textContent = 'Live scores are temporarily unavailable.';
  }
}
// Leaderboard updates are queued in submission order. Network failures never
// block a guess, and the current saved result is submitted again on reload.
function syncLeaderboard() {
  if (!leaderboardAvailable || !leaderboardUserId) return;
  if (progress.playerId && progress.playerId !== leaderboardUserId) {
    $('leaderboardStatus').textContent = 'This chain is saved for a different player on this browser.';
    return;
  }
  progress.playerId = leaderboardUserId;
  save(PROGRESS_KEY, progress);
  const snapshot = {
    userId: leaderboardUserId, date, status: progress.status,
    guesses: progress.guesses, solved: progress.locked.filter(Boolean).length
  };
  leaderboardQueue = leaderboardQueue.catch(() => {}).then(async () => {
    const data = await leaderboardApi('/api/chainly/progress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot)
    });
    if (data.date === date) renderLeaderboard(data.leaderboard);
    $('leaderboardStatus').textContent = '';
  }).catch(() => { $('leaderboardStatus').textContent = 'Score sync pending. Refresh to retry.'; });
}
async function connectLeaderboard() {
  if (!leaderboardAvailable) {
    $('leaderboardJoin').classList.add('hidden');
    $('leaderboard').textContent = 'Live scores are available on the hosted Yappers Puzzle site.';
    return;
  }
  await refreshLeaderboard();
  const id = sharedPlayerId();
  if (id) {
    try {
      const menu = await leaderboardApi(`/api/menu?userId=${encodeURIComponent(id)}`);
      leaderboardUserId = id;
      showLeaderboardPlayer(menu.displayName);
      syncLeaderboard();
    } catch { $('leaderboardStatus').textContent = 'Enter your name to join the leaderboard.'; }
  }
  if (typeof EventSource !== 'undefined') {
    const events = new EventSource('/api/events');
    events.addEventListener('leaderboard', event => {
      try {
        const data = JSON.parse(event.data);
        if (data.game === 'chainly' && data.date === date) renderLeaderboard(data.leaderboard);
      } catch { /* Ignore an incomplete event. */ }
    });
  }
}

function freshProgress() { return {date,locked:[false,false,false,false,false],misses:[0,0,0,0,0],guesses:0,direction:'top',status:'playing'}; }
function restoreProgress() {
  const saved = stored(PROGRESS_KEY);
  if (saved?.date !== date || !Array.isArray(saved.locked) || saved.locked.length !== 5 ||
      !Array.isArray(saved.misses) || saved.misses.length !== 5 ||
      !saved.locked.every(v => typeof v === 'boolean') ||
      !saved.misses.every(v => Number.isInteger(v) && v >= 0) ||
      !Number.isInteger(saved.guesses) || saved.guesses < 0 ||
      !['playing','won','gave-up'].includes(saved.status)) return freshProgress();
  return {...saved,direction:saved.direction === 'bottom'?'bottom':'top'};
}
progress = restoreProgress();

function activeIndex(direction = progress.direction) {
  if (progress.status !== 'playing') return -1;
  if (direction === 'top') return progress.locked.findIndex(locked => !locked) + 1 || -1;
  const index = progress.locked.findLastIndex(locked => !locked);
  return index < 0 ? -1 : index + 1;
}
function hintCount(row) { return Math.min(progress.misses[row-1],words()[row].length); }
function showMessage(message) {
  clearTimeout(messageTimer); $('message').textContent = message;
  if (message) messageTimer = setTimeout(() => { $('message').textContent = ''; },2800);
}
function render() {
  const all = words();
  $('puzzleNumber').textContent = `PUZZLE #${dayNumber(date)+1}`;
  $('guessCount').textContent = progress.guesses;
  for (const direction of ['top','bottom']) {
    const button = $(`${direction}Direction`);
    button.setAttribute('aria-pressed',String(progress.direction === direction));
    button.disabled = progress.status !== 'playing';
  }
  $('giveUpButton').disabled = progress.status !== 'playing';
  $('giveUpButton').textContent = progress.status === 'playing'?'Give up / Reveal':'Today’s chain revealed';
  const board = $('board'); board.replaceChildren();
  for (let row = 0; row < 7; row++) {
    const anchor = row === 0 || row === 6;
    const locked = anchor || progress.locked[row-1];
    const active = row === activeIndex();
    const topCandidate = row === activeIndex('top');
    const bottomCandidate = row === activeIndex('bottom');
    const revealed = progress.status === 'gave-up';
    const hint = !anchor && !locked ? hintCount(row) : 0;
    const current = active ? input : '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `word-row${anchor?' anchor':''}${locked?' locked':''}${active?' active':''}${row === lockedAnimation?' just-locked':''}`;
    button.disabled = anchor || progress.status !== 'playing' || (!topCandidate && !bottomCandidate);
    button.setAttribute('aria-label',`Row ${row+1}: ${anchor?'given word '+all[row]:locked?'solved word '+all[row]:revealed?'revealed word '+all[row]:(active?'active ':'')+all[row].length+' letters'+(hint?', '+hint+' hinted':'')}`);
    button.setAttribute('aria-current',active?'step':'false');
    const meta = document.createElement('span'); meta.className='row-meta'; meta.textContent=anchor?'GIVEN':locked?'SOLVED':revealed?'REVEAL':active?'ACTIVE':`${all[row].length} LETTERS`;
    const tiles = document.createElement('span'); tiles.className='tiles'; tiles.setAttribute('aria-hidden','true');
    [...all[row]].forEach((letter,i) => {
      const tile = document.createElement('span'); tile.className='tile';
      if (locked || revealed) { tile.textContent=letter; tile.classList.add('filled'); }
      else if (i < hint) { tile.textContent=letter; tile.classList.add('hint'); }
      else if (i < current.length) { tile.textContent=current[i]; tile.classList.add('entered'); }
      tiles.append(tile);
    });
    const indicator = document.createElement('span'); indicator.className='row-indicator'; indicator.setAttribute('aria-hidden','true'); indicator.textContent=anchor?'◆':locked?'✓':active?(progress.direction==='top'?'↓':'↑'):'';
    button.append(meta,tiles,indicator);
    if (!button.disabled) button.addEventListener('click',() => selectDirection(bottomCandidate && (!topCandidate || progress.direction === 'top')?'bottom':'top'));
    board.append(button);
    if (row < 6) { const connector=document.createElement('span');connector.className='connector';connector.setAttribute('aria-hidden','true');connector.textContent='◇';board.append(connector); }
  }
  lockedAnimation=-1;
}

function selectDirection(direction) {
  if (progress.status !== 'playing' || (direction !== 'top' && direction !== 'bottom')) return;
  progress.direction=direction;
  const row=activeIndex();
  input=row>0?words()[row].slice(0,hintCount(row)):'';
  save(PROGRESS_KEY,progress); render();
  showMessage(direction==='top'?'Solving down from the top.':'Solving up from the bottom.');
}
function finish(status) {
  progress.status=status;
  const previous = stats.lastPlayed;
  const consecutive = previous && dayNumber(date)-dayNumber(previous) === 1;
  stats.played++; stats.lastPlayed=date;
  if (status==='won') {
    stats.wins++;
    stats.streak=consecutive?stats.streak+1:1;
    stats.best=Math.max(stats.best,stats.streak);
    stats.distribution[progress.guesses]=(stats.distribution[progress.guesses]||0)+1;
  } else stats.streak=0;
  save(PROGRESS_KEY,progress); save(STATS_KEY,stats); render(); syncLeaderboard(); openResults();
}
function submit() {
  const row=activeIndex(); if (row<0) return;
  const answer=words()[row];
  if (input.length !== answer.length) { showMessage(`This word needs ${answer.length} letters.`); return; }
  progress.guesses++;
  if (input.toUpperCase()===answer) {
    progress.locked[row-1]=true;
    lockedAnimation=row;
    input='';
    if (progress.locked.every(Boolean)) return finish('won');
    const next=activeIndex();
    input=words()[next].slice(0,hintCount(next));
    save(PROGRESS_KEY,progress);render();syncLeaderboard();showMessage(`${answer} connects!`);
  } else {
    progress.misses[row-1]++;
    input=answer.slice(0,hintCount(row));
    save(PROGRESS_KEY,progress);render();syncLeaderboard();showMessage('Not quite. One more letter revealed.');
    const active=$('board').querySelector('.word-row.active');
    active?.classList.add('shake');
  }
}
function handleKey(key) {
  if (progress.status!=='playing') return;
  if (key==='ArrowUp') return selectDirection('bottom');
  if (key==='ArrowDown') return selectDirection('top');
  if (key==='Enter') return submit();
  if (key==='Backspace') { const row=activeIndex();if(row>0) input=input.slice(0,Math.max(hintCount(row),input.length-1));render();return; }
  if (/^[a-z]$/i.test(key)) {
    const row=activeIndex(); if(row<0) return;
    if(input.length<words()[row].length) { input+=key.toUpperCase();render(); }
  }
}
function buildKeyboard() {
  for (const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']) {
    const group=document.createElement('div');group.className='key-row';
    const keys=row==='ZXCVBNM'?['ENTER',...row,'⌫']:[...row];
    for(const key of keys) {
      const button=document.createElement('button');button.type='button';button.className='key'+(key==='ENTER'?' action enter':key==='⌫'?' action':'');
      button.textContent=key;button.setAttribute('aria-label',key==='⌫'?'Backspace':key==='ENTER'?'Enter':key);
      button.addEventListener('click',()=>handleKey(key==='⌫'?'Backspace':key==='ENTER'?'Enter':key));group.append(button);
    }
    $('keyboard').append(group);
  }
}
function showModal(id) {
  lastFocused=document.activeElement;
  document.querySelectorAll('.overlay').forEach(el=>el.classList.add('hidden'));
  $(id).classList.remove('hidden');
  $(id).querySelector('button')?.focus();
}
function closeModal(modal) {
  modal.classList.add('hidden');
  if (lastFocused?.isConnected) lastFocused.focus();
}
function renderStats() {
  const activeStreak=stats.lastPlayed && dayNumber(date)-dayNumber(stats.lastPlayed)<=1 ? stats.streak : 0;
  const items=[[stats.played,'Played'],[stats.played?Math.round(100*stats.wins/stats.played)+'%':'0%','Win rate'],[activeStreak,'Streak'],[stats.best,'Best']];
  $('statsGrid').replaceChildren();
  for(const [value,label] of items){const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=value;const caption=document.createElement('span');caption.textContent=label;box.append(strong,caption);$('statsGrid').append(box);}
  const root=$('distribution');root.replaceChildren();
  const entries=Object.entries(stats.distribution).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(!entries.length){root.textContent='No completed chains yet.';return;}
  const max=Math.max(...entries.map(([,v])=>v));
  for(const [guesses,count] of entries){const row=document.createElement('div');row.className='distribution-row';const label=document.createElement('span');label.textContent=guesses;const bar=document.createElement('div');bar.className='distribution-bar';bar.style.width=`${Math.max(15,count/max*80)}%`;bar.textContent=count;row.append(label,bar);root.append(row);}
}
function rating() {return progress.guesses===5?'Perfect chain':progress.guesses<=7?'Brilliant':progress.guesses<=10?'Great work':'Chain complete';}
function shareText() {
  const icons=progress.misses.map(miss=>miss===0?'🟩':miss<=2?'🟨':'🟧');
  return `Chainly #${dayNumber(date)+1} · ${progress.guesses} guesses\n${icons.join('\n')}\n🔗 Chain complete`;
}
function updateCountdown() {
  if(progress.status==='playing') return;
  const now=new Date();const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const left=Math.max(0,Math.floor((next-now)/1000));
  $('countdown').textContent=[Math.floor(left/3600),Math.floor(left%3600/60),left%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function openResults() {
  const won=progress.status==='won';
  $('resultSymbol').textContent=won?'✦':'◇';
  $('resultEyebrow').textContent=won?'CHAIN COMPLETE':'CHAIN REVEALED';
  $('resultsTitle').textContent=won?rating():'See you tomorrow.';
  $('resultSummary').textContent=won?`You connected all five words in ${progress.guesses} guesses.`:`The full chain is on the board. ${progress.guesses} guesses submitted.`;
  const grid=$('shareGrid');grid.replaceChildren();
  if(won){progress.misses.forEach(miss=>{const line=document.createElement('div');line.textContent=miss===0?'🟩':miss<=2?'🟨':'🟧';grid.append(line);});}
  else { const line=document.createElement('div');line.textContent=words().join(' → ');line.style.whiteSpace='normal';line.style.fontSize='.82rem';grid.append(line); }
  $('shareButton').classList.toggle('hidden',!won);
  updateCountdown();showModal('resultsModal');
}
async function copyResult() {
  const content=shareText();let copied=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(content);copied=true;}}catch{}
  if(!copied){const field=document.createElement('textarea');field.value=content;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();try{copied=document.execCommand('copy');}catch{}field.remove();}
  $('shareButton').textContent=copied?'Copied!':'Copy unavailable';
  setTimeout(()=>$('shareButton').textContent='Copy result',2200);
}

$('topDirection').addEventListener('click',()=>selectDirection('top'));
$('bottomDirection').addEventListener('click',()=>selectDirection('bottom'));
$('helpButton').addEventListener('click',()=>showModal('helpModal'));
$('statsButton').addEventListener('click',()=>{renderStats();showModal('statsModal');});
$('resultStatsButton').addEventListener('click',()=>{renderStats();showModal('statsModal');});
$('giveUpButton').addEventListener('click',()=>showModal('confirmModal'));
$('keepPlaying').addEventListener('click',()=>closeModal($('confirmModal')));
$('confirmReveal').addEventListener('click',()=>finish('gave-up'));
$('shareButton').addEventListener('click',copyResult);
$('resultLeaderboardButton').addEventListener('click', () => {
  closeModal($('resultsModal'));
  $('leaderboardCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('leaderboardJoin').addEventListener('submit', async event => {
  event.preventDefault();
  if (!leaderboardAvailable) return;
  const name = $('leaderboardName').value.trim();
  if (name.length < 2) return;
  $('leaderboardStatus').textContent = 'Joining…';
  try {
    const data = await leaderboardApi('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name })
    });
    leaderboardUserId = data.userId;
    setSharedPlayerId(data.userId);
    showLeaderboardPlayer(data.menu.displayName);
    syncLeaderboard();
  } catch (error) { $('leaderboardStatus').textContent = error.message; }
});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal(button.closest('.overlay'))));
document.querySelectorAll('.overlay').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal && modal.id!=='confirmModal')closeModal(modal);}));
document.addEventListener('keydown',event=>{
  const modal=document.querySelector('.overlay:not(.hidden)');
  if(modal){
    if(event.key==='Escape')closeModal(modal);
    if(event.key==='Tab'){
      const controls=[...modal.querySelectorAll('button:not([disabled])')];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
    return;
  }
  if(event.key==='Enter' && event.target instanceof HTMLElement && event.target.matches('button,a'))return;
  if(['ArrowUp','ArrowDown','Backspace','Enter'].includes(event.key)||/^[a-z]$/i.test(event.key)){
    if(event.ctrlKey||event.metaKey||event.altKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
    event.preventDefault();handleKey(event.key);
  }
});
buildKeyboard();render();
if(progress.status!=='playing')openResults();
connectLeaderboard();
setInterval(()=>{
  if(localDate()!==date){date=localDate();puzzle=todayPuzzle(date);progress=restoreProgress();input='';document.querySelectorAll('.overlay').forEach(el=>el.classList.add('hidden'));render();refreshLeaderboard();syncLeaderboard();showMessage('A new daily chain is ready!');}
  updateCountdown();
},1000);
