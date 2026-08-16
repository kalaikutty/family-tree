// Minimal local server: serves the static app and saves edits straight to
// this repo. If a GITHUB_TOKEN is set in a local .env file (git-ignored),
// saves go directly to the GitHub Contents API (fast, no git required, and
// the token is only ever entered once). Otherwise it falls back to
// `git add`/`commit`/`push` using this machine's own git credentials.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = __dirname;
const DATA_FILE_NAME = "data.json";
const DATA_FILE = path.join(ROOT, DATA_FILE_NAME);
const PORT = process.env.PORT || 3000;

const GITHUB_OWNER = "kalaikutty";
const GITHUB_REPO = "family-tree";
const GITHUB_BRANCH = "main";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

loadEnvFile();

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save") {
    return handleSave(req, res);
  }
  return serveStatic(req, res);
});

function handleSave(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    try {
      await fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
      if (process.env.GITHUB_TOKEN) {
        await saveViaGitHubApi(data, process.env.GITHUB_TOKEN);
      } else {
        await commitAndPushGit();
      }
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
  });
}

async function saveViaGitHubApi(data, token) {
  const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE_NAME}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "family-tree-local-server",
  };

  let sha;
  const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
  if (getRes.ok) {
    sha = (await getRes.json()).sha;
  } else if (getRes.status !== 404) {
    throw new Error(`GitHub read failed: HTTP ${getRes.status}`);
  }

  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8").toString("base64");
  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update family tree",
      content,
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errJson = await putRes.json().catch(() => ({}));
    throw new Error(errJson.message || `GitHub write failed: HTTP ${putRes.status}`);
  }
}

function commitAndPushGit() {
  return new Promise((resolve, reject) => {
    execFile("git", ["add", "data.json"], { cwd: ROOT }, (err) => {
      if (err) return reject(err);
      execFile("git", ["commit", "-m", "Update family tree"], { cwd: ROOT }, (err2, stdout, stderr) => {
        const nothingToCommit = /nothing to commit/i.test(stdout + stderr);
        if (err2 && !nothingToCommit) return reject(err2);
        // Reconcile with any remote commits (e.g. edits from another session)
        // before pushing, instead of failing outright on divergence.
        execFile("git", ["pull", "--rebase", "--autostash"], { cwd: ROOT }, (errPull, pullOut, pullErr) => {
          if (errPull) return reject(new Error("git pull --rebase failed: " + (pullErr || pullOut || errPull.message)));
          execFile("git", ["push"], { cwd: ROOT }, (err3, pushOut, pushErr) => {
            if (err3) return reject(new Error("git push failed: " + (pushErr || pushOut || err3.message)));
            resolve();
          });
        });
      });
    });
  });
}

// Reads KEY=VALUE lines from a local .env file (never committed) into
// process.env, so the GitHub token only has to be set up once per machine.
function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const relPath = urlPath === "/" ? "/index.html" : urlPath;
  const fullPath = path.normalize(path.join(ROOT, relPath));

  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      // Always revalidate so a fixed app.js/style.css is picked up immediately.
      "Cache-Control": "no-cache",
    });
    res.end(content);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, () => {
  console.log(`Family tree running at http://localhost:${PORT}`);
  console.log(process.env.GITHUB_TOKEN ? "Saving via GitHub API (.env token found)." : "Saving via git push (no .env token found).");
});
