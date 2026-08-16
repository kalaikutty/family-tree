// Minimal local server: serves the static app and saves edits straight to
// this repo's data.json, then commits + pushes using this machine's own git
// credentials (already authenticated via `gh auth login` / git credential
// manager). The browser never needs a token.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save") {
    return handleSave(req, res);
  }
  return serveStatic(req, res);
});

function handleSave(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n", (err) => {
      if (err) return sendJson(res, 500, { ok: false, error: err.message });

      commitAndPush((err2) => {
        if (err2) return sendJson(res, 500, { ok: false, error: err2.message });
        sendJson(res, 200, { ok: true });
      });
    });
  });
}

function commitAndPush(cb) {
  execFile("git", ["add", "data.json"], { cwd: ROOT }, (err) => {
    if (err) return cb(err);
    execFile("git", ["commit", "-m", "Update family tree"], { cwd: ROOT }, (err2, stdout, stderr) => {
      const nothingToCommit = /nothing to commit/i.test(stdout + stderr);
      if (err2 && !nothingToCommit) return cb(err2);
      // Reconcile with any remote commits (e.g. edits from another session)
      // before pushing, instead of failing outright on divergence.
      execFile("git", ["pull", "--rebase", "--autostash"], { cwd: ROOT }, (errPull, pullOut, pullErr) => {
        if (errPull) return cb(new Error("git pull --rebase failed: " + (pullErr || pullOut || errPull.message)));
        execFile("git", ["push"], { cwd: ROOT }, (err3, pushOut, pushErr) => {
          if (err3) return cb(new Error("git push failed: " + (pushErr || pushOut || err3.message)));
          cb(null);
        });
      });
    });
  });
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
});
