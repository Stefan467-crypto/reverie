// ../js/dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getFirestore,
  addDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  orderBy,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/* =========================
   Firebase
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
  authDomain: "reverie-c861c.firebaseapp.com",
  projectId: "reverie-c861c",
  storageBucket: "reverie-c861c.firebasestorage.app",
  messagingSenderId: "122254003952",
  appId: "1:122254003952:web:67dea6de1f5eb97a9b7c35",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Secondary app: creează user fără să delogheze adminul
const secondaryApp = initializeApp(firebaseConfig, "secondary");
const secondaryAuth = getAuth(secondaryApp);

/* =========================
   Cloudinary
========================= */
const CLOUD_NAME = "dp1y1xv5l";
const UPLOAD_PRESET = "reverie";

/* =========================
   UI helpers
========================= */
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   Custom red dropdowns (select.red-dropdown)
   Replaces a <select class="red-dropdown"> with an accessible custom dropdown
   that keeps the original <select> value in sync for forms.
========================= */
function initRedDropdowns() {
  const selects = Array.from(document.querySelectorAll('select.red-dropdown'));
  selects.forEach((select) => {
    if (select.dataset._redInit) return;
    select.dataset._redInit = '1';

    // Hide native select but keep it in DOM for form submission
    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    // trigger (visually similar to .form-select)
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'form-select custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const selectedText = select.options[select.selectedIndex]?.text || 'Selectează';
    trigger.textContent = selectedText;

    const optionsBox = document.createElement('div');
    optionsBox.className = 'custom-options';
    optionsBox.style.display = 'none';
    optionsBox.setAttribute('role', 'listbox');

    Array.from(select.options).forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-option';
      if (opt.disabled) item.classList.add('disabled');
      if (opt.selected) item.classList.add('selected');
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.dataset.index = String(idx);
      item.textContent = opt.text;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        select.value = item.dataset.value;
        // sync selection styling
        Array.from(optionsBox.querySelectorAll('.custom-option')).forEach((o) => o.classList.remove('selected'));
        item.classList.add('selected');
        trigger.textContent = item.textContent;
        // close
        optionsBox.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        // dispatch change on original select
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });

      optionsBox.appendChild(item);
    });

    // insert wrapper
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsBox);

    function open() {
      optionsBox.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');
    }

    function close() {
      optionsBox.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (optionsBox.style.display === 'block') close();
      else open();
    });

    // close when clicking outside
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) close();
    });

    // keyboard: open with ArrowDown/Space/Enter, navigate with arrows, select with Enter
    trigger.addEventListener('keydown', (e) => {
      const items = Array.from(optionsBox.querySelectorAll('.custom-option:not(.disabled)'));
      const focusedIdx = items.findIndex((it) => it.classList.contains('focused'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (optionsBox.style.display !== 'block') open();
        const next = items[(focusedIdx + 1) < items.length ? focusedIdx + 1 : 0];
        items.forEach((it) => it.classList.remove('focused'));
        if (next) next.classList.add('focused');
        next?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (optionsBox.style.display !== 'block') open();
        const prev = items[(focusedIdx - 1) >= 0 ? focusedIdx - 1 : items.length - 1];
        items.forEach((it) => it.classList.remove('focused'));
        if (prev) prev.classList.add('focused');
        prev?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (optionsBox.style.display !== 'block') open();
        const target = items[focusedIdx] || items[0];
        target?.click();
      } else if (e.key === 'Escape') {
        close();
      }
    });

    // reflect programmatic changes to the original select back to trigger
    select.addEventListener('change', () => {
      const opt = select.options[select.selectedIndex];
      trigger.textContent = opt ? opt.text : 'Selectează';
      Array.from(optionsBox.querySelectorAll('.custom-option')).forEach((o) => {
        o.classList.toggle('selected', o.dataset.value === select.value);
      });
    });
  });
}

// init on DOM ready
document.addEventListener('DOMContentLoaded', initRedDropdowns);

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFeatures(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtPriceEUR(price) {
  if (price === null || price === undefined || price === "") return "-";
  const n = Number(price);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ro-RO").format(n) + " €";
}

function setMsg(el, text, ok = true) {
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "#198754" : "#dc3545";
}

/* =========================
   Status helpers
========================= */
function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (["active", "stopped", "sold", "rented"].includes(v)) return v;
  return "active";
}

function statusLabel(s) {
  const v = normalizeStatus(s);
  if (v === "active") return "Activ";
  if (v === "stopped") return "Stopat";
  if (v === "sold") return "Vândut";
  if (v === "rented") return "Închiriat";
  return "Activ";
}

function statusOverlayText(s) {
  const v = normalizeStatus(s);
  if (v === "stopped") return "";
  if (v === "sold") return "";
  if (v === "rented") return "";
  return ""; // active -> nimic
}

function statusBadgeClass(s) {
  const v = normalizeStatus(s);
  if (v === "active") return "text-bg-success";
  if (v === "stopped") return "text-bg-secondary";
  if (v === "sold") return "text-bg-danger";
  if (v === "rented") return "text-bg-warning";
  return "text-bg-success";
}

function normalizeRole(r) {
  return String(r || "agent").toLowerCase();
}

/* =========================
   UI refs
========================= */
// top
const authStatus = $("authStatus");
const uidBadge = $("uidBadge");
const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");
const logoutBtn = $("logoutBtn");
const brandSub = $("brandSub");

// views
const viewHome = $("view-home");
const viewMy = $("view-my");
const viewAdd = $("view-add");
const viewAll = $("view-all");
const viewUsers = $("view-users");

// sidebar
const navButtons = Array.from(document.querySelectorAll(".navbtn"));
const navAllBtn = $("navAllBtn");
const navUsersBtn = $("navUsersBtn");
const adminSep = $("adminSep");

// home
const statTotal = $("statTotal");
const statLast = $("statLast");
const homeMsg = $("homeMsg");
const goAddBtn = $("goAddBtn");
const goMyBtn = $("goMyBtn");

// my
const myPropsStatus = $("myPropsStatus");
const myPropsGrid = $("myPropsGrid");
const myMsg = $("myMsg");
const refreshMyBtn = $("refreshMyBtn");

// all
const allPropsStatus = $("allPropsStatus");
const allPropsGrid = $("allPropsGrid");
const refreshAllBtn = $("refreshAllBtn");

// add property
const form = $("propertyForm");
const formMsg = $("formMsg");
const resetBtn = $("resetBtn");
const codePreview = $("codePreview");
const imageInput = $("imageInput");
const imagePreview = $("imagePreview");

// edit property modal
const editIdBadge = $("editId");
const editCodeBadge = $("editCode");
const editMsg = $("editMsg");
const saveEditBtn = $("saveEditBtn");
const e_title = $("e_title");
const e_price = $("e_price");
const e_propertyType = $("e_propertyType");
const e_transactionType = $("e_transactionType");
const e_region = $("e_region");
const e_rooms = $("e_rooms");
const e_area = $("e_area");
const e_bathrooms = $("e_bathrooms");
const e_kitchenAera = $("e_kitchenAera");
const e_floor = $("e_floor");
const e_totalFloors = $("e_totalFloors");
const e_ceilingHeight = $("e_ceilingHeight");
const e_features = $("e_features");
const existingPreview = $("existingPreview");
const editImageInput = $("editImageInput");
const newPreview = $("newPreview");

const e_statusButtons = Array.from(
  document.querySelectorAll("#e_statusGroup [data-status]")
);

// users
const refreshUsersBtn = $("refreshUsersBtn");
const usersTbody = $("usersTbody");
const usersStatus = $("usersStatus");
const usersMsg = $("usersMsg");
const usersSearch = $("usersSearch");

// create user form
const createUserForm = $("createUserForm");
const cu_name = $("cu_name");
const cu_phone = $("cu_phone");
const cu_email = $("cu_email");
const cu_password = $("cu_password");
const cu_role = $("cu_role");
const cu_reset = $("cu_reset");
const cu_photo = $("cu_photo");
const cu_photoPreview = $("cu_photoPreview");

// bulk transfer (users page)
const tr_from = $("tr_from");
const tr_to = $("tr_to");
const transferBtn = $("transferBtn");
const transferSwap = $("transferSwap");
const transferMsg = $("transferMsg");

// user edit modal
const ue_uid = $("ue_uid");
const ue_name = $("ue_name");
const ue_phone = $("ue_phone");
const ue_email = $("ue_email");
const ue_role = $("ue_role");
const ue_msg = $("ue_msg");
const ue_save = $("ue_save");
const ue_delete = $("ue_delete");
const ue_currentPhotoPreview = $("ue_currentPhotoPreview");
const ue_photo = $("ue_photo");
const ue_photoPreview = $("ue_photoPreview");

/* =========================
   State
========================= */
let currentUser = null;
let currentRole = "agent";
let isAdmin = false;

let usersCache = [];
const usersByUid = new Map();

let selectedImages = []; // add property images
let generatedCode = null;

// edit property
let editModalInstance = null;
let editingId = null;
let existingImageUrls = [];
let newImageFiles = [];
let selectedEditStatus = "active";

// user create/edit photos
let createUserPhotoFile = null;
let createUserPhotoObjectUrl = null;
let editUserPhotoFile = null;
let editUserPhotoObjectUrl = null;
let currentEditingUserPhotoUrl = "";
let userEditModalInstance = null;
let editingUserUid = null;

// dynamic transfer modal
let propertyTransferModal = null;
let transferPropertyId = null;

/* =========================
   Small UI setters
========================= */
function setFormMsg(text, ok = true) { setMsg(formMsg, text, ok); }
function setMyMsg(text, ok = true) { setMsg(myMsg, text, ok); }
function setEditMsg(text, ok = true) { setMsg(editMsg, text, ok); }
function setUsersMsg(text, ok = true) { setMsg(usersMsg, text, ok); }
function setTransferMsg(text, ok = true) { setMsg(transferMsg, text, ok); }
function setUeMsg(text, ok = true) { setMsg(ue_msg, text, ok); }

function getUserData(uid) {
  if (!uid) return null;
  return usersByUid.get(uid) || usersCache.find((u) => u.uid === uid) || null;
}

function getUserDisplayName(uid, fallback = "—") {
  const u = getUserData(uid);
  return (u && (u.name || u.email)) ? (u.name || u.email) : fallback;
}

function getAgentsList() {
  return usersCache
    .filter((u) => normalizeRole(u.role) !== "admin")
    .map((u) => ({ uid: u.uid, name: u.name || u.email || "—" }));
}

function updateTopBadgeLabelAndValue(nameText) {
  if (uidBadge) uidBadge.textContent = nameText || "-";

  const topbar = uidBadge?.closest(".topbar");
  if (topbar) {
    const spans = Array.from(topbar.querySelectorAll("span.small-muted"));
    const uidLabel = spans.find((s) => (s.textContent || "").trim().toUpperCase() === "UID:");
    if (uidLabel) uidLabel.textContent = "Agent:";
  }
}

/* =========================
   Edit Status UI (buton selectat clar)
========================= */
function setEditStatusUI(status) {
  selectedEditStatus = normalizeStatus(status);
  e_statusButtons.forEach((btn) => {
    const st = btn.getAttribute("data-status");
    const isOn = st === selectedEditStatus;

    // reset
    btn.classList.remove("btn-success", "btn-secondary", "btn-danger", "btn-warning");
    btn.classList.add(
      st === "active" ? "btn-outline-success" :
        st === "stopped" ? "btn-outline-secondary" :
          st === "sold" ? "btn-outline-danger" :
            "btn-outline-warning"
    );

    btn.classList.toggle("active", isOn);
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");

    if (isOn) {
      // fill style
      btn.classList.remove(
        "btn-outline-success",
        "btn-outline-secondary",
        "btn-outline-danger",
        "btn-outline-warning"
      );
      btn.classList.add(
        st === "active" ? "btn-success" :
          st === "stopped" ? "btn-secondary" :
            st === "sold" ? "btn-danger" :
              "btn-warning"
      );
    }
  });
}

// bind clicks o singură dată
e_statusButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setEditStatusUI(btn.getAttribute("data-status"));
  });
});

/* =========================
   Cloudinary upload
========================= */
async function uploadImagesToCloudinary(files) {
  const urls = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    if (!res.ok || !data.secure_url) {
      console.error("Cloudinary error:", data);
      throw new Error("Upload eșuat (Cloudinary).");
    }
    urls.push(data.secure_url);
  }
  return urls;
}

async function uploadSingleImageToCloudinary(file) {
  const [url] = await uploadImagesToCloudinary([file]);
  return url;
}

/* =========================
   Role + current user profile
========================= */
async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "agent";
    return String(snap.data().role || "agent").toLowerCase();
  } catch (e) {
    console.error("Role read error:", e);
    return "agent";
  }
}

async function loadCurrentUserName(uid, emailFallback = "") {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      const nm = String(d.name || "").trim();
      return nm || String(d.email || "").trim() || emailFallback || "";
    }
  } catch (e) {
    console.warn("Cannot load current user name:", e);
  }
  return emailFallback || "";
}

/* =========================
   Sidebar routing
========================= */
function hideAllViews() {
  viewHome?.classList.add("d-none");
  viewMy?.classList.add("d-none");
  viewAdd?.classList.add("d-none");
  viewAll?.classList.add("d-none");
  viewUsers?.classList.add("d-none");
}

function setActiveNav(name) {
  navButtons.forEach((b) => b.classList.remove("active"));
  const activeBtn = navButtons.find((b) => b.dataset.view === name);
  if (activeBtn) activeBtn.classList.add("active");
}

function showView(name) {
  hideAllViews();
  setActiveNav(name);

  if (name === "home") {
    viewHome?.classList.remove("d-none");
    pageTitle.textContent = "Acasă";
    pageSubtitle.textContent = "Panoul tău de control.";
    return;
  }

  if (name === "my") {
    viewMy?.classList.remove("d-none");
    pageTitle.textContent = "Proprietățile mele";
    pageSubtitle.textContent = "Aici vezi doar imobilele tale.";
    loadMyProperties();
    return;
  }

  if (name === "add") {
    viewAdd?.classList.remove("d-none");
    pageTitle.textContent = "Adaugă proprietate";
    pageSubtitle.textContent = "Completează formularul și publică.";
    return;
  }

  if (name === "all") {
    if (!isAdmin) return showView("home");
    viewAll?.classList.remove("d-none");
    pageTitle.textContent = "Admin";
    pageSubtitle.textContent = "Toate proprietățile din sistem.";
    loadAllProperties();
    return;
  }

  if (name === "users") {
    if (!isAdmin) return showView("home");
    viewUsers?.classList.remove("d-none");
    pageTitle.textContent = "Utilizatori";
    pageSubtitle.textContent = "Administrare utilizatori și transfer proprietăți.";
    loadUsers();
    return;
  }

  showView("home");
}

navButtons.forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));
goAddBtn?.addEventListener("click", () => showView("add"));
goMyBtn?.addEventListener("click", () => showView("my"));

/* =========================
   Logout
========================= */
logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../pages/login.html";
});

/* =========================
   Add Property - images preview
========================= */
imageInput?.addEventListener("change", () => {
  const files = Array.from(imageInput.files || []);
  if (!files.length) return;
  selectedImages.push(...files);
  imageInput.value = "";
  renderPropertyImagesPreview();
});

function renderPropertyImagesPreview() {
  if (!imagePreview) return;
  imagePreview.innerHTML = "";
  selectedImages.forEach((file, idx) => {
    const div = document.createElement("div");
    div.className = "preview-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);

    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.addEventListener("click", () => {
      try { URL.revokeObjectURL(img.src); } catch { }
      selectedImages.splice(idx, 1);
      renderPropertyImagesPreview();
    });

    div.appendChild(img);
    div.appendChild(x);
    imagePreview.appendChild(div);
  });
}

/* =========================
   Unique 5-digit code
========================= */
function random5() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function generateUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = random5();
    const qy = query(collection(db, "properties"), where("code", "==", code));
    const snap = await getDocs(qy);
    if (snap.empty) return code;
  }
  return random5();
}

async function initCode() {
  generatedCode = await generateUniqueCode();
  if (codePreview) codePreview.textContent = generatedCode;
}

resetBtn?.addEventListener("click", async () => {
  form?.reset();
  selectedImages = [];
  if (imagePreview) imagePreview.innerHTML = "";
  setFormMsg("Resetat.", true);
  await initCode();
});

/* =========================
   Load My properties
========================= */
async function loadMyProperties() {
  if (!currentUser) return;

  myPropsStatus.textContent = "Se încarcă...";
  myPropsGrid.innerHTML = "";
  setMyMsg("");

  try {
    const qy = query(
      collection(db, "properties"),
      where("agentId", "==", currentUser.uid),
      orderBy("title")
    );
    const snap = await getDocs(qy);

    if (snap.empty) {
      myPropsStatus.textContent = "Nu ai proprietăți încă.";
      statTotal.textContent = "0";
      statLast.textContent = "-";
      return;
    }

    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

    myPropsStatus.textContent = `Găsite: ${items.length}`;
    renderProperties(items, false);

    statTotal.textContent = String(items.length);
    statLast.textContent = items[items.length - 1]?.title || "-";
  } catch (e) {
    console.error(e);
    myPropsStatus.textContent = "Eroare la încărcare.";
    setMyMsg("Eroare: " + (e?.message || e), false);
  }
}

/* =========================
   Load All properties (Admin)
========================= */
async function loadAllProperties() {
  if (!currentUser || !isAdmin) return;

  allPropsStatus.textContent = "Se încarcă...";
  allPropsGrid.innerHTML = "";

  try {
    const snap = await getDocs(collection(db, "properties"));
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

    allPropsStatus.textContent = `Total: ${items.length}`;
    renderProperties(items, true);
  } catch (e) {
    console.error(e);
    allPropsStatus.textContent = "Eroare la încărcare.";
  }
}

refreshMyBtn?.addEventListener("click", loadMyProperties);
refreshAllBtn?.addEventListener("click", loadAllProperties);

/* =========================
   Transfer modal (Admin) - dinamic
========================= */
function ensurePropertyTransferModal() {
  if (propertyTransferModal) return propertyTransferModal;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="modal fade" id="propTransferModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" style="max-width:520px;">
    <div class="modal-content" style="border-radius:14px;border:0;overflow:visible;">
      <div class="modal-header" style="padding:20px 24px;">
        <h5 class="modal-title">Transferă proprietatea</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>

      <div class="modal-body" style="padding:24px;overflow:visible;min-height:160px;">
        <div class="small-muted mb-3">Alege agentul către care se transferă această proprietate.</div>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label fw-semibold">Agent nou</label>
            <select id="pt_to"></select>
          </div>
          <div class="col-12">
            <div id="pt_msg" class="small-muted"></div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="padding:16px 24px;">
        <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Închide</button>
        <button id="pt_confirm" class="btn btn-danger">Transferă</button>
      </div>
    </div>
  </div>
</div>`;
  document.body.appendChild(wrap);

  const el = $("propTransferModal");
  propertyTransferModal = new bootstrap.Modal(el);

  const pt_to = $("pt_to");
  const pt_msg = $("pt_msg");
  const pt_confirm = $("pt_confirm");

  const setPtMsg = (text, ok = true) => {
    if (!pt_msg) return;
    pt_msg.textContent = text || "";
    pt_msg.style.color = ok ? "#198754" : "#dc3545";
  };

  const fillAgents = (currentAgentId) => {
    if (!pt_to) return;
    pt_to.innerHTML = "";

    const agents = getAgentsList();
    agents.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.uid;
      opt.textContent = a.name;
      pt_to.appendChild(opt);
    });

    const firstDifferent = agents.find((a) => a.uid !== currentAgentId);
    if (firstDifferent) pt_to.value = firstDifferent.uid;
  };

  el.addEventListener("show.bs.modal", async () => {
    setPtMsg("");
    if (!transferPropertyId) return;

    try {
      const snap = await getDoc(doc(db, "properties", transferPropertyId));
      const currentAgentId = snap.exists() ? (snap.data().agentId || "") : "";
      fillAgents(currentAgentId);
    } catch (e) {
      console.error(e);
      fillAgents("");
    }

    // Aplică stilul custom după populare
    setTimeout(() => {
      // Permite dropdown-ului să iasă din modal
      const modalContent = el.querySelector(".modal-content");
      const modalBody = el.querySelector(".modal-body");
      if (modalContent) modalContent.style.overflow = "visible";
      if (modalBody) modalBody.style.overflow = "visible";

      // Distruge wrapper-ul vechi dacă există
      const pt_toEl = $("pt_to");
      if (pt_toEl) {
        const oldWrapper = pt_toEl.parentNode.querySelector(".cs-wrapper");
        if (oldWrapper) oldWrapper.remove();
        pt_toEl.style.opacity = "";
        pt_toEl.style.position = "";
        pt_toEl.style.pointerEvents = "";
      }

      if (typeof window.transformSelects === "function") {
        window.transformSelects();
      }
    }, 0);
  });

  pt_confirm?.addEventListener("click", async () => {
    if (!isAdmin || !transferPropertyId) return;

    const toUid = pt_to?.value || "";
    if (!toUid) return setPtMsg("Selectează un agent.", false);

    try {
      setPtMsg("Transfer în curs...", true);

      const ref = doc(db, "properties", transferPropertyId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return setPtMsg("Proprietatea nu există.", false);

      const fromUid = snap.data().agentId || "";
      if (fromUid === toUid) return setPtMsg("Alege un agent diferit.", false);

      await updateDoc(ref, { agentId: toUid });

      setPtMsg("Transferat ✅", true);

      await loadMyProperties();
      await loadAllProperties();

      setTimeout(() => {
        try { propertyTransferModal?.hide(); } catch { }
      }, 450);
    } catch (e) {
      console.error(e);
      setPtMsg("Eroare: " + (e?.message || e), false);
    }
  });

  return propertyTransferModal;
}

function openPropertyTransferModal(propertyId) {
  transferPropertyId = propertyId;
  ensurePropertyTransferModal().show();
}

/* =========================
   Render properties (cards) + OVERLAY
========================= */
function renderProperties(items, adminMode) {
  const targetGrid = adminMode ? allPropsGrid : myPropsGrid;
  if (!targetGrid) return;
  targetGrid.innerHTML = "";

  items.forEach((p) => {
    const st = normalizeStatus(p.status);
    const img =
      p.mainImage ||
      (Array.isArray(p.images) ? p.images[0] : "") ||
      "../images/img1.png";

    const agentName = adminMode ? getUserDisplayName(p.agentId, "—") : "";
    const overlayText = statusOverlayText(st);

    const col = document.createElement("div");
    col.className = "prop-col";

    // IMPORTANT:
    // - card are clasa prop-card
    // - data-status=... ca să pornească overlay-ul din CSS-ul tău
    col.innerHTML = `
<div class="card shadow-sm h-100 prop-card" data-status="${esc(st)}">
  <div class="prop-img-wrap">
    <img src="${esc(img)}" alt="imobil">
    <div class="prop-status-overlay"><span>${esc(overlayText)}</span></div>
  </div>

  <div class="card-body">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <h5 class="card-title mb-1">${esc(p.title || "Fără titlu")}</h5>
      <span class="badge text-bg-dark badge-code">${esc(p.code || "")}</span>
    </div>

    <div class="small-muted mb-2">${esc(p.region || "")}</div>

    <div class="d-flex flex-wrap gap-2 mb-2">
      <span class="badge text-bg-light">${esc(p.propertyType || "")}</span>

      <span class="badge ${p.transactionType === "rent" ? "text-bg-warning" : "text-bg-danger"}">
        ${p.transactionType === "rent" ? "Chirie" : "Vânzare"}
      </span>

      <span class="badge ${statusBadgeClass(st)}">Status: ${esc(statusLabel(st))}</span>

      ${adminMode ? `<span class="badge text-bg-secondary">agent: ${esc(agentName)}</span>` : ``}
    </div>

    <div class="fw-semibold mb-3">${esc(fmtPriceEUR(p.price))}</div>

    <div class="d-flex gap-2 flex-wrap">
      ${adminMode ? `<button class="btn btn-outline-secondary btn-sm" data-transfer="${esc(p.id)}">Transferă</button>` : ``}
      <button class="btn btn-outline-primary btn-sm" data-edit="${esc(p.id)}">Editează</button>
      <button class="btn btn-outline-danger btn-sm" data-del="${esc(p.id)}">Șterge</button>
    </div>
  </div>
</div>
`;

    targetGrid.appendChild(col);
  });

  // delete
  targetGrid.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      if (!confirm("Sigur vrei să ștergi această proprietate?")) return;

      try {
        await deleteDoc(doc(db, "properties", id));
        if (!adminMode) setMyMsg("Șters ✅", true);
        await loadMyProperties();
        if (isAdmin) await loadAllProperties();
      } catch (e) {
        console.error(e);
        const msg = "Nu am putut șterge. Verifică regulile Firestore.";
        if (!adminMode) setMyMsg(msg, false);
        else alert(msg);
      }
    });
  });

  // edit
  targetGrid.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.getAttribute("data-edit"), adminMode));
  });

  // transfer (admin)
  targetGrid.querySelectorAll("[data-transfer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-transfer");
      if (!id || !isAdmin) return;
      openPropertyTransferModal(id);
    });
  });
}

/* =========================
   Edit property modal
========================= */
function renderExistingImages() {
  if (!existingPreview) return;
  existingPreview.innerHTML = "";
  existingImageUrls.forEach((url, idx) => {
    const div = document.createElement("div");
    div.className = "preview-item";

    const img = document.createElement("img");
    img.src = url;

    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.addEventListener("click", () => {
      existingImageUrls.splice(idx, 1);
      renderExistingImages();
    });

    div.appendChild(img);
    div.appendChild(x);
    existingPreview.appendChild(div);
  });
}

function renderNewImages() {
  if (!newPreview) return;
  newPreview.innerHTML = "";
  newImageFiles.forEach((file, idx) => {
    const div = document.createElement("div");
    div.className = "preview-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);

    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.addEventListener("click", () => {
      try { URL.revokeObjectURL(img.src); } catch { }
      newImageFiles.splice(idx, 1);
      renderNewImages();
    });

    div.appendChild(img);
    div.appendChild(x);
    newPreview.appendChild(div);
  });
}

editImageInput?.addEventListener("change", () => {
  const files = Array.from(editImageInput.files || []);
  if (!files.length) return;
  newImageFiles.push(...files);
  editImageInput.value = "";
  renderNewImages();
});

async function openEditModal(id, adminMode) {
  try {
    if (!id || !currentUser) return;

    editingId = id;
    setEditMsg("");

    if (!editModalInstance) {
      const modalEl = $("editModal");
      editModalInstance = new bootstrap.Modal(modalEl);
    }

    editIdBadge.textContent = id;

    const ref = doc(db, "properties", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setEditMsg("Proprietatea nu există.", false);
      editModalInstance.show();
      return;
    }

    const p = snap.data();

    if (!adminMode && p.agentId !== currentUser.uid) {
      setEditMsg("Nu ai voie să editezi această proprietate.", false);
      editModalInstance.show();
      return;
    }

    editCodeBadge.textContent = p.code || "-----";

    e_title.value = p.title || "";
    e_price.value = p.price ?? "";
    e_propertyType.value = p.propertyType || "";
    e_transactionType.value = p.transactionType || "sale";
    e_region.value = p.region || "";

    e_rooms.value = p.rooms ?? "";
    e_area.value = p.area ?? "";
    e_bathrooms.value = p.bathrooms ?? "";
    e_kitchenAera.value = p.kitchenAera ?? "";
    e_floor.value = p.floor ?? "";
    e_totalFloors.value = p.totalFloors ?? "";
    e_ceilingHeight.value = p.ceilingHeight ?? "";
    e_features.value = Array.isArray(p.features) ? p.features.join(", ") : "";

    setEditStatusUI(normalizeStatus(p.status));

    existingImageUrls = Array.isArray(p.images) ? [...p.images] : [];
    newImageFiles = [];

    renderExistingImages();
    renderNewImages();

    editModalInstance.show();
  } catch (e) {
    console.error(e);
    alert("Eroare la editare: " + (e.message || e));
  }
}

saveEditBtn?.addEventListener("click", async () => {
  if (!editingId || !currentUser) return;

  try {
    setEditMsg("Salvez...", true);

    const title = (e_title.value || "").trim();
    const price = toNum(e_price.value);
    const propertyType = (e_propertyType.value || "").trim();
    const transactionType = e_transactionType.value;
    const region = (e_region.value || "").trim();

    if (!title) return setEditMsg("Titlul e obligatoriu.", false);
    if (!price || price <= 0) return setEditMsg("Preț invalid.", false);
    if (!propertyType) return setEditMsg("Tip proprietate obligatoriu.", false);
    if (!region) return setEditMsg("Regiune obligatorie.", false);

    const rooms = toNum(e_rooms.value);
    const area = toNum(e_area.value);
    const bathrooms = toNum(e_bathrooms.value);
    const kitchenAera = toNum(e_kitchenAera.value);
    const floor = toNum(e_floor.value);
    const totalFloors = toNum(e_totalFloors.value);
    const ceilingHeight = toNum(e_ceilingHeight.value);
    const features = parseFeatures(e_features.value);

    const status = normalizeStatus(selectedEditStatus);

    // upload imagini noi
    let uploaded = [];
    if (newImageFiles.length) {
      setEditMsg("Încarc imaginile noi...", true);
      uploaded = await uploadImagesToCloudinary(newImageFiles);
    }

    const finalImages = [...existingImageUrls, ...uploaded];
    const mainImage = finalImages[0] || "";

    // re-check permisiune
    const currentSnap = await getDoc(doc(db, "properties", editingId));
    if (!currentSnap.exists()) return setEditMsg("Document inexistent.", false);
    if (!isAdmin && currentSnap.data().agentId !== currentUser.uid) return setEditMsg("Nu ai voie.", false);

    await updateDoc(doc(db, "properties", editingId), {
      title,
      price,
      propertyType,
      transactionType,
      region,
      status,
      rooms: rooms ?? null,
      area: area ?? null,
      bathrooms: bathrooms ?? null,
      kitchenAera: kitchenAera ?? null,
      floor: floor ?? null,
      totalFloors: totalFloors ?? null,
      ceilingHeight: ceilingHeight ?? null,
      features,
      images: finalImages,
      mainImage,
    });

    setEditMsg("Salvat ✅", true);

    await loadMyProperties();
    if (isAdmin) await loadAllProperties();

    setTimeout(() => {
      try { editModalInstance?.hide(); } catch { }
    }, 450);
  } catch (e) {
    console.error(e);
    setEditMsg("Eroare la salvare: " + (e.message || e), false);
  }
});

/* =========================
   Submit Add Property
========================= */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  try {
    setFormMsg("Se publică...", true);

    const title = ($("title").value || "").trim();
    const price = toNum($("price").value);
    const propertyType = ($("propertyType").value || "").trim();
    const transactionType = $("transactionType").value;
    const region = ($("region").value || "").trim();

    const rooms = toNum($("rooms").value);
    const area = toNum($("area").value);
    const bathrooms = toNum($("bathrooms").value);
    const kitchenAera = toNum($("kitchenAera").value);
    const floor = toNum($("floor").value);
    const totalFloors = toNum($("totalFloors").value);
    const ceilingHeight = toNum($("ceilingHeight").value);
    const features = parseFeatures($("features").value);

    if (!title) return setFormMsg("Titlul este obligatoriu.", false);
    if (!price || price <= 0) return setFormMsg("Preț invalid.", false);
    if (!propertyType) return setFormMsg("Tip proprietate este obligatoriu.", false);
    if (!region) return setFormMsg("Regiunea este obligatorie.", false);

    if (!generatedCode) await initCode();
    const code = generatedCode;

    let imageUrls = [];
    if (selectedImages.length) {
      setFormMsg("Încarc imaginile...", true);
      imageUrls = await uploadImagesToCloudinary(selectedImages);
    }

    const mainImage = imageUrls[0] || "";

    await addDoc(collection(db, "properties"), {
      agentId: currentUser.uid,
      area: area ?? null,
      bathrooms: bathrooms ?? null,
      ceilingHeight: ceilingHeight ?? null,
      code,
      features,
      floor: floor ?? null,
      images: imageUrls,
      kitchenAera: kitchenAera ?? null,
      mainImage,
      price,
      propertyType,
      region,
      rooms: rooms ?? null,
      title,
      totalFloors: totalFloors ?? null,
      transactionType,
      status: "active",
    });

    setFormMsg("Publicat cu succes ✅", true);

    form.reset();
    selectedImages = [];
    if (imagePreview) imagePreview.innerHTML = "";
    await initCode();

    await loadMyProperties();
    if (isAdmin) await loadAllProperties();

    showView("my");
  } catch (err) {
    console.error(err);
    setFormMsg("Eroare: " + (err.message || "nu s-a putut publica"), false);
  }
});

/* =========================
   USERS: Photo preview handlers
========================= */
function clearCreateUserPhotoState() {
  createUserPhotoFile = null;
  if (createUserPhotoObjectUrl) {
    try { URL.revokeObjectURL(createUserPhotoObjectUrl); } catch { }
    createUserPhotoObjectUrl = null;
  }
  if (cu_photo) cu_photo.value = "";
  if (cu_photoPreview) cu_photoPreview.innerHTML = "";
}

function clearEditUserPhotoState() {
  editUserPhotoFile = null;
  if (editUserPhotoObjectUrl) {
    try { URL.revokeObjectURL(editUserPhotoObjectUrl); } catch { }
    editUserPhotoObjectUrl = null;
  }
  if (ue_photo) ue_photo.value = "";
  if (ue_photoPreview) ue_photoPreview.innerHTML = "";
}

cu_photo?.addEventListener("change", () => {
  const file = cu_photo.files?.[0] || null;
  if (!file) return;
  clearCreateUserPhotoState();
  createUserPhotoFile = file;
  createUserPhotoObjectUrl = URL.createObjectURL(file);

  if (cu_photoPreview) {
    cu_photoPreview.innerHTML = `
      <div class="preview-item">
        <img src="${esc(createUserPhotoObjectUrl)}" alt="preview">
        <button type="button" title="Șterge">✕</button>
      </div>
    `;
    cu_photoPreview.querySelector("button")?.addEventListener("click", () => {
      clearCreateUserPhotoState();
    });
  }
});

ue_photo?.addEventListener("change", () => {
  const file = ue_photo.files?.[0] || null;
  if (!file) return;
  clearEditUserPhotoState();
  editUserPhotoFile = file;
  editUserPhotoObjectUrl = URL.createObjectURL(file);

  if (ue_photoPreview) {
    ue_photoPreview.innerHTML = `
      <div class="preview-item">
        <img src="${esc(editUserPhotoObjectUrl)}" alt="preview">
        <button type="button" title="Șterge">✕</button>
      </div>
    `;
    ue_photoPreview.querySelector("button")?.addEventListener("click", () => {
      clearEditUserPhotoState();
    });
  }
});

/* =========================
   ADMIN: Load users
========================= */
async function loadUsers() {
  if (!isAdmin) return;

  usersStatus.textContent = "Se încarcă utilizatorii...";
  usersTbody.innerHTML = "";
  setUsersMsg("");
  setTransferMsg("");

  try {
    const snap = await getDocs(collection(db, "users"));
    const items = [];
    snap.forEach((d) => items.push({ uid: d.id, ...d.data() }));

    items.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ro", { sensitivity: "base" })
    );

    usersCache = items;
    usersByUid.clear();
    items.forEach((u) => usersByUid.set(u.uid, u));

    renderUsersTable();
    fillTransferSelects();

    usersStatus.textContent = `Total: ${items.length}`;
  } catch (e) {
    console.error(e);
    usersStatus.textContent = "Eroare la încărcare.";
    setUsersMsg("Eroare: " + (e.message || e), false);
  }
}

function renderUsersTable() {
  if (!usersTbody) return;

  const q = (usersSearch?.value || "").trim().toLowerCase();
  const list = !q
    ? usersCache
    : usersCache.filter((u) => {
      const hay = [u.name, u.email, u.phone, u.role].join(" ").toLowerCase();
      return hay.includes(q);
    });

  usersTbody.innerHTML = "";

  list.forEach((u) => {
    const role = normalizeRole(u.role);
    const photo = u.photoUrl || "";
    const isSelf = currentUser && u.uid === currentUser.uid;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="d-flex align-items-center gap-2">
          <div style="width:34px;height:34px;border-radius:10px;border:2px solid rgba(183,28,28,.12);background:#fff;overflow:hidden;">
            ${photo ? `<img src="${esc(photo)}" style="width:100%;height:100%;object-fit:cover" alt="avatar">` : ""}
          </div>
          <div>${esc(u.name || "-")}</div>
        </div>
      </td>
      <td>${esc(u.email || "-")}</td>
      <td>${esc(u.phone || "-")}</td>
      <td><span class="badge ${role === "admin" ? "text-bg-danger" : "text-bg-secondary"}">${esc(role)}</span></td>
      <td class="d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-outline-primary" data-edit-user="${esc(u.uid)}">Editează</button>
        <button class="btn btn-sm btn-outline-danger" data-del-user="${esc(u.uid)}" ${isSelf ? "disabled" : ""}>Șterge</button>
      </td>
    `;
    usersTbody.appendChild(tr);
  });

  usersTbody.querySelectorAll("[data-edit-user]").forEach((btn) => {
    btn.addEventListener("click", () => openUserEditModal(btn.getAttribute("data-edit-user")));
  });

  usersTbody.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-del-user");
      if (!uid) return;
      await deleteUserFlow(uid);
    });
  });
}

function fillTransferSelects() {
  if (!tr_from || !tr_to) return;

  const agents = getAgentsList().map((a) => ({ uid: a.uid, label: a.name }));

  const build = (sel) => {
    sel.innerHTML = "";
    agents.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.uid;
      opt.textContent = a.label;
      sel.appendChild(opt);
    });
  };

  build(tr_from);
  build(tr_to);

  if (agents.length >= 2) {
    tr_from.value = agents[0].uid;
    tr_to.value = agents[1].uid;
  }

  // Transformă selecturile populate dinamic
  window.transformSelects();
}

usersSearch?.addEventListener("input", () => renderUsersTable());
refreshUsersBtn?.addEventListener("click", loadUsers);

cu_reset?.addEventListener("click", () => {
  createUserForm?.reset();
  clearCreateUserPhotoState();
  setUsersMsg("");
});

/* =========================
   ADMIN: Create user (cu poză)
========================= */
createUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const name = (cu_name.value || "").trim();
  const phone = (cu_phone.value || "").trim();
  const email = (cu_email.value || "").trim();
  const password = (cu_password.value || "");
  const role = normalizeRole(cu_role.value);

  if (!name) return setUsersMsg("Numele este obligatoriu.", false);
  if (!email) return setUsersMsg("Email obligatoriu.", false);
  if (!password || password.length < 6) return setUsersMsg("Parola minim 6 caractere.", false);

  try {
    setUsersMsg("Creez utilizatorul...", true);

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    let photoUrl = "";
    if (createUserPhotoFile) {
      setUsersMsg("Încarc poza pe Cloudinary...", true);
      photoUrl = await uploadSingleImageToCloudinary(createUserPhotoFile);
    }

    await setDoc(doc(db, "users", cred.user.uid), { name, phone, email, role, photoUrl }, { merge: true });

    try { await signOut(secondaryAuth); } catch { }

    setUsersMsg("Utilizator creat ✅", true);
    createUserForm.reset();
    clearCreateUserPhotoState();

    await loadUsers();
  } catch (err) {
    console.error(err);
    setUsersMsg("Eroare creare user: " + (err?.message || err), false);
  }
});

/* =========================
   ADMIN: Edit user modal
========================= */
async function openUserEditModal(uid) {
  if (!uid) return;

  editingUserUid = uid;
  setUeMsg("");

  if (!userEditModalInstance) {
    const el = $("userEditModal");
    userEditModalInstance = new bootstrap.Modal(el);
  }

  clearEditUserPhotoState();
  currentEditingUserPhotoUrl = "";

  let u = usersCache.find((x) => x.uid === uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) u = { uid, ...snap.data() };
  } catch { }

  if (ue_uid) ue_uid.textContent = (u?.name || u?.email || "—");
  ue_name.value = u?.name || "";
  ue_phone.value = u?.phone || "";
  ue_email.value = u?.email || "";
  ue_role.value = normalizeRole(u?.role);
  currentEditingUserPhotoUrl = u?.photoUrl || "";

  if (ue_currentPhotoPreview) {
    ue_currentPhotoPreview.innerHTML = currentEditingUserPhotoUrl
      ? `<div class="preview-item"><img src="${esc(currentEditingUserPhotoUrl)}" alt="current"></div>`
      : `<div class="small text-muted">— fără poză —</div>`;
  }

  if (ue_delete) {
    const isSelf = currentUser && uid === currentUser.uid;
    ue_delete.disabled = !!isSelf;
    ue_delete.title = isSelf ? "Nu poți șterge propriul cont." : "";
  }

  userEditModalInstance.show();
}

ue_save?.addEventListener("click", async () => {
  if (!isAdmin || !editingUserUid) return;

  const name = (ue_name.value || "").trim();
  const phone = (ue_phone.value || "").trim();
  const role = normalizeRole(ue_role.value);

  if (!name) return setUeMsg("Numele este obligatoriu.", false);

  try {
    setUeMsg("Salvez...", true);

    let photoUrl = currentEditingUserPhotoUrl || "";
    if (editUserPhotoFile) {
      setUeMsg("Încarc poza nouă pe Cloudinary...", true);
      photoUrl = await uploadSingleImageToCloudinary(editUserPhotoFile);
    }

    await updateDoc(doc(db, "users", editingUserUid), { name, phone, role, photoUrl });

    setUeMsg("Salvat ✅", true);
    await loadUsers();

    setTimeout(() => {
      try { userEditModalInstance?.hide(); } catch { }
    }, 350);
  } catch (e) {
    console.error(e);
    setUeMsg("Eroare: " + (e?.message || e), false);
  }
});

/* =========================
   DELETE USER (Admin) + transfer/ștergere proprietăți
========================= */
async function commitBatchInChunks(ops, chunkSize = 450) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    ops.slice(i, i + chunkSize).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

function getUserLabel(uid) {
  const u = usersCache.find((x) => x.uid === uid);
  return (u?.name || u?.email || "—");
}

async function deleteUserFlow(uid) {
  if (!isAdmin) return;
  if (!uid) return;

  if (currentUser && uid === currentUser.uid) {
    alert("Nu poți șterge propriul cont.");
    return;
  }

  const label = getUserLabel(uid);
  if (!confirm(`Sigur vrei să ȘTERGI utilizatorul:\n${label}\n\n(Se va șterge din Firestore)`)) return;

  let propsSnap = null;
  try {
    propsSnap = await getDocs(query(collection(db, "properties"), where("agentId", "==", uid)));
  } catch (e) {
    console.error(e);
    alert("Nu pot verifica proprietățile. Verifică regulile Firestore.");
    return;
  }

  const count = propsSnap?.size || 0;
  let action = "none"; // transfer | deleteProps | none
  let toUid = "";

  if (count > 0) {
    const candidateTo = tr_to?.value || "";
    const canTransfer = candidateTo && candidateTo !== uid;

    if (canTransfer) {
      const toLabel = getUserLabel(candidateTo);
      const doTransfer = confirm(
        `Utilizatorul are ${count} proprietăți.\n\nOK = Transferă către:\n${toLabel}\n\nCancel = Șterge proprietățile.`
      );
      if (doTransfer) {
        action = "transfer";
        toUid = candidateTo;
      } else {
        action = "deleteProps";
      }
    } else {
      const doDeleteProps = confirm(
        `Utilizatorul are ${count} proprietăți.\n\nNu există agent țintă valid.\nOK = Șterge proprietățile.\nCancel = Anulează.`
      );
      if (!doDeleteProps) return;
      action = "deleteProps";
    }
  }

  if (!confirm("Ultima confirmare: continui cu ștergerea utilizatorului?")) return;

  try {
    if (count > 0 && propsSnap) {
      const ops = [];
      propsSnap.forEach((d) => {
        const ref = doc(db, "properties", d.id);
        if (action === "transfer") ops.push((batch) => batch.update(ref, { agentId: toUid }));
        if (action === "deleteProps") ops.push((batch) => batch.delete(ref));
      });

      if (ops.length) await commitBatchInChunks(ops);
    }

    await deleteDoc(doc(db, "users", uid));

    setUsersMsg("Utilizator șters ✅", true);
    setUeMsg("Utilizator șters ✅", true);

    await loadUsers();
    await loadAllProperties();
    await loadMyProperties();

    if (editingUserUid === uid) {
      editingUserUid = null;
      setTimeout(() => {
        try { userEditModalInstance?.hide(); } catch { }
      }, 250);
    }
  } catch (e) {
    console.error(e);
    alert("Eroare la ștergere: " + (e?.message || e));
    setUsersMsg("Eroare la ștergere: " + (e?.message || e), false);
    setUeMsg("Eroare la ștergere: " + (e?.message || e), false);
  }
}

ue_delete?.addEventListener("click", async () => {
  if (!isAdmin || !editingUserUid) return;
  await deleteUserFlow(editingUserUid);
});

/* =========================
   Transfer properties (bulk, users page)
========================= */
transferSwap?.addEventListener("click", () => {
  const a = tr_from.value;
  tr_from.value = tr_to.value;
  tr_to.value = a;
  // Reinițializează display-ul custom după swap
  window.transformSelects();
});

transferBtn?.addEventListener("click", async () => {
  if (!isAdmin) return;

  const fromUid = tr_from.value;
  const toUid = tr_to.value;

  if (!fromUid || !toUid) return setTransferMsg("Selectează ambii agenți.", false);
  if (fromUid === toUid) return setTransferMsg("Alege doi agenți diferiți.", false);

  const fromLabel = getUserLabel(fromUid);
  const toLabel = getUserLabel(toUid);

  if (!confirm(`Sigur vrei să transferi TOATE proprietățile de la:\n${fromLabel}\n\ncătre:\n${toLabel}?`)) return;

  try {
    setTransferMsg("Transfer în curs...", true);

    const qy = query(collection(db, "properties"), where("agentId", "==", fromUid));
    const snap = await getDocs(qy);

    if (snap.empty) {
      setTransferMsg("Nu există proprietăți pentru acest agent.", false);
      return;
    }

    const ops = [];
    let count = 0;

    snap.forEach((d) => {
      const ref = doc(db, "properties", d.id);
      ops.push((batch) => batch.update(ref, { agentId: toUid }));
      count++;
    });

    await commitBatchInChunks(ops);
    setTransferMsg(`Transfer complet ✅ (${count} proprietăți)`, true);

    await loadMyProperties();
    await loadAllProperties();
  } catch (e) {
    console.error(e);
    setTransferMsg("Eroare transfer: " + (e?.message || e), false);
  }
});

/* =========================
   Auth
========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  currentUser = user;
  if (authStatus) authStatus.textContent = `Autentificat: ${user.email}`;

  const currentUserName = await loadCurrentUserName(user.uid, user.email || "");
  updateTopBadgeLabelAndValue(currentUserName || (user.email || "-"));

  currentRole = await getUserRole(user.uid);
  isAdmin = currentRole === "admin";

  if (brandSub) brandSub.textContent = isAdmin ? "Admin Dashboard" : "Agent Dashboard";
  if (adminSep) adminSep.classList.toggle("d-none", !isAdmin);
  if (navAllBtn) navAllBtn.classList.toggle("d-none", !isAdmin);
  if (navUsersBtn) navUsersBtn.classList.toggle("d-none", !isAdmin);

  await initCode();

  // admin: întâi users (ca să avem numele agenților pe carduri), apoi proprietățile
  if (isAdmin) {
    await loadUsers();
    await loadAllProperties();
  }

  await loadMyProperties();

  if (homeMsg) {
    homeMsg.textContent = isAdmin
      ? "Ești admin. Ai acces complet la sistem."
      : "Totul e gata. Alege din meniu ce vrei să faci.";
  }

  showView("home");
});


let currentOpenDropdown = null;


window.transformSelects = function () {
  document.querySelectorAll("select").forEach(select => {

    const existingWrapper = select.parentNode.querySelector(".cs-wrapper");
    if (existingWrapper) {

      const display = existingWrapper.querySelector(".cs-display");
      const dropdown = existingWrapper.querySelector(".cs-dropdown");

      const selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
      display.textContent = select.options.length > 0 ? select.options[selectedIndex].text : "Selectează";

      dropdown.innerHTML = "";
      Array.from(select.options).forEach((option, index) => {
        const item = document.createElement("div");
        item.className = "cs-option";
        item.textContent = option.text;
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          select.selectedIndex = index;
          display.textContent = option.text;
          display.classList.remove("active", "open");
          dropdown.style.display = "none";
          currentOpenDropdown = null;
        });
        dropdown.appendChild(item);
      });
      return;
    }

    if (select.dataset.csTransformed === "1") return;


    select.dataset.csTransformed = "1";
    select.style.display = "none";
    select.classList.remove("form-select");

    const wrapper = document.createElement("div");
    wrapper.className = "cs-wrapper";

    const display = document.createElement("div");
    display.className = "cs-display";

    const selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
    display.textContent = select.options.length > 0 ? select.options[selectedIndex].text : "Selectează";

    const dropdown = document.createElement("div");
    dropdown.className = "cs-dropdown";

    Array.from(select.options).forEach((option, index) => {
      const item = document.createElement("div");
      item.className = "cs-option";
      item.textContent = option.text;

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        select.selectedIndex = index;
        display.textContent = option.text;
        display.classList.remove("active");
        display.classList.remove("open");
        dropdown.style.display = "none";
        currentOpenDropdown = null;
      });

      dropdown.appendChild(item);
    });

    display.addEventListener("click", (e) => {
      e.stopPropagation();

      if (currentOpenDropdown && currentOpenDropdown !== dropdown) {
        currentOpenDropdown.style.display = "none";
        currentOpenDropdown.parentNode.querySelector(".cs-display").classList.remove("active");
        currentOpenDropdown.parentNode.querySelector(".cs-display").classList.remove("open");
      }

      const isOpen = dropdown.style.display === "block";
      dropdown.style.display = isOpen ? "none" : "block";
      if (isOpen) {
        display.classList.remove("active");
        display.classList.remove("open");
        currentOpenDropdown = null;
      } else {
        display.classList.add("active");
        display.classList.add("open");
        currentOpenDropdown = dropdown;
      }
    });


    document.addEventListener("click", function closeDropdown(e) {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = "none";
        display.classList.remove("active");
        display.classList.remove("open");
        if (currentOpenDropdown === dropdown) currentOpenDropdown = null;
      }
    });

    wrapper.appendChild(display);
    wrapper.appendChild(dropdown);

    select.parentNode.insertBefore(wrapper, select.nextSibling);
  });
};

document.addEventListener("DOMContentLoaded", function () {
  window.transformSelects();
});
