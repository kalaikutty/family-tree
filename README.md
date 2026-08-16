# Family Tree

A family tree app: view an interactive tree and add/delete family members
(name, relationship type, and which existing person they're related to).
Data lives in [`data.json`](data.json) in this **public** repo.

## Viewing (public link)

The tree is viewable by anyone with the link, read-only, via GitHub Pages:

**https://kalaikutty.github.io/family-tree/**

Pages just serves the static files (`index.html`, `style.css`, `app.js`,
`data.json`) — no server runs there, so it always shows whatever was last
pushed to `main`.

## Editing (local only, no tokens)

Persistent edits (add/delete a member) only work when you run the small
local Node server on your own machine:

```powershell
node server.js
```

Then open http://localhost:3000

- **No tokens, no Settings screen.** When you add or delete a member, the
  browser posts the updated tree to the local server, which writes
  `data.json` to disk and runs `git add` / `git commit` / `git push` for you,
  using this machine's own git/`gh` credentials (already signed in) — nothing
  is typed or stored in the browser.
- Because it commits straight to GitHub, run it on a machine that has your
  `git`/`gh` login (the one used to create this repo).
- Every add/delete auto-commits and pushes `data.json`; GitHub Pages picks up
  the change (usually within a minute) so the public link stays in sync.
- If you open the public link directly (not via `node server.js`), the
  Add/Delete buttons still update the tree in your browser for that session,
  but since there's no server there to receive the save, changes won't
  persist or push to GitHub — only edits made through your local server do.

