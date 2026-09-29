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

Extract the ZIP first. `package.json`, `server.js`, `railway.json`, `public/`, `schedule.js`, `puzzles.js`, and `puzzles.json` must all be at the **repository root**, not under an extra folder.

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
- The 35 included puzzles supply seven days of unique five-puzzle sets. To extend the rotation, add entries to `puzzles.json`; 150 puzzles supply 30 days before the bank must cycle. Already selected IDs for previous dates remain fixed in the saved game data.
- Keep existing IDs stable and never remove a puzzle while an active day may still reference it. New entries automatically join the current rotation. The first upgraded day respects previously saved days when initializing the rotation. A repeated puzzle already published for the current day stays in place so players' current games do not change mid-day.

## Puzzle dataset

`puzzles.json` is the puzzle dataset. Each entry needs a unique lowercase ID, the rebus display as trusted HTML, and one or more accepted answers:

```json
{
  "id": "head-over-heels",
  "prompt": "<div class=\"stack huge\"><span>HEAD</span><span class=\"gap-lg\">HEELS</span></div>",
  "answers": ["head over heels"]
}
```

Place new entries inside the existing JSON array, separated by commas. IDs may contain lowercase letters, digits, and hyphens. Answers ignore capitalization, punctuation, and extra spaces. Add common reasonable answer variants to `answers`. Only include reviewed, trusted HTML in `prompt`; it is displayed directly in players' browsers. If your source is a CSV, spreadsheet, images, or a link to a puzzle collection, it needs conversion and answer review before adding it. For image puzzles, supply the image files and usage permission; the display template can then be adapted for images. Maintain at least 10 puzzles for five-puzzle days.

## Project files

```text
public/       Browser UI
puzzles.json  Editable rebus puzzle dataset
puzzles.js    Dataset loader and validation
schedule.js   Shared daily selection and rotation
server.js     Node server, scoring, daily state, leaderboard
railway.json  Railway start command and healthcheck
tests.js      Project and multiplayer smoke tests
data/         Local development data (the Railway volume stores production data)
```
