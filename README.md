# Yappers Puzzle

A browser based daily rebus game for multiple players. Each day, everyone gets the same five puzzles and shares a live leaderboard. Players must answer the current puzzle or press **Give Up** before continuing. A skipped puzzle earns zero points. No timer is displayed.

## Quick start

Requires Node.js 18 or newer. There are no third-party packages to install.

```bash
npm test
npm start
```

Open <http://localhost:3000>. Use separate browsers or a private window to test two players. Local game data is stored in `data/game-data.json` and is ignored by Git.

## Put it on GitHub

Extract the ZIP first. `package.json`, `server.js`, `railway.json`, `public/`, and `puzzles.js` must all be at the **repository root**, not under an extra folder.

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
- To add puzzles, edit `puzzles.js`. Keep every puzzle ID unique. Already selected IDs for previous dates are stored with that day's progress.

## Project files

```text
public/       Browser UI
puzzles.js    Rebus puzzle bank
server.js     Node server, scoring, daily state, leaderboard
railway.json  Railway start command and healthcheck
tests.js      Project and multiplayer smoke tests
data/         Local development data (the Railway volume stores production data)
```
