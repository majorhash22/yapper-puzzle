const puzzles = require('./chain-puzzles.json');

if (!Array.isArray(puzzles) || puzzles.length < 10) {
  throw new Error('chain-puzzles.json must contain at least 10 puzzles.');
}

const ids = new Set();
const signatures = new Set();

for (const puzzle of puzzles) {
  if (!puzzle || typeof puzzle.id !== 'string' || !/^[a-z0-9-]+$/.test(puzzle.id) || ids.has(puzzle.id)) {
    throw new Error(`Invalid or duplicate Chain Reaction puzzle ID: ${puzzle?.id}`);
  }
  if (!Array.isArray(puzzle.words) || puzzle.words.length !== 4 ||
      !puzzle.words.every(word => typeof word === 'string' && word.trim())) {
    throw new Error(`Chain Reaction puzzle ${puzzle.id} must contain exactly four words.`);
  }

  const signature = puzzle.words.map(word => word.trim().toLowerCase()).join('|');
  if (signatures.has(signature)) {
    throw new Error(`Duplicate Chain Reaction puzzle: ${puzzle.id}`);
  }

  ids.add(puzzle.id);
  signatures.add(signature);
}

module.exports = puzzles;
