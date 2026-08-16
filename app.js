// ---------- State ----------
// Flat list of people (a forest, not a single-root tree). Each person:
// { id, name, relationship, spouseId, parentIds: [] }
let people = [];
let selectedId = null;

const DATA_FILE = "data.json";
const LS_KEY_TREE = "familyTree.cachedData";

// ---------- Elements ----------
const treeContainer = document.getElementById("treeContainer");
const statusEl = document.getElementById("status");
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("name");
const relationFields = document.getElementById("relationFields");
const relationshipSelect = document.getElementById("relationship");
const customRelWrap = document.getElementById("customRelWrap");
const customRelInput = document.getElementById("customRel");
const singleRelationWrap = document.getElementById("singleRelationWrap");
const relationToSelect = document.getElementById("relationTo");
const parentsWrap = document.getElementById("parentsWrap");
const parent1Select = document.getElementById("parent1");
const parent2Select = document.getElementById("parent2");
const formHint = document.getElementById("formHint");

// ---------- Init ----------
init();

async function init() {
  await loadData();
  renderTree();
  updateFormVisibility();
  populateRelationSelects();
}

// ---------- Data loading ----------
async function loadData() {
  try {
    const res = await fetch(`${DATA_FILE}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    people = Array.isArray(json) ? json : [];
    localStorage.setItem(LS_KEY_TREE, JSON.stringify(people));
  } catch (err) {
    const cached = localStorage.getItem(LS_KEY_TREE);
    if (cached) {
      people = JSON.parse(cached);
      setStatus("Loaded cached local copy (couldn't fetch data.json).", true);
    } else {
      people = [];
    }
  }
}

// ---------- Graph helpers ----------
function getPerson(id) {
  return people.find((p) => p.id === id) || null;
}

function getSpouse(person) {
  return person.spouseId ? getPerson(person.spouseId) : null;
}

function getChildren(id) {
  return people.filter((p) => p.parentIds.includes(id));
}

function generateId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

// ---------- Rendering ----------
function renderTree() {
  treeContainer.innerHTML = "";
  if (!people.length) {
    treeContainer.innerHTML = `<p class="empty-msg">No members yet — add the first one using the form.</p>`;
    return;
  }

  const rendered = new Set();
  const roots = people.filter((p) => {
    if (p.parentIds.length) return false;
    const spouse = getSpouse(p);
    return !(spouse && spouse.parentIds.length); // married-in spouses render alongside their partner instead
  });

  const rootUl = document.createElement("ul");
  rootUl.className = "tree";
  roots.forEach((root) => {
    if (rendered.has(root.id)) return;
    rootUl.appendChild(renderUnit(root.id, rendered));
  });
  treeContainer.appendChild(rootUl);
}

function renderUnit(personId, rendered) {
  const person = getPerson(personId);
  const spouse = getSpouse(person);
  rendered.add(person.id);
  if (spouse) rendered.add(spouse.id);

  const li = document.createElement("li");

  const unit = document.createElement("div");
  unit.className = "node-unit";
  unit.appendChild(buildPersonBox(person));
  if (spouse) {
    const connector = document.createElement("span");
    connector.className = "spouse-connector";
    connector.textContent = "⚭";
    unit.appendChild(connector);
    unit.appendChild(buildPersonBox(spouse));
  }
  li.appendChild(unit);

  const childIds = new Set(getChildren(person.id).map((c) => c.id));
  if (spouse) getChildren(spouse.id).forEach((c) => childIds.add(c.id));

  if (childIds.size) {
    const ul = document.createElement("ul");
    childIds.forEach((cid) => {
      if (!rendered.has(cid)) ul.appendChild(renderUnit(cid, rendered));
    });
    li.appendChild(ul);
  }
  return li;
}

function buildPersonBox(person) {
  const box = document.createElement("div");
  box.className = "node-box" + (person.id === selectedId ? " selected" : "");
  box.dataset.id = person.id;
  box.innerHTML = `<div class="node-name">${escapeHtml(person.name)}</div>
                    <div class="node-rel">${escapeHtml(person.relationship || "")}</div>`;
  box.addEventListener("click", () => {
    selectedId = person.id;
    renderTree();
    populateRelationSelects();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.title = `Delete ${person.name}`;
  deleteBtn.textContent = "🗑";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteNode(person.id);
  });
  box.appendChild(deleteBtn);

  return box;
}

async function deleteNode(id) {
  const person = getPerson(id);
  if (!person) return;

  const childCount = getChildren(id).length;
  const warning = childCount > 0
    ? `Delete "${person.name}"? Their ${childCount} child${childCount > 1 ? "ren" : ""} will stay in the tree but lose this parent link.`
    : `Delete "${person.name}"?`;
  if (!window.confirm(warning)) return;

  if (person.spouseId) {
    const spouse = getPerson(person.spouseId);
    if (spouse) spouse.spouseId = null;
  }
  people.forEach((p) => {
    p.parentIds = p.parentIds.filter((pid) => pid !== id);
  });
  people = people.filter((p) => p.id !== id);

  if (selectedId === id) selectedId = null;

  localStorage.setItem(LS_KEY_TREE, JSON.stringify(people));
  renderTree();
  updateFormVisibility();
  populateRelationSelects();
  await saveTree();
}

function populateRelationSelects() {
  const optionsHtml = people.map((p) => `<option value="${p.id}">${escapeHtml(personLabel(p))}</option>`).join("");

  // Remember prior selections so a re-render (e.g. from clicking a tree node)
  // doesn't silently overwrite a choice the user already made in the form.
  const prevRelationTo = relationToSelect.value;
  const prevParent1 = parent1Select.value;
  const prevParent2 = parent2Select.value;

  relationToSelect.innerHTML = optionsHtml;
  parent1Select.innerHTML = optionsHtml;
  parent2Select.innerHTML = `<option value="">— none —</option>${optionsHtml}`;

  relationToSelect.value = getPerson(prevRelationTo) ? prevRelationTo : (selectedId || "");
  parent1Select.value = getPerson(prevParent1) ? prevParent1 : (selectedId || "");
  parent2Select.value = getPerson(prevParent2) ? prevParent2 : "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Disambiguates people who share the same name, so dropdowns never show
// two identical-looking options for different people.
function personLabel(p) {
  const sameName = people.filter((o) => o.name === p.name);
  if (sameName.length < 2) return p.name;

  const spouse = getSpouse(p);
  if (spouse) return `${p.name} (spouse of ${spouse.name})`;

  if (p.parentIds.length) {
    const parentNames = p.parentIds.map((id) => getPerson(id)?.name).filter(Boolean);
    if (parentNames.length) return `${p.name} (child of ${parentNames.join(" & ")})`;
  }

  return `${p.name} (#${p.id.slice(0, 4)})`;
}


// ---------- Form ----------
function updateFormVisibility() {
  const hasPeople = people.length > 0;
  relationFields.classList.toggle("hidden", !hasPeople);

  if (!hasPeople) {
    formHint.textContent = "This is the first member — they'll start the tree with no relations yet.";
    return;
  }

  const rel = relationshipSelect.value;
  customRelWrap.classList.toggle("hidden", rel !== "Other");
  parentsWrap.classList.toggle("hidden", rel !== "Child");
  singleRelationWrap.classList.toggle("hidden", rel === "Child");

  formHint.textContent = rel === "Spouse"
    ? "The new member is added as a spouse, shown at the same level as the selected person."
    : rel === "Child"
      ? "Pick one or both parents — the new member is added as their child."
      : rel === "Parent"
        ? "The new member becomes a parent of the selected person (up to 2 parents total)."
        : rel === "Sibling"
          ? "The new member is added as a sibling, sharing the selected person's parents (same level)."
          : "New members are attached as a child node under the selected \"Relation to\" person.";
}

relationshipSelect.addEventListener("change", updateFormVisibility);

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;

  let newPerson;

  if (!people.length) {
    newPerson = { id: generateId(), name, relationship: "", spouseId: null, parentIds: [] };
  } else {
    const relationship = relationshipSelect.value === "Other"
      ? (customRelInput.value.trim() || "Other")
      : relationshipSelect.value;

    if (relationship === "Spouse") {
      const spouseOf = getPerson(relationToSelect.value);
      if (!spouseOf) {
        setStatus("Select who this is a spouse of.", true);
        return;
      }
      newPerson = { id: generateId(), name, relationship: "Spouse", spouseId: spouseOf.id, parentIds: [] };
      spouseOf.spouseId = newPerson.id;
    } else if (relationship === "Child") {
      const parentIds = [parent1Select.value, parent2Select.value].filter(Boolean);
      if (!parentIds.length) {
        setStatus("Select at least one parent.", true);
        return;
      }
      newPerson = { id: generateId(), name, relationship: "Child", spouseId: null, parentIds };
    } else if (relationship === "Parent") {
      const child = getPerson(relationToSelect.value);
      if (!child) {
        setStatus("Select whose parent this is.", true);
        return;
      }
      if (child.parentIds.length >= 2) {
        setStatus(`${child.name} already has 2 parents recorded.`, true);
        return;
      }
      newPerson = { id: generateId(), name, relationship: "Parent", spouseId: null, parentIds: [] };
      child.parentIds = [...child.parentIds, newPerson.id];
    } else if (relationship === "Sibling") {
      const sibling = getPerson(relationToSelect.value);
      if (!sibling) {
        setStatus("Select whose sibling this is.", true);
        return;
      }
      newPerson = { id: generateId(), name, relationship: "Sibling", spouseId: null, parentIds: [...sibling.parentIds] };
    } else {
      const relTo = relationToSelect.value;
      if (!relTo) {
        setStatus("Select who this person relates to.", true);
        return;
      }
      newPerson = { id: generateId(), name, relationship, spouseId: null, parentIds: [relTo] };
    }
  }

  people.push(newPerson);
  selectedId = newPerson.id;

  localStorage.setItem(LS_KEY_TREE, JSON.stringify(people));
  renderTree();
  updateFormVisibility();
  populateRelationSelects();
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
      body: JSON.stringify(people, null, 2),
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
