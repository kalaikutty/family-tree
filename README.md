# Family Tree

A lightweight, static family tree web app: view an interactive tree and add
new family members (name, relationship type, and which existing person
they're related to). Data is stored in [`data.json`](data.json) in this repo.

## How it works

- **Hosting**: plain static site (`index.html` + `style.css` + `app.js`) —
  works on GitHub Pages, no build step.
- **Reading data**: the page fetches `data.json` from the same repo at load
  time, so anyone visiting the published URL sees the latest committed tree.
- **Adding members**: the form updates the tree in the browser immediately,
  then (if you've configured GitHub settings) commits the new `data.json`
  straight to your repo via the GitHub REST API, so the change becomes
  permanent and visible to everyone.

## 1. Push this to GitHub

```powershell
git init
git add .
git commit -m "Initial family tree app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 2. Enable GitHub Pages

1. On GitHub, go to your repo → **Settings** → **Pages**.
2. Under "Build and deployment", set **Source** to `Deploy from a branch`.
3. Pick branch `main`, folder `/ (root)`, then **Save**.
4. Wait a minute, then your site will be live at:
   `https://<your-username>.github.io/<your-repo>/`

## 3. Create a Personal Access Token (so "Add Member" can save to GitHub)

1. GitHub → **Settings** (account) → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access**: select "Only select repositories" → choose this repo.
3. **Permissions** → **Repository permissions** → **Contents**: set to
   **Read and write**. Leave everything else as "No access".
4. Generate the token and copy it (you'll only see it once).

## 4. Configure the app

1. Open the published site.
2. Click **⚙ Settings**.
3. Enter your GitHub **owner** (username/org), **repository name**, **branch**
   (usually `main`), and paste the **token**.
4. Click **Save**.

Now every time you use the "Add Family Member" form, the app commits the
updated `data.json` back to this repo automatically.

> ⚠️ The token is stored only in your own browser's local storage and is
> sent directly to `api.github.com` over HTTPS — it is never bundled into the
> site or seen by other visitors. Anyone who opens Settings on their own
> browser and enters their own token needs their own write access to save
> changes. Don't share your token, and prefer a fine-grained token scoped to
> only this repository.

## Without a token

If you skip the GitHub settings, the app still works — changes are kept in
your browser's local storage so you can keep adding members in that session,
but they won't be visible to other visitors or persisted to the repo.

## Local development

Because the app uses `fetch('data.json')`, opening `index.html` directly via
`file://` may be blocked by the browser's CORS rules. Serve it locally instead:

```powershell
npx serve .
# or
python -m http.server 8080
```

Then visit `http://localhost:8080` (or the port shown).
