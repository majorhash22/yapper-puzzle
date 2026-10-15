const dataset = require('./rebus-puzzles.json');
const legacyPuzzles = require('./puzzles.json');
if (!Array.isArray(dataset.puzzles) || dataset.puzzles.length < 10) {
  throw new Error('rebus-puzzles.json must contain at least 10 puzzles.');
}
const puzzles = dataset.puzzles.map(puzzle => {
  if (!/^\/rebus\/[a-zA-Z0-9_-]+\.(png|gif|jpg)$/.test(puzzle.image)) {
    throw new Error(`Invalid Rebus image path: ${puzzle.image}`);
  }
  return {
    ...puzzle,
    prompt: `<div class="rebus-image-frame"><img class="rebus-image" src="${puzzle.image}" alt="Rebus puzzle: decode the words, symbols, and their arrangement." /></div>`
  };
});

const ids = new Set();
for (const puzzle of [...puzzles, ...legacyPuzzles]) {
  if (!puzzle || typeof puzzle.id !== 'string' || !/^[a-z0-9-]+$/.test(puzzle.id) || ids.has(puzzle.id)) {
    throw new Error(`Invalid or duplicate puzzle ID: ${puzzle?.id}`);
  }
  if (typeof puzzle.prompt !== 'string' || !puzzle.prompt.trim() ||
      !Array.isArray(puzzle.answers) || !puzzle.answers.length ||
      !puzzle.answers.every(answer => typeof answer === 'string' && answer.trim())) {
    throw new Error(`Puzzle ${puzzle.id} needs a prompt and one or more answers.`);
  }
  ids.add(puzzle.id);
}

module.exports = puzzles;
