// ---------- State ----------
let treeData = null;
let selectedId = "root";

const DATA_FILE = "data.json";
const LS_KEY_TREE = "familyTree.cachedData";
const LS_KEY_SETTINGS = "familyTree.githubSettings";

// ---------- Elements ----------
const treeContainer = document.getElementById("treeContainer");
const statusEl = document.getElementById("status");
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("name");
const relationshipSelect = document.getElementById("relationship");
const customRelWrap = document.getElementById("customRelWrap");
const customRelInput = document.getElementById("customRel");
const relationToSelect = document.getElementById("relationTo");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsSave = document.getElementById("settingsSave");
const settingsCancel = document.getElementById("settingsCancel");
const ghOwner = document.getElementById("ghOwner");
const ghRepo = document.getElementById("ghRepo");
const ghBranch = document.getElementById("ghBranch");
const ghToken = document.getElementById("ghToken");

// ---------- Init ----------
init();

async function init() {
  await loadData();
  renderTree();
  populateRelationToOptions();
  loadSettingsIntoForm();
}

// ---------- Data loading ----------
async function loadData() {
  try {
    const res = await fetch(`${DATA_FILE}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    treeData = await res.json();
    localStorage.setItem(LS_KEY_TREE, JSON.stringify(treeData));
  } catch (err) {
    const cached = localStorage.getItem(LS_KEY_TREE);
    if (cached) {
      treeData = JSON.parse(cached);
      setStatus("Loaded cached local copy (couldn't fetch data.json).", true);
    } else {
      treeData = { id: "root", name: "Root Person", relationship: "Root", children: [] };
      setStatus("Starting with a fresh tree.", false);
    }
  }
}

// ---------- Tree helpers ----------
function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function flattenNodes(node, out = []) {
  out.push(node);
  for (const child of node.children || []) flattenNodes(child, out);
  return out;
}

function generateId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

// ---------- Rendering ----------
function renderTree() {
  treeContainer.innerHTML = "";
  if (!treeData) {
    treeContainer.innerHTML = `<p class="empty-msg">No data.</p>`;
    return;
  }
  const rootUl = document.createElement("ul");
  rootUl.className = "tree";
  rootUl.appendChild(renderNode(treeData));
  treeContainer.appendChild(rootUl);
}

function renderNode(node) {
  const li = document.createElement("li");

  const box = document.createElement("div");
  box.className = "node-box" + (node.id === selectedId ? " selected" : "");
  box.dataset.id = node.id;
  box.innerHTML = `<div class="node-name">${escapeHtml(node.name)}</div>
                    <div class="node-rel">${escapeHtml(node.relationship || "")}</div>`;
  box.addEventListener("click", () => {
    selectedId = node.id;
    relationToSelect.value = node.id;
    renderTree();
  });
  li.appendChild(box);

  if (node.children && node.children.length) {
    const ul = document.createElement("ul");
    node.children.forEach((child) => ul.appendChild(renderNode(child)));
    li.appendChild(ul);
  }
  return li;
}

function populateRelationToOptions() {
  const nodes = flattenNodes(treeData);
  relationToSelect.innerHTML = "";
  nodes.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    opt.textContent = n.name;
    relationToSelect.appendChild(opt);
  });
  relationToSelect.value = selectedId;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Form ----------
relationshipSelect.addEventListener("change", () => {
  customRelWrap.classList.toggle("hidden", relationshipSelect.value !== "Other");
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const relationship = relationshipSelect.value === "Other"
    ? (customRelInput.value.trim() || "Other")
    : relationshipSelect.value;
  const parentId = relationToSelect.value;

  if (!name) return;

  const parentNode = findNode(treeData, parentId);
  if (!parentNode) {
    setStatus("Selected relation-to person not found.", true);
    return;
  }

  const newNode = { id: generateId(), name, relationship, children: [] };
  parentNode.children = parentNode.children || [];
  parentNode.children.push(newNode);

  localStorage.setItem(LS_KEY_TREE, JSON.stringify(treeData));
  selectedId = newNode.id;
  renderTree();
  populateRelationToOptions();
  addForm.reset();
  customRelWrap.classList.add("hidden");

  await saveToGitHub();
});

// ---------- Settings ----------
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_SETTINGS)) || {};
  } catch {
    return {};
  }
}

function loadSettingsIntoForm() {
  const s = getSettings();
  ghOwner.value = s.owner || "";
  ghRepo.value = s.repo || "";
  ghBranch.value = s.branch || "main";
  ghToken.value = "";
}

settingsBtn.addEventListener("click", () => {
  loadSettingsIntoForm();
  settingsModal.classList.remove("hidden");
});
settingsCancel.addEventListener("click", () => settingsModal.classList.add("hidden"));

settingsSave.addEventListener("click", () => {
  const existing = getSettings();
  const settings = {
    owner: ghOwner.value.trim(),
    repo: ghRepo.value.trim(),
    branch: ghBranch.value.trim() || "main",
    // keep previously saved token if the field was left blank
    token: ghToken.value.trim() || existing.token || "",
  };
  localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(settings));
  settingsModal.classList.add("hidden");
  setStatus("Settings saved.", false);
});

// ---------- GitHub persistence ----------
async function saveToGitHub() {
  const { owner, repo, branch, token } = getSettings();

  if (!owner || !repo || !token) {
    setStatus("Saved locally in this browser only. Configure GitHub settings (⚙) to persist to the repo.", false);
    return;
  }

  setStatus("Saving to GitHub…", false);
  try {
    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${DATA_FILE}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };

    // 1. Get current file SHA (needed to update an existing file)
    let sha;
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    } else if (getRes.status !== 404) {
      throw new Error(`Failed to read current file (HTTP ${getRes.status})`);
    }

    // 2. Put updated content
    const content = b64EncodeUnicode(JSON.stringify(treeData, null, 2));
    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add family member: ${treeData ? "" : ""}update tree`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      throw new Error(errJson.message || `HTTP ${putRes.status}`);
    }

    setStatus("Saved to GitHub ✓", false);
  } catch (err) {
    console.error(err);
    setStatus(`GitHub save failed: ${err.message}`, true);
  }
}

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ffd6d6" : "#e6f2ea";
  if (msg) {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => (statusEl.textContent = ""), 6000);
  }
}
