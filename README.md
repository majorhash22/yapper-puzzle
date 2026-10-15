# Yappers Puzzle

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
- Scores start at 1,000 and drop by 10 points per second; a correct answer never scores less than 100. Give Up scores zero. Maximum daily score is 5,000.
- The score timer starts when a puzzle is first delivered and survives page refreshes. The UI does not show elapsed time.
- The server stores player and daily game data in `game-data.json` on the attached volume. Enable Railway volume backups if you need recoverable history. A corrupt data file causes startup to fail rather than resetting scores.
- Each browser keeps a random player ID in local storage. This is suitable for a friendly game; it is not a secure login or a cheat resistant competition.
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

`puzzles.js` builds the image display template from validated local paths. Answers ignore capitalization, punctuation, and extra spaces. The original 35 HTML puzzles remain in `puzzles.json` only for previously published days; they are excluded from new daily selections. An in-progress day keeps its original puzzles after upgrading, and the next new day uses the dataset.

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
