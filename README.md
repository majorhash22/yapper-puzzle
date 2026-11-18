# Yappers Puzzle

## Trivia Tower daily rankings

Open `/tower/index.html` from the game menu. A rules popup explains ranking, controls, the single submission, and scoring before play; **How to play** reopens it. Choose **Easy, Medium, or Hard**, each with a different shared daily six-item question and shuffle, using the existing `APP_TIMEZONE` reset and player account. During play, only the player's tower is visible. On successful lock-in, it slides up and left and the answer tower slides in on the right. The least/smallest/earliest item belongs at the bottom (position 1); the most/largest/latest belongs at the top (position 6).

Players can drag rows, tap the up/down buttons, or focus a row and press the arrow keys. Drafts save in this browser separately for each player and daily question. **Lock in** submits the entire order once per level per day. Every exact placement earns **100 points on Easy**, **150 on Medium**, or **200 on Hard**, independently of other placements. Level maximums are **600, 900, and 1,200**, for up to **2,700 daily points**. Time never affects scoring. Answers reveal bottom to top, with a 1.2-second pause between placements. Each step marks the matching row and updates the running score. The summary, reference links, and that level's leaderboard appear after the last row. **Show all answers** skips the suspense; reopening a completed level shows its saved result immediately. Reduced-motion preferences disable movement while retaining the ordered reveal. The server chooses scoring, validates all six item IDs and the selected difficulty, rejects stale days, and preserves locked results across refreshes and restarts. Each level has its own live leaderboard; equal scores share a rank. The game menu totals progress across all three levels.

The bank contains **300 distinct authored questions: the original 100 plus 200 in `trivia-tower-extra-puzzles.js`**, with **100 at each difficulty**. Every question has a distinct six-item set, six different ordering values, and reference links. Measurements, release regions, and approximate quantities have explicit conventions. Both files stay server-side; answer values and answer-order IDs are private until submission. Item IDs are label hashes rather than position numbers. Gameplay requires no external trivia service or API key.

**Questions never repeat.** `towerDays` in the persistent game-data file records every published question ID, shuffle, difficulty, scoring rate, and submitted score. Selection draws only from unused questions in the chosen difficulty and checks history across every level. A fresh bank provides **100 days with all three levels**; existing used questions reduce the remaining supply. An exhausted level shows a message and lets the player choose another level. Add questions with new stable IDs to resume on the next unpublished daily selection. Keep the persistent volume and its history when deploying.

Previously published single-tower days remain the Medium challenge with their original question, shuffle, saved results, and **100 points per placement**. New Medium days use 150 points per placement. Existing history is retained when adding the expansion pack; previously used questions cannot return under another difficulty.

`tower-tests.js` checks all 300 questions, the 200-question expansion, 100 questions per level, distinct item sets, complete nonrepeating selection, exhaustion and additions, private answers, difficulty scoring, separate immutable attempts and leaderboards, legacy preservation, invalid and stale requests, live updates, shared daily state, and restart persistence. `tower-ui-tests.js` exercises the real browser script with a DOM shim for the rules popup, drafts, moves, level switching, submission recovery, tower visibility and animation calls, ordered reveals, and reduced motion. These interaction checks do not verify browser rendering. Both run as part of `npm test` alongside Rebus and Chainly checks.

## Chainly daily word chain

The menu opens `public/chainly/index.html` for a seven-word puzzle each local calendar day. Its five hidden words, hints, keyboard controls, and guess count are stored in the browser. The daily leaderboard uses the same player names, persistent Railway volume, and live updates as Rebus. Solved chains rank by fewest guesses; revealed chains appear last. Players can join from Chainly or reuse their Rebus name. Network trouble does not interrupt the puzzle, and refreshing retries the locally saved result. The legacy Chain Reaction API and saved data remain available for compatibility.

A browser based daily rebus game for multiple players. Each day, everyone gets the same five puzzles and shares a live leaderboard. Players must answer the current puzzle or press **Give Up** before continuing. A skipped puzzle earns zero points. No timer is displayed. The server rotates through unused puzzles before reusing them, and avoids serving yesterday's puzzles again the next day.

## Quick start

Requires Node.js 18 or newer. There are no third-party packages to install.

```bash
npm test
npm start
```

Open <http://localhost:3000>. Use separate browsers or a private window to test two players. Local game data is stored in `data/game-data.json` and is ignored by Git.

## Put it on GitHub

Extract the ZIP first. Keep the project files at the **repository root**, not under an extra folder. Include `rebus-puzzles.json` and the complete `public/rebus/` image directory when deploying; `puzzles.json` is still needed for saved games from before the dataset upgrade.

In VS Code, open the extracted `yappers-puzzle` folder and open its terminal. Create an empty GitHub repository named `yappers-puzzle`, then run (replace `YOUR_USERNAME`):

```bash
git init
git add .
git commit -m "Deploy Yappers Puzzle"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/yappers-puzzle.git
git push -u origin main
```

If the repository already exists, copy the extracted files into your existing clone, then run `git add .`, `git commit -m "Update Yappers Puzzle"`, and `git push` there. Do not commit `data/game-data.json`.

## Deploy on Railway

1. In Railway, create a project and add a service from your **GitHub repository** (`main` branch). Give Railway access to that repository if asked.
2. Attach a **persistent volume** to the game service with mount path **`/app/data`**. This is required before the deployment can start successfully. If Railway starts deploying immediately, attach the volume and redeploy. The app reads Railway's volume path automatically; you do not need to add a database or set a storage variable.
3. In the service's **Settings → Networking**, generate a public domain. Open the URL and test with two separate browser sessions.
4. Check `/api/health` on your new domain for an `ok: true` response. Future pushes to the connected GitHub branch redeploy the service automatically.

`railway.json` supplies the start command and healthcheck path. Railway supplies `PORT`; the server listens on `0.0.0.0`. Keep **one service instance** for this JSON and volume storage model. The app intentionally exits on Railway if the volume is missing, so a redeploy cannot silently erase players' progress. Railway deployments with a volume can briefly interrupt service during updates.

**GitHub Pages cannot host this app by itself** because scoring, saved progress, and the shared leaderboard require the running Node server. GitHub stores the code; Railway serves the game.

## Settings and rules

- The daily reset uses `America/Regina` by default. To change it, set `APP_TIMEZONE` in Railway's service variables to a valid IANA timezone, such as `America/Edmonton`.
- Each Rebus puzzle starts at 1,000 points. Each wrong guess costs 100 points; a correct answer always earns at least 100. Give Up scores zero. Maximum daily score is 5,000. The legacy Chain Reaction API uses the same rules.
- Time never affects points or leaderboard ranks. Wrong guesses persist across page refreshes and server restarts. Equal scores, solved counts, and completion counts share a rank. Blank or punctuation-only submissions do not count as guesses.
- Existing published days move to the new scoring rules when loaded. Previously solved puzzles receive 1,000 points and skipped puzzles stay at zero, because older saves did not record wrong guesses. Puzzle selections and progress are preserved; historical days remain unchanged unless loaded.
- The server stores player and daily game data in `game-data.json` on the attached volume. Enable Railway volume backups if you need recoverable history. A corrupt data file causes startup to fail rather than resetting scores.
- Each browser keeps a random player ID in local storage. This is suitable for a friendly game; it is not a secure login or a cheat resistant competition.
- Rebus deters ordinary image copying and saving: its puzzle area disables selection, dragging, the context menu, and supported mobile image callouts. Copy/cut operations involving the clue and save/print shortcuts are blocked while a Rebus puzzle is open, and clues are hidden in printed output. Answer input editing and Chainly retain their normal behavior. These browser controls cannot prevent screenshots, external capture tools, browser overrides, or downloading an image through developer tools.
- New Rebus days use 743 original image puzzles from the Re-Bus dataset. This supplies 148 complete five-puzzle days before the bank cycles during day 149. Augmented versions are excluded to avoid replaying the same clue with a different background. Already selected IDs for previous dates remain fixed in the saved game data.
- Keep existing IDs stable and never remove a puzzle while an active day may still reference it. New entries automatically join the current rotation. The first upgraded day respects previously saved days when initializing the rotation. A repeated puzzle already published for the current day stays in place so players' current games do not change mid-day.

## Puzzle dataset

Rebus uses a bundled snapshot of [TrishanuDas/rebus-dataset](https://huggingface.co/datasets/TrishanuDas/rebus-dataset), pinned to revision `12233c6790bb2edc929ad7822ae428483b5c842a`. `rebus-puzzles.json` contains the converted entries and provenance; `public/rebus/` contains all 743 original images (about 8.9 MB). Gameplay needs no Hugging Face account, API token, or external image requests.

The importer reads `RebusPuzzlesFullDataset.csv`, selects only non-augmented rows, verifies each image against the repository's SHA-256 checksum, and preserves the source and difficulty. Pipe-separated answers become accepted variants. Explanatory notes are removed from answer text, with explicit corrections for ambiguous annotations. Answers remain server-side until Give Up reveals one.

To reproduce the bundled snapshot, run:

```bash
npm run import:rebus
npm test
```

This command needs internet access, reuses images with matching checksums, and writes the puzzle bank only after every image is available. To deliberately update the upstream version, change `REVISION` in `scripts/import-rebus.js` and review the resulting changes. Keep existing IDs stable while saved days reference them.

Each converted entry under `puzzles` has this shape:

```json
{
  "id": "rebus-dataset-1-4",
  "image": "/rebus/1_4.png",
  "answers": ["Travel overseas", "overseas travel"],
  "difficulty": "easy",
  "source": "https://eslvault.com/free-printable-rebus-puzzles/",
  "sha256": "<upstream image checksum>"
}
```

`puzzles.js` builds the image display template from validated local paths. Rebus answers ignore capitalization, accents, punctuation, and all spacing: `robinhood`, `Robin Hood`, and `robin-hood` are equivalent. Close spelling mistakes receive a gentle hint without revealing the answer; they still count as wrong guesses. A successful solve shows the canonical answer. The original 35 HTML puzzles remain in `puzzles.json` only for previously published days; they are excluded from new daily selections. An in-progress day keeps its original puzzles after upgrading, and the next new day uses the dataset.

Dataset attribution, licensing notes, the Apache-2.0 text, and the original dataset card are preserved in [`datasets/rebus/`](datasets/rebus/NOTICE.md).

## Project files

```text
public/       Browser UI
rebus-puzzles.json  Pinned Re-Bus puzzle bank and provenance
public/rebus/      Bundled original puzzle images
puzzles.json  Legacy rebus puzzles for saved days
puzzles.js    Dataset loader and validation
scripts/import-rebus.js  Reproduce the Re-Bus import
datasets/rebus/    Dataset attribution and upstream license information
schedule.js   Shared daily selection and rotation
server.js     Node server, scoring, daily state, leaderboard
railway.json  Railway start command and healthcheck
tests.js      Project and multiplayer smoke tests
data/         Local development data (the Railway volume stores production data)
```
