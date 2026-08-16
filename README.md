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

## Editing locally (recommended, one-time setup)

Persistent edits (add/delete a member) work when you run the small local
Node server on your own machine:

```powershell
node server.js
```

Then open http://localhost:3000

By default it saves via `git add`/`commit`/`push` using this machine's own
git/`gh` credentials. For a faster, more reliable save that doesn't depend on
local git state, set up a token once instead:

1. Copy `.env.example` to `.env` (this file is git-ignored, never committed).
2. Create a fine-grained GitHub PAT (Settings → Developer settings → Personal
   access tokens) scoped to only this repo, with **Contents: Read and write**.
3. Paste it into `.env` as `GITHUB_TOKEN=...` and save.
4. Restart `node server.js` — it prints which save method it's using.

With `.env` set, saves go straight to the GitHub API — no git required, and
you never have to enter the token again on that machine.

## Editing from the public page

The public page has no server, so it can't use `.env`. Instead, click
**🔑 GitHub Token** (shown only there) and paste the same kind of
fine-grained PAT once — it's saved in that browser's local storage and used
directly for `api.github.com` calls, never sent anywhere else. You'll need to
repeat this once per browser/device.

## Notes

- Every save auto-commits/pushes `data.json`; GitHub Pages picks up the
  change (usually within a minute) so the public link stays in sync.
- Adding a **Child** requires selecting two different existing people as
  Parent 1 and Parent 2 — this prevents mismatched/incomplete parent links.
- Assigning someone a new **Spouse** automatically clears their previous
  spouse's link, so re-marriages never leave a stale, one-sided reference.

