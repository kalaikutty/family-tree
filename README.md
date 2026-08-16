# Family Tree

A private, local family tree app: view an interactive tree and add/delete
family members (name, relationship type, and which existing person they're
related to). Data lives in [`data.json`](data.json) in this **private** repo.

## How it works

- A tiny local Node server (`server.js`) serves the static app
  (`index.html` + `style.css` + `app.js`) and saves changes.
- **No tokens, no Settings screen.** When you add or delete a member, the
  browser posts the updated tree to the local server, which writes
  `data.json` to disk and runs `git add` / `git commit` / `git push` for you,
  using this machine's own git/`gh` credentials (already signed in) — nothing
  is typed or stored in the browser.
- Because it commits straight to GitHub, run it on a machine that has your
  `git`/`gh` login (the one used to create this repo).

## Run it

```powershell
node server.js
```

Then open http://localhost:3000

Every add/delete auto-commits and pushes `data.json` to this repo. Run
`git pull` before starting the server on another machine to see changes
made elsewhere.

