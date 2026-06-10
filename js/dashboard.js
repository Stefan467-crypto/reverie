(function () {
  const _k = "#" + atob("cnYxNw==");
  if (window.location.hash !== _k) {
    window.location.replace("../index.html");
  }
})();

// ── Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getFirestore, addDoc, setDoc, collection, getDocs,
  query, where, deleteDoc, doc, updateDoc, getDoc, orderBy, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import {
  initI18n, t, onLanguageChange, getCurrentLanguage, translatePage,
  normalizeStatus, normalizeTransaction, translateStatus, translateTransaction,
  translatePropertyTypeRaw, translateFeature,
  generateTitle, formatLocation, translateLocation,
  getAllFeaturesSorted, ALL_FEATURES_RO,
  translateRegionOptions,
} from "./i18n.js";
import { initLangSwitcher } from "./langSwitcher.js";


// ── Firebase
const FB_CONFIG = {
  apiKey: "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
  authDomain: "reverie-c861c.firebaseapp.com",
  projectId: "reverie-c861c",
  storageBucket: "reverie-c861c.firebasestorage.app",
  messagingSenderId: "122254003952",
  appId: "1:122254003952:web:67dea6de1f5eb97a9b7c35",
};

const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const secondaryApp = initializeApp(FB_CONFIG, "secondary");
const secondaryAuth = getAuth(secondaryApp);


const CLOUD_NAME = "dp1y1xv5l";
const UPLOAD_PRESET = "reverie";
const PROJECTS_STORAGE_KEY = "reverie_projects";


const $ = id => document.getElementById(id);


// ── Slug & URL helpers
function toSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function setSelectValue(select, value) {
  if (!select) return;
  const norm = String(value ?? "").trim();

  const ci = window.choicesInstances?.get(select);
  if (ci) {
    try { ci.destroy(); } catch { }
    window.choicesInstances.delete(select);
  }

  const opt = Array.from(select.options).find(o => o.value.trim() === norm);
  select.value = opt ? opt.value : "";

  if (select.id === "e_region" || select.id === "region") {
    select.querySelectorAll("option[value]").forEach(o => {
      const v = o.value; if (!v) return;
      const tr = translateLocation(v);
      if (tr) o.textContent = tr;
    });
  }
  const newCi = new Choices(select, getChoicesConfig(select));
  window.choicesInstances.set(select, newCi);

  if (select.value) {
    try { newCi.setChoiceByValue(select.value); } catch { }
  }
}

function fmtPriceEUR(price) {
  if (price === null || price === undefined || price === "") return "-";
  const n = Number(price);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat(getCurrentLanguage() === "en" ? "en-US" : "ro-RO").format(n) + " €";
}

function setMsg(el, text, ok = true) {
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "#198754" : "#dc3545";
}

function normalizeRole(r) { return String(r || "agent").toLowerCase(); }

function statusBadgeClass(s) {
  if (s === "active") return "text-bg-success";
  if (s === "stopped") return "text-bg-secondary";
  if (s === "sold") return "text-bg-danger";
  if (s === "rented") return "text-bg-warning";
  return "text-bg-success";
}


function buildFeaturesWidget(containerEl, tagsEl, initialSelected = [], searchInputEl = null, clearButtonEl = null) {
  if (!containerEl || !tagsEl) return { getSelected: () => [], setSelected: () => { }, refresh: () => { } };
  let selected = new Set(initialSelected);
  let filterText = "";

  function renderTags() {
    tagsEl.innerHTML = "";
    selected.forEach(roKey => {
      const tag = document.createElement("span");
      tag.className = "feature-tag";
      const display = translateFeature(roKey);
      tag.innerHTML = `${esc(display)} <button type="button" title="✕" data-feat="${esc(roKey)}">✕</button>`;
      tag.querySelector("button").addEventListener("click", () => {
        selected.delete(roKey);
        const cb = containerEl.querySelector(`input[data-feat="${CSS.escape(roKey)}"]`);
        if (cb) cb.checked = false;
        renderTags();
      });
      tagsEl.appendChild(tag);
    });
  }

  function getFiltered() {
    const q = _norm(filterText);
    if (!q) return getAllFeaturesSorted();
    return getAllFeaturesSorted().filter(f => _norm(f.display).includes(q) || _norm(f.ro).includes(q));
  }

  function _norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function renderOptions() {
    const features = getFiltered();
    containerEl.innerHTML = "";
    if (!features.length) {
      const empty = document.createElement("div");
      empty.className = "small-muted";
      empty.textContent = t("dash.features_empty");
      containerEl.appendChild(empty);
      return;
    }
    features.forEach(({ ro: roKey, display }) => {
      const label = document.createElement("label");
      label.className = "feature-option";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.feat = roKey;
      cb.checked = selected.has(roKey);
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(roKey); else selected.delete(roKey);
        renderTags();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + display));
      containerEl.appendChild(label);
    });
  }

  if (searchInputEl) {
    searchInputEl.addEventListener("input", e => { filterText = e.target.value; renderOptions(); });
  }
  if (clearButtonEl) {
    clearButtonEl.addEventListener("click", () => {
      if (searchInputEl) { searchInputEl.value = ""; searchInputEl.focus(); }
      filterText = ""; renderOptions();
    });
  }

  renderOptions(); renderTags();

  return {
    getSelected: () => Array.from(selected),
    setSelected: arr => { selected = new Set(arr || []); renderOptions(); renderTags(); },

    refresh: () => { renderOptions(); renderTags(); },
  };
}


function wireTitlePreview(transactionSel, typeSel, regionSel, previewEl) {
  function update() {
    const tt = transactionSel?.value || "";
    const pt = typeSel?.value || "";
    const rg = regionSel?.value || "";
    const title = generateTitle(tt, pt, rg);
    if (previewEl) previewEl.textContent = title || t("dash.title_fill");
  }
  transactionSel?.addEventListener("change", update);
  typeSel?.addEventListener("change", update);
  regionSel?.addEventListener("change", update);
  update();
  return update;   // return so we can call it on language change
}


const authStatus = $("authStatus");
const uidBadge = $("uidBadge");
const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");
const logoutBtn = $("logoutBtn");
const brandSub = $("brandSub");

const viewHome = $("view-home");
const viewMy = $("view-my");
const viewAdd = $("view-add");
const viewAll = $("view-all");
const viewUsers = $("view-users");

const navButtons = Array.from(document.querySelectorAll(".navbtn"));
const navAllBtn = $("navAllBtn");
const navUsersBtn = $("navUsersBtn");
const adminSep = $("adminSep");

const statTotal = $("statTotal");
const statLast = $("statLast");
const homeMsg = $("homeMsg");
const goAddBtn = $("goAddBtn");
const goMyBtn = $("goMyBtn");

const myPropsStatus = $("myPropsStatus");
const myPropsGrid = $("myPropsGrid");
const myMsg = $("myMsg");
const refreshMyBtn = $("refreshMyBtn");

const allPropsStatus = $("allPropsStatus");
const allPropsGrid = $("allPropsGrid");
const refreshAllBtn = $("refreshAllBtn");

const form = $("propertyForm");
const formMsg = $("formMsg");
const resetBtn = $("resetBtn");
const codePreview = $("codePreview");
const imageInput = $("imageInput");
const imagePreview = $("imagePreview");

const editIdBadge = $("editId");
const editCodeBadge = $("editCode");
const editMsg = $("editMsg");
const saveEditBtn = $("saveEditBtn");

const e_statusButtons = Array.from(document.querySelectorAll("#e_statusGroup [data-status]"));

const refreshUsersBtn = $("refreshUsersBtn");
const usersTbody = $("usersTbody");
const usersStatus = $("usersStatus");
const usersMsg = $("usersMsg");
const usersSearch = $("usersSearch");
const createUserForm = $("createUserForm");
const cu_name = $("cu_name");
const cu_phone = $("cu_phone");
const cu_email = $("cu_email");
const cu_password = $("cu_password");
const cu_role = $("cu_role");
const cu_reset = $("cu_reset");
const cu_photo = $("cu_photo");
const cu_photoPreview = $("cu_photoPreview");
const tr_from = $("tr_from");
const tr_to = $("tr_to");
const transferBtn = $("transferBtn");
const transferSwap = $("transferSwap");
const transferMsg = $("transferMsg");
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
const existingPreview = $("existingPreview");
const editImageInput = $("editImageInput");
const newPreview = $("newPreview");
const projectForm = $("projectForm");
const projectIdInput = $("projectId");
const projectMsg = $("projectMsg");
const projectEditForm = $("projectEditForm");
const projectEditIdInput = $("projectEditId");
const projectEditTitleRo = $("projectEditTitleRo");
const projectEditTitleEn = $("projectEditTitleEn");
const projectEditTitleRu = $("projectEditTitleRu");
const projectEditDate = $("projectEditDate");
const projectEditPhotoInput = $("projectEditPhotoInput");
const projectEditPhotoPreview = $("projectEditPhotoPreview");
const projectEditMsg = $("projectEditMsg");
const projectResetBtn = $("projectResetBtn");
const projectSubmitBtn = $("projectSubmitBtn");
const projectTitleRo = $("projectTitleRo");
const projectTitleEn = $("projectTitleEn");
const projectTitleRu = $("projectTitleRu");
const projectDate = $("projectDate");
const projectPhotoInput = $("projectPhotoInput");
const projectPhotoPreview = $("projectPhotoPreview");
const projectsList = $("projectsList");


let currentUser = null;
let currentRole = "agent";
let isAdmin = false;
let usersCache = [];
const usersByUid = new Map();
let selectedImages = [];
let generatedCode = null;
let editModalInstance = null;
let editingId = null;
let existingImageUrls = [];
let newImageFiles = [];
let selectedEditStatus = "active";
let createUserPhotoFile = null;
let createUserPhotoObjectUrl = null;
let editUserPhotoFile = null;
let editUserPhotoObjectUrl = null;
let currentEditingUserPhotoUrl = "";
let userEditModalInstance = null;
let editingUserUid = null;
let propertyTransferModal = null;
let transferPropertyId = null;
let currentViewName = "home";

let addFeaturesWidget = null;
let editFeaturesWidget = null;
let projectPhotoFile = null;
let projectPhotoPreviewUrl = "";
let projectEditPhotoFile = null;
let projectEditPhotoPreviewUrl = "";
let editingProjectId = null;
let projectEditModalInstance = null;

let _addTitleUpdate = null;
let _editTitleUpdate = null;


const setFormMsg = (tx, ok = true) => setMsg(formMsg, tx, ok);
const setMyMsg = (tx, ok = true) => setMsg(myMsg, tx, ok);
const setEditMsg = (tx, ok = true) => setMsg(editMsg, tx, ok);
const setUsersMsg = (tx, ok = true) => setMsg(usersMsg, tx, ok);
const setTransferMsg = (tx, ok = true) => setMsg(transferMsg, tx, ok);
const setUeMsg = (tx, ok = true) => setMsg(ue_msg, tx, ok);


function getChoicesConfig(selectEl) {
  return {
    searchEnabled: true,
    removeItemButton: false,
    shouldSort: false,
    shouldSortItems: false,
    placeholderValue: selectEl?.getAttribute("placeholder") || t("dash.choices_ph"),
    noResultsText: t("dash.choices_no_results"),
    noChoicesText: t("dash.choices_no_choices"),
    itemSelectText: "",
    uniqueItemText: t("dash.choices_unique"),
    customAddItemText: t("dash.choices_unique"),
    allowHTML: false,
    searchResultLimit: 15,
    searchFloor: 1, searchCeiling: 999,
    fuseOptions: { threshold: 0.25 },
  };
}

window.choicesInstances = new WeakMap();

function initChoices() {
  const selects = document.querySelectorAll("select.form-select:not(#tr_from):not(#tr_to)");
  selects.forEach(select => {

    const existing = window.choicesInstances.get(select);
    if (existing) { try { existing.destroy(); } catch { } }
    const ci = new Choices(select, getChoicesConfig(select));
    window.choicesInstances.set(select, ci);
  });
}


function showView(name) {
  [viewHome, viewMy, viewAdd, viewAll, viewUsers, $("view-projects")].forEach(v => v?.classList.add("d-none"));
  navButtons.forEach(b => b.classList.remove("active"));
  const activeBtn = navButtons.find(b => b.dataset.view === name);
  if (activeBtn) activeBtn.classList.add("active");
  currentViewName = name;

  const map = {
    home: { el: viewHome, titleKey: "dash.title_home", subtitleKey: "dash.subtitle_home" },
    my: { el: viewMy, titleKey: "dash.title_my", subtitleKey: "dash.subtitle_my" },
    add: { el: viewAdd, titleKey: "dash.title_add", subtitleKey: "dash.subtitle_add" },
    projects: { el: $("view-projects"), titleKey: "dash.title_projects", subtitleKey: "dash.subtitle_projects" },
    all: { el: viewAll, titleKey: "dash.title_admin", subtitleKey: "dash.subtitle_admin" },
    users: { el: viewUsers, titleKey: "dash.title_users", subtitleKey: "dash.subtitle_users" },
  };
  const entry = map[name] || map.home;
  entry.el?.classList.remove("d-none");
  if (pageTitle) pageTitle.textContent = t(entry.titleKey);
  if (pageSubtitle) pageSubtitle.textContent = t(entry.subtitleKey);

  if (name === "home") loadStats();
  if (name === "my") loadMyProperties();
  if (name === "projects") { if (!isAdmin) return showView("home"); resetProjectForm(); loadProjectsList(); }
  if (name === "all") { if (!isAdmin) return showView("home"); loadAllProperties(); }
  if (name === "users") { if (!isAdmin) return showView("home"); loadUsers(); }
}

navButtons.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
goAddBtn?.addEventListener("click", () => showView("add"));
goMyBtn?.addEventListener("click", () => showView("my"));

function setProjectMsg(text, ok = true) {
  if (!projectMsg) return;
  projectMsg.textContent = text || "";
  projectMsg.style.color = ok ? "#198754" : "#dc3545";
}

function getProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProjects(items) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(items));
}

function getProjectTitle(project, lang = getCurrentLanguage()) {
  if (lang === "en") return project.titleEn || project.titleRo || "";
  if (lang === "ru") return project.titleRu || project.titleRo || "";
  return project.titleRo || project.titleEn || project.titleRu || "";
}

function renderProjectsList() {
  if (!projectsList) return;
  const items = getProjects().sort((a, b) => String(b.createdAt || 0) - String(a.createdAt || 0));
  if (!items.length) {
    projectsList.innerHTML = `<div class="col-12"><div class="small-muted">${esc(t("dash.projects_empty") || "Nu există proiecte încă.")}</div></div>`;
    return;
  }

  projectsList.innerHTML = "";
  items.forEach(project => {
    const card = document.createElement("div");
    card.className = "col-12 col-md-6 col-xl-4";
    const date = project.date ? new Date(project.date).toLocaleDateString(getCurrentLanguage() === "en" ? "en-GB" : getCurrentLanguage() === "ru" ? "ru-RU" : "ro-RO") : "";
    card.innerHTML = `
      <article class="dashboard-project-card">
        <img src="${esc(project.imageUrl || "../images/img1.png")}" alt="${esc(getProjectTitle(project))}">
        <div class="dashboard-project-body">
          <h6 class="mb-1">${esc(getProjectTitle(project))}</h6>
          <div class="project-date">${esc(date)}</div>
          <div class="dashboard-project-actions">
            <button type="button" class="btn btn-outline-primary btn-sm" data-edit-project="${esc(project.id)}">${esc(t("dash.edit_btn") || "Editează")}</button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-remove-project="${esc(project.id)}">${esc(t("dash.delete_btn") || "Șterge")}</button>
          </div>
        </div>
      </article>`;
    projectsList.appendChild(card);
  });

  projectsList.querySelectorAll("[data-edit-project]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-project");
      const project = getProjects().find(item => item.id === id);
      if (!project) return;
      editingProjectId = id;
      if (!projectEditModalInstance) projectEditModalInstance = new bootstrap.Modal($("projectEditModal"));
      projectEditIdInput.value = id;
      projectEditTitleRo.value = project.titleRo || "";
      projectEditTitleEn.value = project.titleEn || "";
      projectEditTitleRu.value = project.titleRu || "";
      projectEditDate.value = project.date || "";
      projectEditPhotoInput.value = "";
      projectEditPhotoFile = null;
      if (projectEditPhotoPreviewUrl) URL.revokeObjectURL(projectEditPhotoPreviewUrl);
      projectEditPhotoPreviewUrl = "";
      projectEditPhotoPreview.innerHTML = project.imageUrl ? `<img src="${esc(project.imageUrl)}" alt="${esc(getProjectTitle(project))}" style="max-width:180px;border-radius:12px;">` : "";
      setProjectMsg(t("dash.projects_edit_hint") || "Modifică câmpurile și salvează.", true);
      projectEditModalInstance.show();
    });
  });

  projectsList.querySelectorAll("[data-remove-project]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-project");
      if (!id || !confirm("Ștergi acest proiect?")) return;
      const next = getProjects().filter(item => item.id !== id);
      saveProjects(next);
      renderProjectsList();
      window.dispatchEvent(new Event("reverie-projects-updated"));
    });
  });
}

function loadProjectsList() {
  renderProjectsList();
}

function resetProjectForm() {
  if (projectForm) projectForm.reset();
  if (projectIdInput) projectIdInput.value = "";
  if (projectPhotoInput) projectPhotoInput.value = "";
  editingProjectId = null;
  projectPhotoFile = null;
  if (projectPhotoPreview) projectPhotoPreview.innerHTML = "";
  if (projectPhotoPreviewUrl) URL.revokeObjectURL(projectPhotoPreviewUrl);
  projectPhotoPreviewUrl = "";
  if (projectSubmitBtn) projectSubmitBtn.textContent = t("dash.projects_add_btn") || "Adaugă proiect";
  if (projectPhotoInput) projectPhotoInput.required = true;
  setProjectMsg("");
}

projectPhotoInput?.addEventListener("change", () => {
  const file = projectPhotoInput.files?.[0] || null;
  if (projectPhotoPreviewUrl) URL.revokeObjectURL(projectPhotoPreviewUrl);
  projectPhotoFile = file;
  projectPhotoPreview.innerHTML = "";
  if (!file) return;
  projectPhotoPreviewUrl = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.src = projectPhotoPreviewUrl;
  img.alt = "Project preview";
  img.style.maxWidth = "180px";
  img.style.borderRadius = "12px";
  projectPhotoPreview.appendChild(img);
});

projectResetBtn?.addEventListener("click", resetProjectForm);

projectEditPhotoInput?.addEventListener("change", () => {
  const file = projectEditPhotoInput.files?.[0] || null;
  if (projectEditPhotoPreviewUrl) URL.revokeObjectURL(projectEditPhotoPreviewUrl);
  projectEditPhotoFile = file;
  projectEditPhotoPreview.innerHTML = "";
  if (!file) return;
  projectEditPhotoPreviewUrl = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.src = projectEditPhotoPreviewUrl;
  img.alt = "Project preview";
  img.style.maxWidth = "180px";
  img.style.borderRadius = "12px";
  projectEditPhotoPreview.appendChild(img);
});

projectEditForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setProjectMsg("Se salvează proiectul...", true);

  try {
    const titleRo = (projectEditTitleRo?.value || "").trim();
    const titleEn = (projectEditTitleEn?.value || "").trim();
    const titleRu = (projectEditTitleRu?.value || "").trim();
    const date = (projectEditDate?.value || "").trim();
    if (!titleRo || !titleEn || !titleRu) return setProjectMsg("Completează toate titlurile.", false);
    if (!date) return setProjectMsg("Selectează data proiectului.", false);

    const existing = getProjects().find(item => item.id === editingProjectId);
    let imageUrl = existing?.imageUrl || "";
    if (projectEditPhotoFile) imageUrl = await uploadSingleImageToCloudinary(projectEditPhotoFile);

    const next = getProjects();
    const idx = next.findIndex(item => item.id === editingProjectId);
    if (idx >= 0) {
      next[idx] = { ...next[idx], titleRo, titleEn, titleRu, date, imageUrl, updatedAt: Date.now() };
      saveProjects(next);
      setProjectMsg("Proiectul a fost actualizat.", true);
      editingProjectId = null;
      renderProjectsList();
      projectEditModalInstance?.hide();
      window.dispatchEvent(new Event("reverie-projects-updated"));
    }
  } catch (err) {
    console.error(err);
    setProjectMsg(err?.message || "Eroare la salvarea proiectului.", false);
  }
});

projectForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setProjectMsg("Se salvează proiectul...", true);

  try {
    const titleRo = (projectTitleRo?.value || "").trim();
    const titleEn = (projectTitleEn?.value || "").trim();
    const titleRu = (projectTitleRu?.value || "").trim();
    const date = (projectDate?.value || "").trim();

    if (!titleRo || !titleEn || !titleRu) return setProjectMsg("Completează toate titlurile.", false);
    if (!date) return setProjectMsg("Selectează data proiectului.", false);

    let imageUrl = "";
    if (editingProjectId) {
      const existing = getProjects().find(item => item.id === editingProjectId);
      imageUrl = existing?.imageUrl || "";
      if (projectPhotoFile) imageUrl = await uploadSingleImageToCloudinary(projectPhotoFile);
    } else {
      if (!projectPhotoFile) return setProjectMsg("Alege o fotografie pentru proiect.", false);
      imageUrl = await uploadSingleImageToCloudinary(projectPhotoFile);
    }

    const next = getProjects();
    if (editingProjectId) {
      const idx = next.findIndex(item => item.id === editingProjectId);
      if (idx >= 0) {
        next[idx] = { ...next[idx], titleRo, titleEn, titleRu, date, imageUrl, updatedAt: Date.now() };
      }
    } else {
      next.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), titleRo, titleEn, titleRu, date, imageUrl, createdAt: Date.now() });
    }
    saveProjects(next);
    setProjectMsg(editingProjectId ? "Proiectul a fost actualizat." : "Proiectul a fost adăugat cu succes.", true);
    editingProjectId = null;
    resetProjectForm();
    renderProjectsList();
    window.dispatchEvent(new Event("reverie-projects-updated"));
  } catch (err) {
    console.error(err);
    setProjectMsg(err?.message || "Eroare la salvarea proiectului.", false);
  }
});

window.addEventListener("reverie-projects-updated", renderProjectsList);


imageInput?.addEventListener("change", () => {
  selectedImages.push(...Array.from(imageInput.files || []));
  imageInput.value = "";
  renderAddImagesPreview();
});

function swapArrayItems(arr, from, to) {
  if (!arr || from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
}

function getFilePreviewUrl(file) {
  if (!file) return "";
  if (!file.__previewUrl) file.__previewUrl = URL.createObjectURL(file);
  return file.__previewUrl;
}

function releaseFilePreviewUrl(file) {
  if (!file || !file.__previewUrl) return;
  try { URL.revokeObjectURL(file.__previewUrl); } catch { }
  delete file.__previewUrl;
}

function renderAddImagesPreview() {
  if (!imagePreview) return;
  imagePreview.innerHTML = "";
  selectedImages.forEach((file, idx) => {
    const div = document.createElement("div");
    div.className = "preview-item";
    div.draggable = true;
    div.dataset.index = idx;

    const img = document.createElement("img");
    img.src = getFilePreviewUrl(file);
    img.alt = "Preview image";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "preview-remove";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      releaseFilePreviewUrl(file);
      selectedImages.splice(idx, 1);
      renderAddImagesPreview();
    });

    const orderWrap = document.createElement("div");
    orderWrap.className = "preview-order";
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "preview-order-btn";
    upBtn.textContent = "↑";
    upBtn.disabled = idx === 0;
    upBtn.title = "Move earlier";
    upBtn.addEventListener("click", () => {
      swapArrayItems(selectedImages, idx, idx - 1);
      renderAddImagesPreview();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "preview-order-btn";
    downBtn.textContent = "↓";
    downBtn.disabled = idx === selectedImages.length - 1;
    downBtn.title = "Move later";
    downBtn.addEventListener("click", () => {
      swapArrayItems(selectedImages, idx, idx + 1);
      renderAddImagesPreview();
    });

    orderWrap.appendChild(upBtn);
    orderWrap.appendChild(downBtn);
    div.appendChild(img);
    div.appendChild(removeBtn);
    div.appendChild(orderWrap);

    div.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(idx));
    });
    div.addEventListener("dragover", e => {
      e.preventDefault();
      div.classList.add("drag-over");
    });
    div.addEventListener("dragleave", () => div.classList.remove("drag-over"));
    div.addEventListener("drop", e => {
      e.preventDefault();
      div.classList.remove("drag-over");
      const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(sourceIndex) && sourceIndex !== idx) {
        swapArrayItems(selectedImages, sourceIndex, idx);
        renderAddImagesPreview();
      }
    });

    imagePreview.appendChild(div);
  });
}


async function initCode() {
  const random5 = () => Math.floor(10000 + Math.random() * 90000).toString();
  for (let i = 0; i < 10; i++) {
    const code = random5();
    const snap = await getDocs(query(collection(db, "properties"), where("code", "==", code)));
    if (snap.empty) { generatedCode = code; break; }
  }
  if (!generatedCode) generatedCode = random5();
  if (codePreview) codePreview.textContent = generatedCode;
}


resetBtn?.addEventListener("click", async () => {
  form?.reset();
  selectedImages = [];
  if (imagePreview) imagePreview.innerHTML = "";
  addFeaturesWidget?.setSelected([]);
  const prev = $("titlePreview");
  if (prev) prev.textContent = t("dash.title_fill");
  setFormMsg(t("dash.msg_reset"), true);
  await initCode();
});


// ── Load agent properties
async function loadMyProperties() {
  if (!currentUser) return;
  if (myPropsStatus) myPropsStatus.textContent = t("dash.loading");
  if (myPropsGrid) myPropsGrid.innerHTML = "";
  setMyMsg("");

  try {
    const snap = await getDocs(query(
      collection(db, "properties"),
      where("agentId", "==", currentUser.uid),
      orderBy("title")
    ));
    if (snap.empty) {
      if (myPropsStatus) myPropsStatus.textContent = t("dash.no_props");
      if (statTotal) statTotal.textContent = "0";
      if (statLast) statLast.textContent = "-";
      return;
    }
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    if (myPropsStatus) myPropsStatus.textContent = t("dash.found", { count: items.length });
    renderProperties(items, false);
    if (statTotal) statTotal.textContent = String(items.length);
    if (statLast) statLast.textContent = items[items.length - 1]?.title || "-";
  } catch (e) {
    console.error(e);
    if (myPropsStatus) myPropsStatus.textContent = t("dash.load_error");
    setMyMsg(t("dash.err_load", { msg: e?.message || e }), false);
  }
}


// ── Statistics for home view
let _viewsChartInstance = null;

async function loadStats() {
  if (!currentUser) return;
  const loading = document.getElementById("statsLoading");
  const statsContent = document.getElementById("statsContent");
  if (loading) loading.style.display = "";
  if (statsContent) statsContent.style.display = "none";

  try {
    const snap = await getDocs(query(
      collection(db, "properties"),
      where("agentId", "==", currentUser.uid)
    ));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));

    // ── Personal stats
    const counts = { active: 0, sold: 0, rented: 0, stopped: 0 };
    items.forEach(p => {
      const s = normalizeStatus(p.status || p.state || p.availability || "active");
      if (s === "active")  counts.active++;
      else if (s === "sold")    counts.sold++;
      else if (s === "rented")  counts.rented++;
      else if (s === "stopped") counts.stopped++;
    });
    const el = id => document.getElementById(id);
    if (el("statActive"))  el("statActive").textContent  = counts.active;
    if (el("statSold"))    el("statSold").textContent    = counts.sold;
    if (el("statRented"))  el("statRented").textContent  = counts.rented;
    if (el("statStopped")) el("statStopped").textContent = counts.stopped;

    // ── Views stats (from viewCount / viewLog fields on each property doc)
    const now = Date.now();
    const ms7  = 7  * 24 * 60 * 60 * 1000;
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    let totalViews = 0, views7d = 0, views30d = 0;
    let mostViewedTitle = t("dash.stats_most_viewed_none");
    let mostViewedCount = -1;

    // Build daily buckets for chart (last 30 days)
    const buckets = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      buckets[key] = 0;
    }

    items.forEach(p => {
      const vc = Number(p.viewCount || 0);
      totalViews += vc;
      if (vc > mostViewedCount) {
        mostViewedCount = vc;
        const title = (p.propertyType && p.region)
          ? generateTitle(normalizeTransaction(p.transactionType || "sale"), p.propertyType, p.region)
          : (p.title || "—");
        mostViewedTitle = `${title} (${vc})`;
      }

      // viewLog: array of timestamps (ms) or { ts: ms } objects
      const log = Array.isArray(p.viewLog) ? p.viewLog : [];
      log.forEach(entry => {
        const ts = typeof entry === "number" ? entry : (entry?.ts || 0);
        if (!ts) return;
        const age = now - ts;
        if (age <= ms7)  views7d++;
        if (age <= ms30) {
          views30d++;
          const d = new Date(ts);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          if (key in buckets) buckets[key]++;
        }
      });
    });

    if (el("statViewsTotal")) el("statViewsTotal").textContent = totalViews;
    if (el("statViews7d"))    el("statViews7d").textContent    = views7d;
    if (el("statViews30d"))   el("statViews30d").textContent   = views30d;
    if (el("statMostViewed")) el("statMostViewed").textContent = mostViewedCount >= 0 ? mostViewedTitle : t("dash.stats_most_viewed_none");

    // ── Activity stats
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const som = startOfMonth.getTime();
    let addedMonth = 0, modifiedMonth = 0, lastActivityTs = 0;

    function tsToMs(v) {
      if (!v) return 0;
      if (typeof v.toMillis === "function") return v.toMillis();
      if (typeof v.seconds === "number") return v.seconds * 1000;
      if (typeof v === "number") return v;
      return 0;
    }

    items.forEach(p => {
      const created  = tsToMs(p.createdAt);
      const modified = tsToMs(p.updatedAt);
      if (created  >= som) addedMonth++;
      if (modified >= som) modifiedMonth++;
      const latest = Math.max(created, modified);
      if (latest > lastActivityTs) lastActivityTs = latest;
    });

    if (el("statAddedMonth"))    el("statAddedMonth").textContent    = addedMonth;
    if (el("statModifiedMonth")) el("statModifiedMonth").textContent = modifiedMonth;
    if (el("statLastActivity")) {
      if (lastActivityTs) {
        const lang = getCurrentLanguage();
        const locale = lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "ro-RO";
        el("statLastActivity").textContent = new Date(lastActivityTs).toLocaleDateString(locale, { day:"numeric", month:"short", year:"numeric" });
      } else {
        el("statLastActivity").textContent = t("dash.stats_last_activity_none");
      }
    }

    // ── Chart
    const chartCanvas = el("viewsChart");
    const noViewsEl   = el("statsNoViews");
    const hasViewLog  = Object.values(buckets).some(v => v > 0);

    if (chartCanvas && noViewsEl) {
      if (!hasViewLog) {
        noViewsEl.style.display = "";
        chartCanvas.style.display = "none";
      } else {
        noViewsEl.style.display = "none";
        chartCanvas.style.display = "";
        if (_viewsChartInstance) { _viewsChartInstance.destroy(); _viewsChartInstance = null; }
        _viewsChartInstance = new Chart(chartCanvas, {
          type: "bar",
          data: {
            labels: Object.keys(buckets).map(k => {
              const [, m, d] = k.split("-");
              return `${d}/${m}`;
            }),
            datasets: [{
              label: t("dash.stats_views_30d"),
              data: Object.values(buckets),
              backgroundColor: "rgba(183,28,28,0.18)",
              borderColor: "rgba(183,28,28,0.75)",
              borderWidth: 1.5,
              borderRadius: 4,
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
              y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } }
            }
          }
        });
      }
    }

  } catch (e) {
    console.error("loadStats error:", e);
  } finally {
    if (loading) loading.style.display = "none";
    if (statsContent) statsContent.style.display = "";
  }
}


// ── Load all properties (admin)
async function loadAllProperties() {
  if (!currentUser || !isAdmin) return;
  if (allPropsStatus) allPropsStatus.textContent = t("dash.loading");
  if (allPropsGrid) allPropsGrid.innerHTML = "";

  try {
    const snap = await getDocs(collection(db, "properties"));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    if (allPropsStatus) allPropsStatus.textContent = t("dash.all_total", { count: items.length });
    renderProperties(items, true);
  } catch (e) {
    console.error(e);
    if (allPropsStatus) allPropsStatus.textContent = t("dash.load_error");
  }
}

refreshMyBtn?.addEventListener("click", loadMyProperties);
refreshAllBtn?.addEventListener("click", loadAllProperties);


function renderProperties(items, adminMode) {
  const grid = adminMode ? allPropsGrid : myPropsGrid;
  if (!grid) return;
  grid.innerHTML = "";

  items.forEach(p => {
    const st = normalizeStatus(p.status);
    const stLabel = translateStatus(st);   // localized overlay text
    const img = p.mainImage || (Array.isArray(p.images) ? p.images[0] : "") || "../images/img1.png";
    const agentName = adminMode ? getUserDisplayName(p.agentId, "—") : "";
    const locationDisp = formatLocation(p.region || "");
    const typeDisp = translatePropertyTypeRaw(p.propertyType || "");
    const txLabel = p.transactionType === "rent" ? t("dash.rent_opt") : t("dash.sale_opt");
    const txClass = p.transactionType === "rent" ? "text-bg-warning" : "text-bg-danger";
    const noTitle = t("dash.no_title");


    const displayTitle = (p.transactionType && p.propertyType && p.region)
      ? generateTitle(p.transactionType, p.propertyType, p.region)
      : (p.title || noTitle);

    const col = document.createElement("div");
    col.className = "prop-col";
    col.innerHTML = `
<div class="card shadow-sm h-100 prop-card" data-status="${esc(st)}">
  <div class="prop-img-wrap">
    <img src="${esc(img)}" alt="${esc(displayTitle)}" loading="lazy">
    <div class="prop-status-overlay" aria-hidden="true"><span>${esc(stLabel)}</span></div>
  </div>
  <div class="card-body">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <h5 class="card-title mb-1">${esc(displayTitle)}</h5>
      <span class="badge text-bg-dark badge-code">${esc(p.code || "")}</span>
    </div>
    <div class="small-muted mb-2">${esc(locationDisp)}</div>
    <div class="d-flex flex-wrap gap-2 mb-2">
      <span class="badge text-bg-light">${esc(typeDisp)}</span>
      <span class="badge ${txClass}">${esc(txLabel)}</span>
      <span class="badge ${statusBadgeClass(st)}">${t("dash.badge_status")} ${esc(translateStatus(st) || t("dash.status_active"))}</span>
      ${adminMode ? `<span class="badge text-bg-secondary">${t("dash.badge_agent")} ${esc(agentName)}</span>` : ""}
    </div>
    <div class="fw-semibold mb-3">${esc(fmtPriceEUR(p.price))}</div>
    <div class="d-flex gap-2 flex-wrap">
      ${adminMode ? `<button class="btn btn-outline-secondary btn-sm" data-transfer="${esc(p.id)}">${t("dash.transfer_prop_btn")}</button>` : ""}
      <button class="btn btn-outline-primary btn-sm" data-edit="${esc(p.id)}">${t("dash.edit_btn")}</button>
      <button class="btn btn-outline-danger btn-sm" data-del="${esc(p.id)}">${t("dash.delete_prop_btn")}</button>
    </div>
  </div>
</div>`;
    grid.appendChild(col);
  });

  grid.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!id || !confirm(t("dash.confirm_delete_prop"))) return;
      try {
        await deleteDoc(doc(db, "properties", id));
        if (!adminMode) setMyMsg(t("dash.msg_deleted"), true);
        await loadMyProperties();
        if (isAdmin) await loadAllProperties();
      } catch (e) {
        console.error(e);
        const msg = t("dash.err_delete_prop");
        if (!adminMode) setMyMsg(msg, false); else alert(msg);
      }
    });
  });
  grid.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.getAttribute("data-edit"), adminMode));
  });
  grid.querySelectorAll("[data-transfer]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-transfer");
      if (!id || !isAdmin) return;
      openPropertyTransferModal(id);
    });
  });
}


function setEditStatusUI(status) {
  selectedEditStatus = normalizeStatus(status);
  e_statusButtons.forEach(btn => {
    const st = btn.getAttribute("data-status");
    const isOn = st === selectedEditStatus;
    const outlineClass = st === "active" ? "btn-outline-success" : st === "stopped" ? "btn-outline-secondary" : st === "sold" ? "btn-outline-danger" : "btn-outline-warning";
    const solidClass = st === "active" ? "btn-success" : st === "stopped" ? "btn-secondary" : st === "sold" ? "btn-danger" : "btn-warning";
    btn.className = `btn ${isOn ? solidClass : outlineClass}`;
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
  });
}

e_statusButtons.forEach(btn => {
  btn.addEventListener("click", () => setEditStatusUI(btn.getAttribute("data-status")));
});


function refreshStatusButtonLabels() {
  e_statusButtons.forEach(btn => {
    const st = btn.getAttribute("data-status");
    const keyMap = { active: "dash.status_active", stopped: "dash.status_stopped", sold: "dash.status_sold", rented: "dash.status_rented" };
    if (keyMap[st]) btn.textContent = t(keyMap[st]);
  });
}


async function uploadImagesToCloudinary(files) {
  const urls = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || !data.secure_url) { console.error("Cloudinary error:", data); throw new Error(t("dash.err_upload_failed")); }
    urls.push(data.secure_url);
  }
  return urls;
}

async function uploadSingleImageToCloudinary(file) {
  const [url] = await uploadImagesToCloudinary([file]);
  return url;
}


async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "agent";
    return String(snap.data().role || "agent").toLowerCase();
  } catch (e) { console.error("Role read error:", e); return "agent"; }
}

async function loadCurrentUserName(uid, emailFallback = "") {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      return String(d.name || "").trim() || String(d.email || "").trim() || emailFallback;
    }
  } catch (e) { console.warn(e); }
  return emailFallback;
}

function getUserData(uid) {
  if (!uid) return null;
  return usersByUid.get(uid) || usersCache.find(u => u.uid === uid) || null;
}

function getUserDisplayName(uid, fallback = "—") {
  const u = getUserData(uid);
  return (u && (u.name || u.email)) ? (u.name || u.email) : fallback;
}

function getUserLabel(uid) { return getUserDisplayName(uid, "—"); }

function getAgentsList() {
  return usersCache
    .filter(u => normalizeRole(u.role) !== "admin")
    .map(u => ({ uid: u.uid, name: u.name || u.email || "—" }));
}


function ensurePropertyTransferModal() {
  if (propertyTransferModal) return propertyTransferModal;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="modal fade" id="propTransferModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" style="max-width:520px;">
    <div class="modal-content" style="border-radius:14px;border:0;">
      <div class="modal-header" style="padding:20px 24px;">
        <h5 class="modal-title" id="pt_title">${t("dash.transfer_modal_title")}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t("dash.close_btn")}"></button>
      </div>
      <div class="modal-body" style="padding:24px;">
        <div class="small-muted mb-3" id="pt_desc">${t("dash.transfer_modal_desc")}</div>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label fw-semibold" id="pt_agent_label">${t("dash.transfer_new_agent")}</label>
            <select id="pt_to" class="form-select"></select>
          </div>
          <div class="col-12"><div id="pt_msg" class="small-muted"></div></div>
        </div>
      </div>
      <div class="modal-footer" style="padding:16px 24px;">
        <button class="btn btn-outline-secondary" data-bs-dismiss="modal" id="pt_close_btn">${t("dash.close_btn")}</button>
        <button id="pt_confirm" class="btn btn-danger">${t("dash.transfer_btn")}</button>
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
  const setPtMsg = (text, ok = true) => setMsg(pt_msg, text, ok);

  const fillAgents = currentAgentId => {
    if (!pt_to) return;
    pt_to.innerHTML = "";
    getAgentsList().forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.uid; opt.textContent = a.name;
      pt_to.appendChild(opt);
    });
    const first = getAgentsList().find(a => a.uid !== currentAgentId);
    if (first) pt_to.value = first.uid;
  };

  el.addEventListener("show.bs.modal", async () => {
    setPtMsg("");
    if (!transferPropertyId) return;
    try {
      const snap = await getDoc(doc(db, "properties", transferPropertyId));
      fillAgents(snap.exists() ? (snap.data().agentId || "") : "");
    } catch (e) { console.error(e); fillAgents(""); }
  });

  pt_confirm?.addEventListener("click", async () => {
    if (!isAdmin || !transferPropertyId) return;
    const toUid = pt_to?.value || "";
    if (!toUid) return setPtMsg(t("dash.val_select_agent"), false);
    try {
      setPtMsg(t("dash.msg_transfer_progress"), true);
      const ref = doc(db, "properties", transferPropertyId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return setPtMsg(t("dash.err_not_found"), false);
      if (snap.data().agentId === toUid) return setPtMsg(t("dash.val_select_different_agent"), false);
      await updateDoc(ref, { agentId: toUid });
      setPtMsg(t("dash.msg_transferred"), true);
      await loadMyProperties(); await loadAllProperties();
      setTimeout(() => { try { propertyTransferModal?.hide(); } catch { } }, 450);
    } catch (e) { console.error(e); setPtMsg(t("dash.err_transfer", { msg: e?.message || e }), false); }
  });

  return propertyTransferModal;
}

function openPropertyTransferModal(propertyId) {
  transferPropertyId = propertyId;
  ensurePropertyTransferModal().show();
}


function renderExistingImages() {
  if (!existingPreview) return;
  existingPreview.innerHTML = "";
  existingImageUrls.forEach((url, idx) => {
    const div = document.createElement("div");
    div.className = "preview-item";
    div.draggable = true;
    div.dataset.index = idx;

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Existing image preview";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "preview-remove";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      existingImageUrls.splice(idx, 1);
      renderExistingImages();
    });

    const orderWrap = document.createElement("div");
    orderWrap.className = "preview-order";
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "preview-order-btn";
    upBtn.textContent = "↑";
    upBtn.disabled = idx === 0;
    upBtn.title = "Move earlier";
    upBtn.addEventListener("click", () => {
      swapArrayItems(existingImageUrls, idx, idx - 1);
      renderExistingImages();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "preview-order-btn";
    downBtn.textContent = "↓";
    downBtn.disabled = idx === existingImageUrls.length - 1;
    downBtn.title = "Move later";
    downBtn.addEventListener("click", () => {
      swapArrayItems(existingImageUrls, idx, idx + 1);
      renderExistingImages();
    });

    orderWrap.appendChild(upBtn);
    orderWrap.appendChild(downBtn);
    div.appendChild(img);
    div.appendChild(removeBtn);
    div.appendChild(orderWrap);

    div.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(idx));
    });
    div.addEventListener("dragover", e => {
      e.preventDefault();
      div.classList.add("drag-over");
    });
    div.addEventListener("dragleave", () => div.classList.remove("drag-over"));
    div.addEventListener("drop", e => {
      e.preventDefault();
      div.classList.remove("drag-over");
      const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(sourceIndex) && sourceIndex !== idx) {
        swapArrayItems(existingImageUrls, sourceIndex, idx);
        renderExistingImages();
      }
    });

    existingPreview.appendChild(div);
  });
}

function renderNewImages() {
  if (!newPreview) return;
  newPreview.innerHTML = "";
  newImageFiles.forEach((file, idx) => {
    const div = document.createElement("div");
    div.className = "preview-item";
    div.draggable = true;
    div.dataset.index = idx;

    const img = document.createElement("img");
    img.src = getFilePreviewUrl(file);
    img.alt = "New image preview";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "preview-remove";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      releaseFilePreviewUrl(file);
      newImageFiles.splice(idx, 1);
      renderNewImages();
    });

    const orderWrap = document.createElement("div");
    orderWrap.className = "preview-order";
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "preview-order-btn";
    upBtn.textContent = "↑";
    upBtn.disabled = idx === 0;
    upBtn.title = "Move earlier";
    upBtn.addEventListener("click", () => {
      swapArrayItems(newImageFiles, idx, idx - 1);
      renderNewImages();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "preview-order-btn";
    downBtn.textContent = "↓";
    downBtn.disabled = idx === newImageFiles.length - 1;
    downBtn.title = "Move later";
    downBtn.addEventListener("click", () => {
      swapArrayItems(newImageFiles, idx, idx + 1);
      renderNewImages();
    });

    orderWrap.appendChild(upBtn);
    orderWrap.appendChild(downBtn);
    div.appendChild(img);
    div.appendChild(removeBtn);
    div.appendChild(orderWrap);

    div.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(idx));
    });
    div.addEventListener("dragover", e => {
      e.preventDefault();
      div.classList.add("drag-over");
    });
    div.addEventListener("dragleave", () => div.classList.remove("drag-over"));
    div.addEventListener("drop", e => {
      e.preventDefault();
      div.classList.remove("drag-over");
      const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(sourceIndex) && sourceIndex !== idx) {
        swapArrayItems(newImageFiles, sourceIndex, idx);
        renderNewImages();
      }
    });

    newPreview.appendChild(div);
  });
}

editImageInput?.addEventListener("change", () => {
  newImageFiles.push(...Array.from(editImageInput.files || []));
  editImageInput.value = "";
  renderNewImages();
});

async function openEditModal(id, adminMode) {
  try {
    if (!id || !currentUser) return;
    editingId = id;
    setEditMsg("");
    if (!editModalInstance) editModalInstance = new bootstrap.Modal($("editModal"));
    if (editIdBadge) editIdBadge.textContent = id;

    const ref = doc(db, "properties", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) { setEditMsg(t("dash.err_not_found"), false); editModalInstance.show(); return; }
    const p = snap.data();
    if (!adminMode && p.agentId !== currentUser.uid) { setEditMsg(t("dash.err_not_allowed"), false); editModalInstance.show(); return; }
    if (editCodeBadge) editCodeBadge.textContent = p.code || "-----";

    const e_tt = $("e_transactionType"); const e_pt = $("e_propertyType");
    const e_rg = $("e_region"); const e_price = $("e_price");
    const e_area = $("e_area"); const e_landArea = $("e_landArea");
    const e_landAreaUnit = $("e_landAreaUnit");
    const e_rooms = $("e_rooms"); const e_bathrooms = $("e_bathrooms");
    const e_floor = $("e_floor"); const e_totalFloors = $("e_totalFloors");
    const e_ceilingHeight = $("e_ceilingHeight"); const e_kitchenAera = $("e_kitchenAera");
    const e_balconies = $("e_balconies"); const e_garages = $("e_garages");

    if (e_tt) setSelectValue(e_tt, p.transactionType || "sale");
    if (e_pt) setSelectValue(e_pt, p.propertyType || "");
    if (e_rg) setSelectValue(e_rg, p.region || "");
    if (e_landAreaUnit) setSelectValue(e_landAreaUnit, p.landAreaUnit || "ari");
    if (e_tt) e_tt.dispatchEvent(new Event("change"));

    if (e_price) e_price.value = p.price ?? "";
    if (e_area) e_area.value = p.area ?? "";
    if (e_landArea) e_landArea.value = p.landArea ?? "";
    if (e_rooms) e_rooms.value = p.rooms ?? "";
    if (e_bathrooms) e_bathrooms.value = p.bathrooms ?? "";
    if (e_floor) e_floor.value = p.floor ?? "";
    if (e_totalFloors) e_totalFloors.value = p.totalFloors ?? "";
    if (e_ceilingHeight) e_ceilingHeight.value = p.ceilingHeight ?? "";
    if (e_kitchenAera) e_kitchenAera.value = p.kitchenAera ?? "";
    if (e_balconies) e_balconies.value = p.balconies ?? "";
    if (e_garages) e_garages.value = p.garages ?? "";

    editFeaturesWidget?.setSelected(Array.isArray(p.features) ? p.features : []);
    setEditStatusUI(normalizeStatus(p.status));
    existingImageUrls = Array.isArray(p.images) ? [...p.images] : [];
    newImageFiles = [];
    renderExistingImages(); renderNewImages();
    editModalInstance.show();
  } catch (e) {
    console.error(e);
    alert(t("dash.err_edit", { msg: e.message || e }));
  }
}

saveEditBtn?.addEventListener("click", async () => {
  if (!editingId || !currentUser) return;
  try {
    setEditMsg(t("dash.msg_saving"), true);
    const e_tt = $("e_transactionType"); const e_pt = $("e_propertyType");
    const e_rg = $("e_region"); const e_price = $("e_price");
    const transactionType = e_tt?.value || "sale";
    const propertyType = (e_pt?.value || "").trim();
    const region = (e_rg?.value || "").trim();
    const price = toNum(e_price?.value);

    if (!propertyType) return setEditMsg(t("dash.val_type_required"), false);
    if (!region) return setEditMsg(t("dash.val_loc_required"), false);
    if (!price || price <= 0) return setEditMsg(t("dash.val_price_invalid"), false);

    const title = generateTitle(transactionType, propertyType, region);
    const rooms = toNum($("e_rooms")?.value);
    const area = toNum($("e_area")?.value);
    const landArea = toNum($("e_landArea")?.value);
    const landAreaUnit = $("e_landAreaUnit")?.value || "ari";
    const bathrooms = toNum($("e_bathrooms")?.value);
    const kitchenAera = toNum($("e_kitchenAera")?.value);
    const floor = toNum($("e_floor")?.value);
    const totalFloors = toNum($("e_totalFloors")?.value);
    const ceilingHeight = toNum($("e_ceilingHeight")?.value);
    const balconies = toNum($("e_balconies")?.value);
    const garages = toNum($("e_garages")?.value);
    const features = editFeaturesWidget?.getSelected() || [];
    const status = normalizeStatus(selectedEditStatus);

    let uploaded = [];
    if (newImageFiles.length) { setEditMsg(t("dash.msg_loading_new_images"), true); uploaded = await uploadImagesToCloudinary(newImageFiles); }
    const finalImages = [...existingImageUrls, ...uploaded];
    const mainImage = finalImages[0] || "";

    const curSnap = await getDoc(doc(db, "properties", editingId));
    if (!curSnap.exists()) return setEditMsg(t("dash.err_doc_missing"), false);
    if (!isAdmin && curSnap.data().agentId !== currentUser.uid) return setEditMsg(t("dash.err_not_allowed_short"), false);

    const editSlug = toSlug([
      normalizeTransaction(transactionType) === "rent" ? "chirie" : "vanzare",
      propertyType, region
    ].filter(Boolean).join(" "));

    await updateDoc(doc(db, "properties", editingId), {
      title, price, propertyType, transactionType, region, status, slug: editSlug,
      rooms: rooms ?? null, area: area ?? null, landArea: landArea ?? null,
      landAreaUnit: landArea !== null ? landAreaUnit : null,
      bathrooms: bathrooms ?? null, kitchenAera: kitchenAera ?? null,
      floor: floor ?? null, totalFloors: totalFloors ?? null,
      ceilingHeight: ceilingHeight ?? null, balconies: balconies ?? null, garages: garages ?? null,
      features, images: finalImages, mainImage,
      updatedAt: serverTimestamp(),
    });
    setEditMsg(t("dash.msg_saved"), true);
    await loadMyProperties();
    if (isAdmin) await loadAllProperties();
    setTimeout(() => { try { editModalInstance?.hide(); } catch { } }, 450);
  } catch (e) {
    console.error(e);
    setEditMsg(t("dash.err_save", { msg: e.message || e }), false);
  }
});


form?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return;
  try {
    setFormMsg(t("dash.msg_publishing"), true);
    const transactionType = $("transactionType")?.value || "sale";
    const propertyType = ($("propertyType")?.value || "").trim();
    const region = ($("region")?.value || "").trim();
    const price = toNum($("price")?.value);

    if (!propertyType) return setFormMsg(t("dash.val_type_required"), false);
    if (!region) return setFormMsg(t("dash.val_loc_required"), false);
    if (!price || price <= 0) return setFormMsg(t("dash.val_price_invalid"), false);

    const title = generateTitle(transactionType, propertyType, region);
    const rooms = toNum($("rooms")?.value);
    const area = toNum($("area")?.value);
    const landArea = toNum($("landArea")?.value);
    const landAreaUnit = $("landAreaUnit")?.value || "ari";
    const bathrooms = toNum($("bathrooms")?.value);
    const kitchenAera = toNum($("kitchenAera")?.value);
    const floor = toNum($("floor")?.value);
    const totalFloors = toNum($("totalFloors")?.value);
    const ceilingHeight = toNum($("ceilingHeight")?.value);
    const balconies = toNum($("balconies")?.value);
    const garages = toNum($("garages")?.value);
    const features = addFeaturesWidget?.getSelected() || [];

    if (!generatedCode) await initCode();
    let imageUrls = [];
    if (selectedImages.length) { setFormMsg(t("dash.msg_loading_images"), true); imageUrls = await uploadImagesToCloudinary(selectedImages); }

    const propSlug = toSlug([
      normalizeTransaction(transactionType) === "rent" ? "chirie" : "vanzare",
      propertyType, region, String(generatedCode)
    ].filter(Boolean).join(" "));

    await addDoc(collection(db, "properties"), {
      agentId: currentUser.uid, title, price, propertyType, transactionType,
      region, code: generatedCode, status: "active", slug: propSlug,
      area: area ?? null, landArea: landArea ?? null,
      landAreaUnit: landArea !== null ? landAreaUnit : null,
      rooms: rooms ?? null, bathrooms: bathrooms ?? null, kitchenAera: kitchenAera ?? null,
      floor: floor ?? null, totalFloors: totalFloors ?? null,
      ceilingHeight: ceilingHeight ?? null, balconies: balconies ?? null, garages: garages ?? null,
      features, images: imageUrls, mainImage: imageUrls[0] || "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    setFormMsg(t("dash.msg_published"), true);
    form.reset();
    selectedImages = [];
    if (imagePreview) imagePreview.innerHTML = "";
    addFeaturesWidget?.setSelected([]);
    const prev = $("titlePreview");
    if (prev) prev.textContent = t("dash.title_fill");
    await initCode();
    await loadMyProperties();
    if (isAdmin) await loadAllProperties();
    showView("my");
  } catch (err) {
    console.error(err);
    setFormMsg(t("dash.err_publish", { msg: err.message || err }), false);
  }
});


// ── Load users (admin)
async function loadUsers() {
  if (!isAdmin) return;
  if (usersStatus) usersStatus.textContent = t("dash.loading_users");
  if (usersTbody) usersTbody.innerHTML = "";
  setUsersMsg(""); setTransferMsg("");

  try {
    const snap = await getDocs(collection(db, "users"));
    const items = [];
    snap.forEach(d => items.push({ uid: d.id, ...d.data() }));
    items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), getCurrentLanguage(), { sensitivity: "base" }));
    usersCache = items;
    usersByUid.clear();
    items.forEach(u => usersByUid.set(u.uid, u));
    renderUsersTable();
    fillTransferSelects();
    if (usersStatus) usersStatus.textContent = t("dash.users_total", { count: items.length });
  } catch (e) {
    console.error(e);
    if (usersStatus) usersStatus.textContent = t("dash.load_error");
    setUsersMsg(t("dash.err_load", { msg: e.message || e }), false);
  }
}

function renderUsersTable() {
  if (!usersTbody) return;
  const q = (usersSearch?.value || "").trim().toLowerCase();
  const list = !q ? usersCache : usersCache.filter(u =>
    [u.name, u.email, u.phone, u.role].join(" ").toLowerCase().includes(q)
  );
  usersTbody.innerHTML = "";
  list.forEach(u => {
    const role = normalizeRole(u.role);
    const photo = u.photoUrl || "";
    const isSelf = currentUser && u.uid === currentUser.uid;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="d-flex align-items-center gap-2">
          <div style="width:34px;height:34px;border-radius:10px;border:2px solid rgba(183,28,28,.12);background:#fff;overflow:hidden;">
            ${photo ? `<img src="${esc(photo)}" style="width:100%;height:100%;object-fit:cover" alt="">` : ""}
          </div>
          <div>${esc(u.name || "-")}</div>
        </div>
      </td>
      <td>${esc(u.email || "-")}</td>
      <td>${esc(u.phone || "-")}</td>
      <td><span class="badge ${role === "admin" ? "text-bg-danger" : "text-bg-secondary"}">${esc(role)}</span></td>
      <td class="d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-outline-primary" data-edit-user="${esc(u.uid)}">${t("dash.edit_user_btn")}</button>
        <button class="btn btn-sm btn-outline-danger" data-del-user="${esc(u.uid)}" ${isSelf ? "disabled" : ""}>${t("dash.delete_user_btn")}</button>
      </td>`;
    usersTbody.appendChild(tr);
  });
  usersTbody.querySelectorAll("[data-edit-user]").forEach(btn => {
    btn.addEventListener("click", () => openUserEditModal(btn.getAttribute("data-edit-user")));
  });
  usersTbody.querySelectorAll("[data-del-user]").forEach(btn => {
    btn.addEventListener("click", async () => { const uid = btn.getAttribute("data-del-user"); if (uid) await deleteUserFlow(uid); });
  });
}

function fillTransferSelects() {
  if (!tr_from || !tr_to) return;
  const agents = getAgentsList().map(a => ({ uid: a.uid, label: a.name }));
  const build = sel => {
    sel.innerHTML = "";
    agents.forEach(a => { const opt = document.createElement("option"); opt.value = a.uid; opt.textContent = a.label; sel.appendChild(opt); });
  };
  build(tr_from); build(tr_to);
  if (agents.length >= 2) { tr_from.value = agents[0].uid; tr_to.value = agents[1].uid; }
}

usersSearch?.addEventListener("input", () => renderUsersTable());
refreshUsersBtn?.addEventListener("click", loadUsers);
cu_reset?.addEventListener("click", () => { createUserForm?.reset(); clearCreateUserPhotoState(); setUsersMsg(""); });


function clearCreateUserPhotoState() {
  createUserPhotoFile = null;
  if (createUserPhotoObjectUrl) { try { URL.revokeObjectURL(createUserPhotoObjectUrl); } catch { } createUserPhotoObjectUrl = null; }
  if (cu_photo) cu_photo.value = "";
  if (cu_photoPreview) cu_photoPreview.innerHTML = "";
}

function clearEditUserPhotoState() {
  editUserPhotoFile = null;
  if (editUserPhotoObjectUrl) { try { URL.revokeObjectURL(editUserPhotoObjectUrl); } catch { } editUserPhotoObjectUrl = null; }
  if (ue_photo) ue_photo.value = "";
  if (ue_photoPreview) ue_photoPreview.innerHTML = "";
}

cu_photo?.addEventListener("change", () => {
  const file = cu_photo.files?.[0];
  if (!file) return;
  clearCreateUserPhotoState();
  createUserPhotoFile = file; createUserPhotoObjectUrl = URL.createObjectURL(file);
  if (cu_photoPreview) {
    cu_photoPreview.innerHTML = `<div class="preview-item"><img src="${esc(createUserPhotoObjectUrl)}" alt="preview"><button type="button" title="✕">✕</button></div>`;
    cu_photoPreview.querySelector("button")?.addEventListener("click", () => clearCreateUserPhotoState());
  }
});

ue_photo?.addEventListener("change", () => {
  const file = ue_photo.files?.[0];
  if (!file) return;
  clearEditUserPhotoState();
  editUserPhotoFile = file; editUserPhotoObjectUrl = URL.createObjectURL(file);
  if (ue_photoPreview) {
    ue_photoPreview.innerHTML = `<div class="preview-item"><img src="${esc(editUserPhotoObjectUrl)}" alt="preview"><button type="button" title="✕">✕</button></div>`;
    ue_photoPreview.querySelector("button")?.addEventListener("click", () => clearEditUserPhotoState());
  }
});


createUserForm?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!isAdmin) return;
  const name = (cu_name.value || "").trim();
  const phone = (cu_phone.value || "").trim();
  const email = (cu_email.value || "").trim();
  const password = cu_password.value || "";
  const role = normalizeRole(cu_role.value);
  if (!name) return setUsersMsg(t("dash.val_name_required"), false);
  if (!email) return setUsersMsg(t("dash.val_email_required"), false);
  if (!password || password.length < 6) return setUsersMsg(t("dash.val_password_min"), false);
  try {
    setUsersMsg(t("dash.msg_creating_user"), true);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    let photoUrl = "";
    if (createUserPhotoFile) { setUsersMsg(t("dash.msg_uploading_photo"), true); photoUrl = await uploadSingleImageToCloudinary(createUserPhotoFile); }
    await setDoc(doc(db, "users", cred.user.uid), { name, phone, email, role, photoUrl, slug: toSlug(name) }, { merge: true });
    try { await signOut(secondaryAuth); } catch { }
    setUsersMsg(t("dash.msg_user_created"), true);
    createUserForm.reset(); clearCreateUserPhotoState();
    await loadUsers();
  } catch (err) {
    console.error(err);
    setUsersMsg(t("dash.err_create_user", { msg: err?.message || err }), false);
  }
});


async function openUserEditModal(uid) {
  if (!uid) return;
  editingUserUid = uid;
  setUeMsg("");
  if (!userEditModalInstance) userEditModalInstance = new bootstrap.Modal($("userEditModal"));
  clearEditUserPhotoState();
  currentEditingUserPhotoUrl = "";
  let u = usersCache.find(x => x.uid === uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) u = { uid, ...snap.data() };
  } catch { }
  if (ue_uid) ue_uid.textContent = u?.name || u?.email || "—";
  if (ue_name) ue_name.value = u?.name || "";
  if (ue_phone) ue_phone.value = u?.phone || "";
  if (ue_email) ue_email.value = u?.email || "";
  if (ue_role) ue_role.value = normalizeRole(u?.role);
  currentEditingUserPhotoUrl = u?.photoUrl || "";
  if (ue_currentPhotoPreview) {
    ue_currentPhotoPreview.innerHTML = currentEditingUserPhotoUrl
      ? `<div class="preview-item"><img src="${esc(currentEditingUserPhotoUrl)}" alt="current"></div>`
      : `<div class="small text-muted">${t("dash.no_photo")}</div>`;
  }
  if (ue_delete) {
    const isSelf = currentUser && uid === currentUser.uid;
    ue_delete.disabled = !!isSelf;
    ue_delete.title = isSelf ? t("dash.err_delete_self") : "";
  }
  userEditModalInstance.show();
}

ue_save?.addEventListener("click", async () => {
  if (!isAdmin || !editingUserUid) return;
  const name = (ue_name.value || "").trim();
  const phone = (ue_phone.value || "").trim();
  const role = normalizeRole(ue_role.value);
  if (!name) return setUeMsg(t("dash.val_name_required"), false);
  try {
    setUeMsg(t("dash.msg_saving"), true);
    let photoUrl = currentEditingUserPhotoUrl || "";
    if (editUserPhotoFile) { setUeMsg(t("dash.msg_uploading_photo_new"), true); photoUrl = await uploadSingleImageToCloudinary(editUserPhotoFile); }
    await updateDoc(doc(db, "users", editingUserUid), { name, phone, role, photoUrl });
    setUeMsg(t("dash.msg_saved"), true);
    await loadUsers();
    setTimeout(() => { try { userEditModalInstance?.hide(); } catch { } }, 350);
  } catch (e) {
    console.error(e);
    setUeMsg(t("dash.err_generic", { msg: e?.message || e }), false);
  }
});


async function commitBatchInChunks(ops, chunkSize = 450) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    ops.slice(i, i + chunkSize).forEach(fn => fn(batch));
    await batch.commit();
  }
}

async function deleteUserFlow(uid) {
  if (!isAdmin || !uid) return;
  if (currentUser && uid === currentUser.uid) { alert(t("dash.err_delete_self")); return; }
  const label = getUserLabel(uid);
  if (!confirm(t("dash.confirm_delete_user", { name: label }))) return;

  let propsSnap = null;
  try {
    propsSnap = await getDocs(query(collection(db, "properties"), where("agentId", "==", uid)));
  } catch (e) {
    console.error(e);
    alert(t("dash.err_no_props_check")); return;
  }
  const count = propsSnap?.size || 0;
  let action = "none", toUid = "";
  if (count > 0) {
    const candidateTo = tr_to?.value || "";
    const canTransfer = candidateTo && candidateTo !== uid;
    if (canTransfer) {
      const doTransfer = confirm(t("dash.confirm_transfer_user", { count, name: getUserLabel(candidateTo) }));
      if (doTransfer) { action = "transfer"; toUid = candidateTo; } else action = "deleteProps";
    } else {
      if (!confirm(t("dash.confirm_no_target", { count }))) return;
      action = "deleteProps";
    }
  }
  if (!confirm(t("dash.confirm_final_delete"))) return;
  try {
    if (count > 0 && propsSnap) {
      const ops = [];
      propsSnap.forEach(d => {
        const ref = doc(db, "properties", d.id);
        if (action === "transfer") ops.push(b => b.update(ref, { agentId: toUid }));
        if (action === "deleteProps") ops.push(b => b.delete(ref));
      });
      if (ops.length) await commitBatchInChunks(ops);
    }
    await deleteDoc(doc(db, "users", uid));
    setUsersMsg(t("dash.msg_user_deleted"), true);
    setUeMsg(t("dash.msg_user_deleted"), true);
    await loadUsers(); await loadAllProperties(); await loadMyProperties();
    if (editingUserUid === uid) { editingUserUid = null; setTimeout(() => { try { userEditModalInstance?.hide(); } catch { } }, 250); }
  } catch (e) {
    console.error(e);
    alert(t("dash.err_delete_full", { msg: e?.message || e }));
    setUsersMsg(t("dash.err_generic", { msg: e?.message || e }), false);
    setUeMsg(t("dash.err_generic", { msg: e?.message || e }), false);
  }
}

ue_delete?.addEventListener("click", async () => {
  if (!isAdmin || !editingUserUid) return;
  await deleteUserFlow(editingUserUid);
});


transferSwap?.addEventListener("click", () => {
  const a = tr_from.value; tr_from.value = tr_to.value; tr_to.value = a;
});

transferBtn?.addEventListener("click", async () => {
  if (!isAdmin) return;
  const fromUid = tr_from.value, toUid = tr_to.value;
  if (!fromUid || !toUid) return setTransferMsg(t("dash.val_select_agents"), false);
  if (fromUid === toUid) return setTransferMsg(t("dash.val_select_different"), false);
  if (!confirm(t("dash.confirm_transfer_all", { from: getUserLabel(fromUid), to: getUserLabel(toUid) }))) return;
  try {
    setTransferMsg(t("dash.msg_transfer_progress"), true);
    const snap = await getDocs(query(collection(db, "properties"), where("agentId", "==", fromUid)));
    if (snap.empty) return setTransferMsg(t("dash.msg_no_props_agent"), false);
    let count = 0;
    const ops = [];
    snap.forEach(d => { ops.push(b => b.update(doc(db, "properties", d.id), { agentId: toUid })); count++; });
    await commitBatchInChunks(ops);
    setTransferMsg(t("dash.msg_transfer_done", { count }), true);
    await loadMyProperties(); await loadAllProperties();
  } catch (e) {
    console.error(e);
    setTransferMsg(t("dash.err_transfer", { msg: e?.message || e }), false);
  }
});


logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../pages/login.html#" + atob("cnYxNw==");
});


function refreshAllDynamicText() {
  translatePage();                   // data-i18n elements (updates option textContent too)
  translateRegionOptions();          // translate <option> labels in region selects
  initChoices();                     // re-init Choices.js so it picks up translated option labels
  translateRegionOptions();          // run again after Choices.js re-renders its own DOM
  refreshStatusButtonLabels();       // edit modal status buttons
  addFeaturesWidget?.refresh();      // features widget
  editFeaturesWidget?.refresh();     // edit features widget
  showView(currentViewName);         // re-set page title/subtitle

  document.querySelector("[data-view='home'] span")?.setAttribute("data-i18n", "dash.nav_home");
  document.querySelector("[data-view='my'] span")?.setAttribute("data-i18n", "dash.nav_my");
  document.querySelector("[data-view='add'] span")?.setAttribute("data-i18n", "dash.nav_add");
  if (navAllBtn) navAllBtn.querySelector("span")?.setAttribute("data-i18n", "dash.nav_admin_panel");
  if (navUsersBtn) navUsersBtn.querySelector("span")?.setAttribute("data-i18n", "dash.nav_users");
  translatePage(); // second pass to catch newly-set keys

  _addTitleUpdate?.();
  _editTitleUpdate?.();

  if (!myPropsGrid?.querySelector(".card")) return;
  loadMyProperties();
  if (currentViewName === "home") loadStats();
  if (isAdmin) { loadAllProperties(); renderUsersTable(); }
}

onLanguageChange(refreshAllDynamicText);


// ── Init
document.addEventListener("DOMContentLoaded", async () => {

  await initI18n();

  translatePage();

  initLangSwitcher();

  initChoices();
  translateRegionOptions();

  addFeaturesWidget = buildFeaturesWidget(
    $("featuresMultiselect"), $("featuresTags"), [],
    $("featuresSearch"), $("featuresSearchClear")
  );
  editFeaturesWidget = buildFeaturesWidget(
    $("e_featuresMultiselect"), $("e_featuresTags"), [],
    $("e_featuresSearch"), $("e_featuresSearchClear")
  );

  _addTitleUpdate = wireTitlePreview($("transactionType"), $("propertyType"), $("region"), $("titlePreview"));
  _editTitleUpdate = wireTitlePreview($("e_transactionType"), $("e_propertyType"), $("e_region"), $("e_titlePreview"));

  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const sidebarOverlay = document.querySelector(".sidebar-overlay");
  sidebarToggle?.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  sidebarOverlay?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.body.classList.remove("sidebar-open"); });

  document.querySelectorAll(".sidebar-nav .navbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (window.innerWidth < 992) document.body.classList.remove("sidebar-open");
    });
  });
});

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "../pages/login.html#" + atob("cnYxNw=="); return; }
  currentUser = user;
  if (authStatus) authStatus.textContent = `${t("dash.logged_in")} ${user.email}`;
  const currentUserName = await loadCurrentUserName(user.uid, user.email || "");
  if (uidBadge) uidBadge.textContent = currentUserName || user.email || "-";

  const topbar = uidBadge?.closest(".topbar");
  const accountLabel = topbar?.querySelector(".account-label");
  if (accountLabel) accountLabel.textContent = t("dash.topbar_account");

  currentRole = await getUserRole(user.uid);
  isAdmin = currentRole === "admin";
  if (brandSub) brandSub.textContent = isAdmin ? t("dash.brand_sub_admin") : t("dash.brand_sub_agent");
  if (adminSep) adminSep.classList.toggle("d-none", !isAdmin);
  if (navAllBtn) navAllBtn.classList.toggle("d-none", !isAdmin);
  if (navUsersBtn) navUsersBtn.classList.toggle("d-none", !isAdmin);
  if (navProjectsBtn) navProjectsBtn.classList.toggle("d-none", !isAdmin);


  await initCode();
  if (isAdmin) { await loadUsers(); await loadAllProperties(); }
  await loadMyProperties();
  if (homeMsg) homeMsg.textContent = isAdmin ? t("dash.msg_admin") : t("dash.msg_agent");
  await loadStats();
  showView("home");
});