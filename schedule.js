const crypto = require('crypto');

// Every player shares a day's selection. The rotation is saved alongside the
// existing day records so a restart cannot reshuffle an in-progress game.
function initialRotation(days, ids) {
  const known = new Set(ids);
  const used = new Set();
  let lastDayKey = null;
  let previousDayIds = [];
  for (const key of Object.keys(days).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(days[key]?.puzzleIds)) continue;
    lastDayKey = key;
    previousDayIds = days[key].puzzleIds.filter(id => known.has(id));
    for (const id of previousDayIds) {
      used.add(id);
      if (used.size === ids.length) used.clear();
    }
  }
  return { knownIds: [...ids], remaining: ids.filter(id => !used.has(id)), lastDayKey, previousDayIds };
}

function ordered(ids, key) {
  return [...ids].sort((a, b) => {
    const hash = id => crypto.createHash('sha256').update(`${key}:${id}`).digest('hex');
    return hash(a).localeCompare(hash(b)) || a.localeCompare(b);
  });
}

function selectPuzzles(rotation, ids, key, count) {
  if (ids.length < count * 2) throw new Error(`At least ${count * 2} puzzles are needed to avoid consecutive-day repeats.`);
  const active = new Set(ids);
  const remaining = new Set(rotation.remaining.filter(id => active.has(id)));
  const previous = new Set(rotation.previousDayIds || []);
  // A newly added puzzle joins the current rotation without changing any old
  // day's already-published puzzle IDs.
  for (const id of ids) if (!rotation.knownIds.includes(id)) remaining.add(id);

  const selected = [];
  while (selected.length < count) {
    if (remaining.size === 0) for (const id of ids) if (!selected.includes(id)) remaining.add(id);
    const available = [...remaining].filter(id => !selected.includes(id));
    const fresh = available.filter(id => !previous.has(id));
    const choice = ordered(fresh.length ? fresh : available, `${key}:${selected.length}`)[0];
    if (!choice) throw new Error('Unable to select enough distinct puzzles.');
    selected.push(choice);
    remaining.delete(choice);
  }

  return {
    puzzleIds: selected,
    rotation: {
      knownIds: [...ids], remaining: [...remaining], lastDayKey: key,
      previousDayIds: selected
    }
  };
}

module.exports = { initialRotation, selectPuzzles };
