// ---------- State ----------
let treeData = null;
let selectedId = "root";

const DATA_FILE = "data.json";
const LS_KEY_TREE = "familyTree.cachedData";

// ---------- Elements ----------
const treeContainer = document.getElementById("treeContainer");
const statusEl = document.getElementById("status");
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("name");
const relationshipSelect = document.getElementById("relationship");
const customRelWrap = document.getElementById("customRelWrap");
const customRelInput = document.getElementById("customRel");
const relationToSelect = document.getElementById("relationTo");

// ---------- Init ----------
init();

async function init() {
  await loadData();
  renderTree();
  populateRelationToOptions();
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

function findParent(node, childId) {
  for (const child of node.children || []) {
    if (child.id === childId) return node;
    const found = findParent(child, childId);
    if (found) return found;
  }
  return null;
}

function countDescendants(node) {
  let count = 0;
  for (const child of node.children || []) {
    count += 1 + countDescendants(child);
  }
  return count;
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

  if (node.id !== treeData.id) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.title = `Delete ${node.name}`;
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNode(node.id);
    });
    box.appendChild(deleteBtn);
  }

  if (node.children && node.children.length) {
    const ul = document.createElement("ul");
    node.children.forEach((child) => ul.appendChild(renderNode(child)));
    li.appendChild(ul);
  }
  return li;
}

async function deleteNode(id) {
  const node = findNode(treeData, id);
  if (!node) return;
  const descendants = countDescendants(node);
  const warning = descendants > 0
    ? `Delete "${node.name}" and their ${descendants} descendant${descendants > 1 ? "s" : ""}?`
    : `Delete "${node.name}"?`;
  if (!window.confirm(warning)) return;

  const parent = findParent(treeData, id);
  if (!parent) return; // root can't be deleted
  parent.children = parent.children.filter((c) => c.id !== id);

  if (selectedId === id || !findNode(treeData, selectedId)) {
    selectedId = treeData.id;
  }

  localStorage.setItem(LS_KEY_TREE, JSON.stringify(treeData));
  renderTree();
  populateRelationToOptions();
  await saveTree();
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

  await saveTree();
});

// ---------- Persistence (via local server, no tokens needed) ----------
async function saveTree() {
  setStatus("Saving…", false);
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(treeData, null, 2),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    setStatus("Saved ✓", false);
  } catch (err) {
    console.error(err);
    setStatus(`Save failed: ${err.message} (kept locally in this browser only)`, true);
  }
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ffd6d6" : "#e6f2ea";
  if (msg) {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => (statusEl.textContent = ""), 6000);
  }
}
