const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATASET = 'TrishanuDas/rebus-dataset';
const REVISION = '12233c6790bb2edc929ad7822ae428483b5c842a';
const SOURCE_FILE = 'RebusPuzzlesFullDataset.csv';
const ROOT = path.join(__dirname, '..');
const BASE = `https://huggingface.co/datasets/${DATASET}/resolve/${REVISION}`;

// CSV fields can contain commas, escaped quotes, and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(field);
      field = '';
      if (char !== ',') {
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  if (!headers || !['img_url', 'answer', 'is_augmented'].every(name => headers.includes(name))) {
    throw new Error('Dataset CSV is missing required columns.');
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Invalid CSV row ${index + 2}.`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i].trim()]));
  });
}

// These source annotations mix answers with explanations or alternate readings.
const ANSWER_OVERRIDES = {
  'puzzle10.gif': ['Paradise', 'Pair of dice'],
  'puzzle53.gif': ['H2O', 'Water', 'H to O'],
  'puzzle59.gif': ['I before E except after C', 'Eye before E except after see'],
  'puzzle56.gif': ['Too wise you are, too wise you be, I see you are too wise for me'],
  'puzzle162.gif': ['Waterfall', 'Water fall', 'Drop of water'],
  'puzzle176.gif': ['H2O', 'H20', 'Water', 'H to O'],
  'puz14.gif': ['Once upon a time', "One's upon a time"],
  'puz90.gif': ['Time after time', 'Double time'],
  'puz118.gif': ['Domino', 'Dominoe'],
  'puz120.gif': ['You are out of line', 'Right you are']
};

function answersFor(row, filename) {
  const answers = ANSWER_OVERRIDES[filename] || row.answer.split('|').map(answer => answer
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/\s+([!.,?])/g, '$1')
    .replace(/\s+/g, ' ').trim());
  const seen = new Set();
  return answers.filter(answer => {
    const key = answer.toLowerCase();
    if (!answer || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

async function importDataset() {
  const csv = await download(`${BASE}/${SOURCE_FILE}`);
  const rows = parseCsv(csv.toString('utf8'));
  const originalRows = rows.filter(row => row.is_augmented.toLowerCase() === 'false');
  if (originalRows.length < 10) throw new Error('The dataset must supply at least 10 original puzzles.');
  const files = JSON.parse(await download(`https://huggingface.co/api/datasets/${DATASET}/tree/${REVISION}/images?limit=1000`));
  const checksums = new Map(files.map(file => [path.posix.basename(file.path), file.lfs?.oid]));
  const imageDir = path.join(ROOT, 'public', 'rebus');
  fs.mkdirSync(imageDir, { recursive: true });
  const ids = new Set();
  const puzzles = originalRows.map(row => {
    const filename = new URL(row.img_url).pathname.split('/').pop();
    if (!/^[a-zA-Z0-9_-]+\.(png|gif|jpg)$/.test(filename) || !checksums.get(filename)) {
      throw new Error(`Invalid or missing dataset image: ${row.img_url}`);
    }
    const id = `rebus-dataset-${filename.replace(/\.[^.]+$/, '').replace(/_/g, '-').toLowerCase()}`;
    const answers = answersFor(row, filename);
    if (ids.has(id) || !answers.length) throw new Error(`Duplicate ID or missing answers: ${id}`);
    ids.add(id);
    const source = new URL(row.source);
    if (!['https:', 'http:'].includes(source.protocol)) throw new Error(`Invalid puzzle source: ${row.source}`);
    return {
      id, image: `/rebus/${filename}`, answers,
      difficulty: row.Difficulty.toLowerCase() || null,
      source: source.href, sha256: checksums.get(filename)
    };
  });

  let next = 0, complete = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < puzzles.length) {
      const puzzle = puzzles[next++];
      const filename = path.posix.basename(puzzle.image);
      const target = path.join(imageDir, filename);
      if (!fs.existsSync(target) || sha256(fs.readFileSync(target)) !== puzzle.sha256) {
        const bytes = await download(`${BASE}/images/${filename}`);
        if (sha256(bytes) !== puzzle.sha256) throw new Error(`Image checksum mismatch: ${filename}`);
        fs.writeFileSync(target, bytes);
      }
      complete++;
      if (complete % 100 === 0) console.log(`Imported ${complete}/${puzzles.length} images.`);
    }
  }));

  const attributionDir = path.join(ROOT, 'datasets', 'rebus');
  fs.mkdirSync(attributionDir, { recursive: true });
  fs.writeFileSync(path.join(attributionDir, 'README.upstream.md'), await download(`${BASE}/README.md`));
  fs.writeFileSync(path.join(ROOT, 'rebus-puzzles.json'), JSON.stringify({
    dataset: DATASET, revision: REVISION, sourceFile: SOURCE_FILE,
    sourceSha256: sha256(csv), sourceRows: rows.length,
    selection: 'Original images only; augmented versions are excluded.', puzzles
  }, null, 2) + '\n');
  console.log(`Imported ${puzzles.length} original Rebus puzzles from ${DATASET}@${REVISION}.`);
}

if (require.main === module) importDataset().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { parseCsv, answersFor };
