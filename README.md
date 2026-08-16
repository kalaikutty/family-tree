# Family Tree

A lightweight, static family tree web app: view an interactive tree and add
new family members (name, relationship type, and which existing person
they're related to). Data is stored in [`data.json`](data.json) in this
**private** GitHub repo.

## How it works

- **Hosting**: plain static site (`index.html` + `style.css` + `app.js`),
  run locally (no build step). The repo is private, so there is no public
  GitHub Pages URL — GitHub Pages on the free plan only works for public
  repos, and this data is meant to stay private to you.
- **Reading data**: the page fetches `data.json` from disk at load time.
- **Adding/deleting members**: the form/delete buttons update the tree in
  the browser immediately, then (once you've configured GitHub settings)
  commit the updated `data.json` straight back to this repo via the GitHub
  REST API, so the change is permanent and pulled in on your next `git pull`.

## 1. Clone / pull this repo

```powershell
git clone https://github.com/kalaikutty/family-tree.git
cd family-tree
```

## 2. Create a Personal Access Token (so "Add/Delete Member" can save to GitHub)

1. GitHub → **Settings** (account) → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access**: select "Only select repositories" → choose this repo.
3. **Permissions** → **Repository permissions** → **Contents**: set to
   **Read and write**. Leave everything else as "No access".
4. Generate the token and copy it (you'll only see it once).

## 3. Configure the app

1. Run the site locally (see below) and open it in your browser.
2. Click **⚙ Settings**.
3. Enter your GitHub **owner** (username/org), **repository name**, **branch**
   (usually `main`), and paste the **token**.
4. Click **Save** — this is a one-time step per browser; the token stays in
   that browser's local storage so you won't need to re-enter it next time.

Now every time you use the "Add Family Member" form or delete a member, the
app commits the updated `data.json` back to this repo automatically.

> ⚠️ The token is stored only in your own browser's local storage and is
> sent directly to `api.github.com` over HTTPS — it is never committed to
> the repo or shared anywhere else. Don't share your token, and keep it
> scoped (fine-grained, this repo only, Contents: read/write).

## Without a token

If you skip the GitHub settings, the app still works — changes are kept in
your browser's local storage so you can keep adding/removing members in that
session, but they won't be persisted to the repo (and won't show up if you
open the site from another device/browser or after clearing local storage).

## Local development

Because the app uses `fetch('data.json')`, opening `index.html` directly via
`file://` may be blocked by the browser's CORS rules. Serve it locally instead:

```powershell
npx serve .
# or
python -m http.server 8080
```

Then visit `http://localhost:8080` (or the port shown). After making
changes, `git pull` on any other machine to get the latest saved tree.

