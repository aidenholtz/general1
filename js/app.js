const STORAGE_KEY = "chapterOpsDashboard.v1";

const DEFAULT_DATA = {
  offices: [
    {
      id: uid(),
      name: "Office of Sorority & Fraternity Life",
      contact: "",
      email: "",
      notes: "",
      items: [],
      documents: [],
    },
    {
      id: uid(),
      name: "Housing & Residence Life",
      contact: "",
      email: "",
      notes: "",
      items: [],
      documents: [],
    },
    {
      id: uid(),
      name: "Parking & Transportation",
      contact: "",
      email: "",
      notes: "",
      items: [],
      documents: [],
    },
  ],
};

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_DATA);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.offices) throw new Error("malformed");
    return parsed;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();

const STATUS_LABELS = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting on them",
  done: "Done",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const due = new Date(dateStr);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function isOverdue(item) {
  if (item.status === "done" || !item.dueDate) return false;
  return daysUntil(item.dueDate) < 0;
}

function isDueThisWeek(item) {
  if (item.status === "done" || !item.dueDate) return false;
  const d = daysUntil(item.dueDate);
  return d >= 0 && d <= 7;
}

function officeStatus(office) {
  const open = office.items.filter((i) => i.status !== "done");
  if (open.length === 0) return "gray";
  if (open.some(isOverdue)) return "red";
  if (open.some((i) => isDueThisWeek(i) || i.status === "waiting")) return "yellow";
  return "green";
}

function render() {
  renderSummary();
  renderOffices();
  saveData();
}

function renderSummary() {
  const allItems = state.offices.flatMap((o) => o.items);
  const open = allItems.filter((i) => i.status !== "done");
  const overdue = open.filter(isOverdue);
  const waiting = open.filter((i) => i.status === "waiting");
  const dueWeek = open.filter(isDueThisWeek);

  const tiles = [
    { label: "Open items", count: open.length, tone: "" },
    { label: "Overdue", count: overdue.length, tone: "red" },
    { label: "Waiting on them", count: waiting.length, tone: "yellow" },
    { label: "Due this week", count: dueWeek.length, tone: "yellow" },
    { label: "Offices tracked", count: state.offices.length, tone: "green" },
  ];

  document.getElementById("summaryBar").innerHTML = tiles
    .map(
      (t) => `
      <div class="summary-tile ${t.tone ? "tone-" + t.tone : ""}">
        <div class="count">${t.count}</div>
        <div class="label">${escapeHtml(t.label)}</div>
      </div>`
    )
    .join("");
}

function passesFilter(item) {
  const f = document.getElementById("filterSelect").value;
  switch (f) {
    case "overdue":
      return isOverdue(item);
    case "waiting":
      return item.status === "waiting";
    case "week":
      return isDueThisWeek(item);
    case "done":
      return item.status === "done";
    case "all":
    default:
      return item.status !== "done";
  }
}

function renderOffices() {
  const container = document.getElementById("officesContainer");
  const emptyState = document.getElementById("emptyState");

  if (state.offices.length === 0) {
    container.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  container.innerHTML = state.offices
    .map((office) => {
      const status = officeStatus(office);
      const visibleItems = office.items
        .filter(passesFilter)
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });

      return `
      <div class="office-card" data-office-id="${office.id}">
        <div class="office-card-header">
          <div>
            <div class="office-name-row">
              <span class="status-dot ${status}" title="${statusTitle(status)}"></span>
              <span class="office-name">${escapeHtml(office.name)}</span>
            </div>
            ${
              office.contact || office.email
                ? `<div class="office-meta">${escapeHtml(office.contact)}${
                    office.contact && office.email ? " &middot; " : ""
                  }${escapeHtml(office.email)}</div>`
                : ""
            }
            ${office.notes ? `<div class="office-notes">${escapeHtml(office.notes)}</div>` : ""}
          </div>
          <button class="icon-btn" data-action="edit-office" data-office-id="${office.id}">Edit</button>
        </div>
        <div class="item-list">
          ${
            visibleItems.length
              ? visibleItems.map((item) => itemRowHtml(office.id, item)).join("")
              : `<div class="office-meta">Nothing here for this filter.</div>`
          }
        </div>
        <button class="add-item-btn" data-action="add-item" data-office-id="${office.id}">+ Add item</button>
        <div class="doc-list">
          <div class="doc-list-label">Documents</div>
          ${(office.documents || []).map((doc) => docRowHtml(office.id, doc)).join("")}
          <button class="add-item-btn" data-action="add-document" data-office-id="${office.id}">+ Add document</button>
        </div>
      </div>`;
    })
    .join("");
}

function statusTitle(status) {
  return { red: "Overdue item", yellow: "Needs attention", green: "On track", gray: "No open items" }[status];
}

function itemRowHtml(officeId, item) {
  const overdue = isOverdue(item);
  return `
    <div class="item-row ${item.status === "done" ? "done" : ""}" data-item-id="${item.id}">
      <input type="checkbox" data-action="toggle-done" data-office-id="${officeId}" data-item-id="${item.id}" ${
    item.status === "done" ? "checked" : ""
  } />
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.title)}</div>
        ${item.dueDate ? `<div class="item-due ${overdue ? "overdue" : ""}">${overdue ? "Overdue: " : "Due "}${item.dueDate}</div>` : ""}
      </div>
      <span class="badge ${item.status}">${STATUS_LABELS[item.status]}</span>
      <button class="icon-btn" data-action="edit-item" data-office-id="${officeId}" data-item-id="${item.id}">Edit</button>
    </div>`;
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : "#";
}

function docRowHtml(officeId, doc) {
  return `
    <div class="doc-row" data-doc-id="${doc.id}">
      <a class="doc-link" href="${escapeHtml(safeUrl(doc.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.label)}</a>
      <button class="icon-btn" data-action="edit-document" data-office-id="${officeId}" data-doc-id="${doc.id}">Edit</button>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Office modal ----
const officeModalBackdrop = document.getElementById("officeModalBackdrop");
const officeForm = document.getElementById("officeForm");

function openOfficeModal(officeId) {
  const office = officeId ? state.offices.find((o) => o.id === officeId) : null;
  document.getElementById("officeModalTitle").textContent = office ? "Edit Office" : "Add Office";
  document.getElementById("officeId").value = office ? office.id : "";
  document.getElementById("officeName").value = office ? office.name : "";
  document.getElementById("officeContact").value = office ? office.contact : "";
  document.getElementById("officeEmail").value = office ? office.email : "";
  document.getElementById("officeNotes").value = office ? office.notes : "";
  document.getElementById("deleteOfficeBtn").hidden = !office;
  officeModalBackdrop.hidden = false;
}

function closeOfficeModal() {
  officeModalBackdrop.hidden = true;
}

document.getElementById("addOfficeBtn").addEventListener("click", () => openOfficeModal(null));
document.getElementById("cancelOfficeBtn").addEventListener("click", closeOfficeModal);

officeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("officeId").value;
  const payload = {
    name: document.getElementById("officeName").value.trim(),
    contact: document.getElementById("officeContact").value.trim(),
    email: document.getElementById("officeEmail").value.trim(),
    notes: document.getElementById("officeNotes").value.trim(),
  };
  if (!payload.name) return;

  if (id) {
    const office = state.offices.find((o) => o.id === id);
    Object.assign(office, payload);
  } else {
    state.offices.push({ id: uid(), items: [], documents: [], ...payload });
  }
  closeOfficeModal();
  render();
});

document.getElementById("deleteOfficeBtn").addEventListener("click", () => {
  const id = document.getElementById("officeId").value;
  if (!id) return;
  if (!confirm("Delete this office and all its items?")) return;
  state.offices = state.offices.filter((o) => o.id !== id);
  closeOfficeModal();
  render();
});

// ---- Item modal ----
const itemModalBackdrop = document.getElementById("itemModalBackdrop");
const itemForm = document.getElementById("itemForm");

function openItemModal(officeId, itemId) {
  const office = state.offices.find((o) => o.id === officeId);
  const item = itemId ? office.items.find((i) => i.id === itemId) : null;
  document.getElementById("itemModalTitle").textContent = item ? "Edit Item" : "Add Item";
  document.getElementById("itemId").value = item ? item.id : "";
  document.getElementById("itemOfficeId").value = officeId;
  document.getElementById("itemTitle").value = item ? item.title : "";
  document.getElementById("itemDetails").value = item ? item.details : "";
  document.getElementById("itemDueDate").value = item ? item.dueDate || "" : "";
  document.getElementById("itemStatus").value = item ? item.status : "not_started";
  document.getElementById("deleteItemBtn").hidden = !item;
  itemModalBackdrop.hidden = false;
}

function closeItemModal() {
  itemModalBackdrop.hidden = true;
}

document.getElementById("cancelItemBtn").addEventListener("click", closeItemModal);

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("itemId").value;
  const officeId = document.getElementById("itemOfficeId").value;
  const office = state.offices.find((o) => o.id === officeId);
  const payload = {
    title: document.getElementById("itemTitle").value.trim(),
    details: document.getElementById("itemDetails").value.trim(),
    dueDate: document.getElementById("itemDueDate").value,
    status: document.getElementById("itemStatus").value,
  };
  if (!payload.title) return;

  if (id) {
    const item = office.items.find((i) => i.id === id);
    Object.assign(item, payload);
  } else {
    office.items.push({ id: uid(), ...payload });
  }
  closeItemModal();
  render();
});

document.getElementById("deleteItemBtn").addEventListener("click", () => {
  const id = document.getElementById("itemId").value;
  const officeId = document.getElementById("itemOfficeId").value;
  const office = state.offices.find((o) => o.id === officeId);
  office.items = office.items.filter((i) => i.id !== id);
  closeItemModal();
  render();
});

// ---- Document modal ----
const documentModalBackdrop = document.getElementById("documentModalBackdrop");
const documentForm = document.getElementById("documentForm");

function openDocumentModal(officeId, docId) {
  const office = state.offices.find((o) => o.id === officeId);
  const doc = docId ? (office.documents || []).find((d) => d.id === docId) : null;
  document.getElementById("documentModalTitle").textContent = doc ? "Edit Document" : "Add Document";
  document.getElementById("documentId").value = doc ? doc.id : "";
  document.getElementById("documentOfficeId").value = officeId;
  document.getElementById("documentLabel").value = doc ? doc.label : "";
  document.getElementById("documentUrl").value = doc ? doc.url : "";
  document.getElementById("deleteDocumentBtn").hidden = !doc;
  documentModalBackdrop.hidden = false;
}

function closeDocumentModal() {
  documentModalBackdrop.hidden = true;
}

document.getElementById("cancelDocumentBtn").addEventListener("click", closeDocumentModal);

documentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("documentId").value;
  const officeId = document.getElementById("documentOfficeId").value;
  const office = state.offices.find((o) => o.id === officeId);
  office.documents = office.documents || [];
  const payload = {
    label: document.getElementById("documentLabel").value.trim(),
    url: document.getElementById("documentUrl").value.trim(),
  };
  if (!payload.label || !payload.url) return;

  if (id) {
    const doc = office.documents.find((d) => d.id === id);
    Object.assign(doc, payload);
  } else {
    office.documents.push({ id: uid(), ...payload });
  }
  closeDocumentModal();
  render();
});

document.getElementById("deleteDocumentBtn").addEventListener("click", () => {
  const id = document.getElementById("documentId").value;
  const officeId = document.getElementById("documentOfficeId").value;
  const office = state.offices.find((o) => o.id === officeId);
  office.documents = (office.documents || []).filter((d) => d.id !== id);
  closeDocumentModal();
  render();
});

// ---- Delegated clicks on office cards ----
document.getElementById("officesContainer").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, officeId, itemId } = btn.dataset;
  if (action === "edit-office") openOfficeModal(officeId);
  if (action === "add-item") openItemModal(officeId, null);
  if (action === "edit-item") openItemModal(officeId, itemId);
  if (action === "add-document") openDocumentModal(officeId, null);
  if (action === "edit-document") openDocumentModal(officeId, btn.dataset.docId);
});

document.getElementById("officesContainer").addEventListener("change", (e) => {
  const el = e.target.closest("[data-action='toggle-done']");
  if (!el) return;
  const { officeId, itemId } = el.dataset;
  const office = state.offices.find((o) => o.id === officeId);
  const item = office.items.find((i) => i.id === itemId);
  item.status = el.checked ? "done" : "not_started";
  render();
});

document.getElementById("filterSelect").addEventListener("change", render);

// ---- Export / Import ----
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chapter-ops-dashboard-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.offices) throw new Error("Invalid file: missing 'offices'");
      state = parsed;
      render();
    } catch (err) {
      alert("Could not import file: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

render();
