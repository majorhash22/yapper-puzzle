const puzzles = require('./puzzles.json');

if (!Array.isArray(puzzles) || puzzles.length < 10) {
  throw new Error('puzzles.json must contain at least 10 puzzles.');
}
const ids = new Set();
for (const puzzle of puzzles) {
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
