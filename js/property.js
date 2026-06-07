// ── Imports
import {
  initI18n, t, onLanguageChange, getCurrentLanguage,
  normalizeStatus, normalizeTransaction, translateStatus, translateTransaction,
  translatePropertyTypeRaw, translateFeature, generateTitle, normalizeTransaction as normTx,
  formatLocation
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

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const db  = getFirestore(app);


function qp(key) {
  try { return new URLSearchParams(location.search).get(key); } catch { return null; }
}


// ── Slug helpers
function toSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function getHashSlug() {
  return decodeURIComponent(window.location.hash.replace(/^#/, "")).trim() || null;
}
function safe(v, fb = "—") {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : fb;
}


function initHamburger() {
  const btn  = document.getElementById("navbarHamburger");
  const menu = document.querySelector(".mobile-menu-content");
  if (!btn || !menu) return;

  const setState = open => {
    btn.classList.toggle("active", open);
    menu.classList.toggle("open", open);
    document.body.classList.toggle("no-scroll", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
  };

  btn.addEventListener("click", () => setState(!btn.classList.contains("active")));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && menu.classList.contains("open")) setState(false);
  });
  document.addEventListener("click", e => {
    if (!menu.classList.contains("open")) return;
    if (e.target === btn || btn.contains(e.target) || menu.contains(e.target)) return;
    setState(false);
  });
}


const titleEl          = document.getElementById("title");
const priceEl          = document.getElementById("price");
const transactionTypeEl = document.getElementById("transactionType");
const generalInfoEl    = document.getElementById("generalInfo");
const featuresEl       = document.getElementById("features");
const mainImageEl      = document.getElementById("mainImage");
const thumbsEl         = document.getElementById("thumbs");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");
const statusOverlayEl  = document.getElementById("statusOverlay");
const statusTextEl     = document.getElementById("statusText");
const agentNameEl      = document.getElementById("agentName");
const agentEmailEl     = document.getElementById("agentEmail");
const agentPhoneEl     = document.getElementById("agentPhone");
const agentPhotoEl     = document.getElementById("agentPhoto");
const callBtn          = document.getElementById("callAgentBtn");
const messageBtn       = document.getElementById("messageBtn");


await initI18n();
initHamburger();
initLangSwitcher();

function translateStaticPage() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key  = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
  });
  document.title = t("meta.property_title");
}
translateStaticPage();
onLanguageChange(() => { translateStaticPage(); rerenderProperty(); });


let propertyId = null;
const _hashSlug = getHashSlug();
if (_hashSlug) {
  const { fsMod, db: _db } = await (async () => {
    const [appMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js"),
    ]);
    return { fsMod, db: fsMod.getFirestore(appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FB_CONFIG)) };
  })();
  const { collection, getDocs, query, where } = fsMod;

  const codeMatch = _hashSlug.match(/^(\d+)-/);
  if (codeMatch) {
    const codeFromSlug = codeMatch[1];
    const codeSnap = await getDocs(query(collection(_db, "properties"), where("code", "==", codeFromSlug)));
    if (!codeSnap.empty) propertyId = codeSnap.docs[0].id;
  }

  if (!propertyId) {
    const slugSnap = await getDocs(query(collection(_db, "properties"), where("slug", "==", _hashSlug)));
    if (!slugSnap.empty) propertyId = slugSnap.docs[0].id;
  }
} else {
  propertyId = qp("id");
}

if (!propertyId) {
  document.body.innerHTML = `<p style="padding:20px">${t("property.invalid_id")}</p>`;
  throw new Error("Missing property id or slug");
}


const snap = await getDoc(doc(db, "properties", propertyId));
if (!snap.exists()) {
  document.body.innerHTML = `<p style="padding:20px">${t("property.not_found")}</p>`;
  throw new Error("Property not found");
}
const p = snap.data() || {};


let images  = [];
let current = 0;
let lbl     = "";

function rerenderProperty() {
  const lang = getCurrentLanguage();

  
  const rawStatus = p.status ?? p.state ?? p.availability ?? "active";
  const st = normalizeStatus(rawStatus);
  lbl = translateStatus(st);

  if (statusOverlayEl && statusTextEl) {
    if (lbl) {
      statusTextEl.textContent = lbl;
      statusOverlayEl.style.display = "flex";
    } else {
      statusOverlayEl.style.display = "none";
    }
  }

  
  if (titleEl) {
    const txCanonical = normalizeTransaction(p.transactionType || "sale");
    const generatedTitle = (p.propertyType && p.region)
      ? generateTitle(txCanonical, p.propertyType, p.region)
      : "";
    titleEl.textContent = generatedTitle || safe(p.title || p.propertyType, t("property.title_fallback"));
  }

  
  if (priceEl) {
    const pr = (typeof p.price === "number" || String(p.price ?? "").trim() !== "") ? p.price : null;
    priceEl.textContent = pr !== null ? `€${pr}` : "€-";
  }

  
  if (transactionTypeEl) {
    const canonical = normalizeTransaction(p.transactionType || "sale");
    transactionTypeEl.textContent = translateTransaction(canonical);
  }

  
  if (generalInfoEl) generalInfoEl.innerHTML = "";

  function addRow(labelKey, value) {
    if (!generalInfoEl) return;
    if (value === undefined || value === null) return;
    const s = String(value).trim();
    if (!s || s === "null" || s === "undefined") return;
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${t(labelKey)}</strong><span>${s}</span></div>`;
    generalInfoEl.appendChild(li);
  }

  addRow("property.location", formatLocation(p.region || ""));
  addRow("property.code",     safe(p.code, ""));
  addRow("property.prop_type", translatePropertyTypeRaw(p.propertyType || ""));

  if (p.area != null && String(p.area).trim() !== "")
    addRow("property.area", `${p.area} m²`);

  if (p.landArea != null && Number(p.landArea) > 0)
    addRow("property.land_area", `${p.landArea} ${p.landAreaUnit || "ari"}`);

  if (p.rooms != null && String(p.rooms).trim() !== "")
    addRow("property.rooms", p.rooms);

  if (p.floor && p.totalFloors) addRow("property.floor", `${p.floor} / ${p.totalFloors}`);
  else if (p.floor)             addRow("property.floor", p.floor);

  if (p.ceilingHeight != null && String(p.ceilingHeight).trim() !== "")
    addRow("property.ceiling", `${p.ceilingHeight} m`);

  if (p.bathrooms != null && String(p.bathrooms).trim() !== "")
    addRow("property.bathrooms", p.bathrooms);

  if (p.kitchenAera != null && String(p.kitchenAera).trim() !== "")
    addRow("property.kitchen", `${p.kitchenAera} m²`);

  if (p.balconies != null && Number(p.balconies) > 0)
    addRow("property.balconies", p.balconies);

  if (p.garages != null && Number(p.garages) > 0)
    addRow("property.garages", p.garages);

  
  const genH3 = generalInfoEl?.previousElementSibling;
  if (genH3?.tagName === "H3") {
    genH3.textContent = t("property.general_info");
    const hide = !generalInfoEl?.children.length;
    genH3.style.display = hide ? "none" : "";
    if (generalInfoEl) generalInfoEl.style.display = hide ? "none" : "";
  }

  
  if (featuresEl) featuresEl.innerHTML = "";
  const hasFeatures = Array.isArray(p.features) && p.features.length > 0;
  const featH3 = featuresEl?.previousElementSibling;
  if (hasFeatures && featuresEl) {
    p.features.forEach(f => {
      const li = document.createElement("li");
      li.textContent = translateFeature(String(f));
      featuresEl.appendChild(li);
    });
  }
  if (featH3?.tagName === "H3") {
    featH3.textContent = t("property.features");
    featH3.style.display = hasFeatures ? "" : "none";
    if (featuresEl) featuresEl.style.display = hasFeatures ? "" : "none";
  }

  
  const callBtnIcon = callBtn?.querySelector("i");
  const msgBtnIcon  = messageBtn?.querySelector("i");
  if (callBtn) callBtn.innerHTML  = `<i class="fa fa-phone-alt me-2"></i>${t("property.call_agent")}`;
  if (messageBtn) messageBtn.innerHTML = `<i class="fa fa-envelope me-2"></i>${t("property.send_message")}`;

  
  updateLightboxStatus();

  
  if (thumbsEl) thumbsEl.innerHTML = "";
  if (images.length > 0) {
    images.forEach((src, idx) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:relative;width:100%;aspect-ratio:1/1;";

      const im = document.createElement("img");
      im.src = src; im.alt = ""; im.loading = "lazy";
      im.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:18px;";
      im.addEventListener("click", () => showImage(idx));

      const overlay = buildThumbStatusOverlay();
      if (overlay) wrapper.appendChild(overlay);
      wrapper.appendChild(im);
      thumbsEl.appendChild(wrapper);
    });
    showImage(0);
  } else {
    if (mainImageEl) mainImageEl.src = "../images/img1.png";
  }

  
  refreshThumbStatusLabels();
}


images = Array.isArray(p.images) ? p.images : (p.mainImage ? [p.mainImage] : []);

function setActiveThumb(index) {
  if (!thumbsEl) return;
  Array.from(thumbsEl.children).forEach((wrapper, i) => {
    wrapper.querySelector("img")?.classList.toggle("active", i === index);
  });
}

function showImage(index) {
  if (!mainImageEl || !images.length) return;
  current = (index + images.length) % images.length;
  mainImageEl.src = images[current];
  setActiveThumb(current);
}

function buildThumbStatusOverlay() {
  if (!lbl) return null;
  const thumbStatus = document.createElement("div");
  thumbStatus.className = "thumb-status-overlay";
  thumbStatus.style.cssText = `
    position:absolute;inset:0;z-index:10;pointer-events:none;
    display:flex;align-items:center;justify-content:center;
    background:rgba(255,255,255,0.12);backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);border-radius:18px;opacity:0.7;`;
  const span = document.createElement("span");
  span.className = "thumb-status-text";
  span.textContent = lbl;
  span.style.cssText = `
    padding:0.5rem 0.85rem;border-radius:999px;font-weight:800;
    letter-spacing:0.1em;text-transform:uppercase;color:#8b1212;
    background:rgba(255,255,255,0.88);border:1px solid rgba(183,28,28,0.12);
    font-size:0.65rem;line-height:1;`;
  thumbStatus.appendChild(span);
  return thumbStatus;
}

function refreshThumbStatusLabels() {
  document.querySelectorAll(".thumb-status-text").forEach(el => {
    el.textContent = lbl;
  });
  const lbStatusText = document.getElementById("lbStatusText");
  if (lbStatusText) lbStatusText.textContent = lbl;
}

if (prevBtn) prevBtn.addEventListener("click", () => showImage(current - 1));
if (nextBtn) nextBtn.addEventListener("click", () => showImage(current + 1));


function refreshNavBtnLabels() {
  if (prevBtn) prevBtn.setAttribute("aria-label", t("property.prev_img"));
  if (nextBtn) nextBtn.setAttribute("aria-label", t("property.next_img"));
}
refreshNavBtnLabels();
onLanguageChange(refreshNavBtnLabels);


const lightbox = document.createElement("div");
lightbox.id = "lightbox";
lightbox.className = "lightbox-container";
lightbox.innerHTML = `
  <div class="lightbox-content">
    <button id="lbClose" class="lightbox-close" aria-label="${t("property.close")}">
      <i class="fas fa-times"></i>
    </button>
    <div class="lightbox-image-wrapper">
      <img id="lbImg" class="lightbox-image" src="" alt="">
      <div class="image-watermark" aria-hidden="true">
        <img src="../../images/wmark.png" alt="Reverie watermark"
          style="width:180px;max-width:180px;height:auto;object-fit:contain;opacity:0.42;">
      </div>
      <div class="lightbox-status" id="lbStatus">
        <span class="lightbox-status-text" id="lbStatusText">—</span>
      </div>
    </div>
    <button id="lbPrev" class="slider-btn slider-btn-prev" aria-label="${t("property.prev_img")}">
      <i class="fas fa-chevron-left"></i>
    </button>
    <button id="lbNext" class="slider-btn slider-btn-next" aria-label="${t("property.next_img")}">
      <i class="fas fa-chevron-right"></i>
    </button>
  </div>`;
document.body.appendChild(lightbox);

const lbImg        = document.getElementById("lbImg");
const lbClose      = document.getElementById("lbClose");
const lbPrev       = document.getElementById("lbPrev");
const lbNext       = document.getElementById("lbNext");
const lbStatus     = document.getElementById("lbStatus");
const lbStatusText = document.getElementById("lbStatusText");

function updateLightboxStatus() {
  if (lbl && lbStatusText && lbStatus) {
    lbStatusText.textContent = lbl;
    lbStatus.classList.add("show");
  } else if (lbStatus) {
    lbStatus.classList.remove("show");
  }
}

function openLightbox(index) {
  current = (index + images.length) % images.length;
  lbImg.src = images[current];
  lightbox.classList.add("active");
  document.body.classList.add("lightbox-open");
  updateLightboxStatus();
}

function closeLightbox() {
  lightbox.classList.remove("active");
  document.body.classList.remove("lightbox-open");
  lbStatus?.classList.remove("show");
}

function lbShowImage(index) {
  current = (index + images.length) % images.length;
  lbImg.src = images[current];
  setActiveThumb(current);
  if (mainImageEl) mainImageEl.src = images[current];
  updateLightboxStatus();
}

if (mainImageEl) {
  mainImageEl.style.cursor = "zoom-in";
  mainImageEl.addEventListener("click", () => openLightbox(current));
}

lbClose?.addEventListener("click", closeLightbox);
lbPrev?.addEventListener("click",  () => lbShowImage(current - 1));
lbNext?.addEventListener("click",  () => lbShowImage(current + 1));
lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", e => {
  if (!lightbox.classList.contains("active")) return;
  if (e.key === "Escape")     closeLightbox();
  if (e.key === "ArrowLeft")  lbShowImage(current - 1);
  if (e.key === "ArrowRight") lbShowImage(current + 1);
});


async function loadAgent(agentId) {
  if (!agentId) return null;
  const aSnap = await getDoc(doc(db, "users", agentId));
  return aSnap.exists() ? (aSnap.data() || null) : null;
}

const agent = await loadAgent(p.agentId);
if (agent) {
  if (agentNameEl)  agentNameEl.textContent = safe(agent.name, t("contact.agent_role"));
  if (agentEmailEl) {
    const em = safe(agent.email, "");
    agentEmailEl.textContent = em || "—";
    agentEmailEl.href = em ? `mailto:${em}` : "#";
  }
  if (agentPhoneEl) {
    const ph = safe(agent.phone, "");
    agentPhoneEl.textContent = ph ? ` ${ph}` : " — ";
    agentPhoneEl.href = ph ? `tel:${ph.replace(/\s+/g, "")}` : "#";
  }
  if (agentPhotoEl) {
    const photo = agent.photoUrl || agent.photo || agent.avatar || "";
    if (photo) agentPhotoEl.src = photo;
  }
  if (callBtn    && agentPhoneEl?.href) callBtn.href    = agentPhoneEl.href;
  if (messageBtn && agentEmailEl?.href) messageBtn.href = agentEmailEl.href;
}


onLanguageChange(() => {
  const agentLabelEl = document.querySelector(".agent-box strong");
  if (agentLabelEl) agentLabelEl.textContent = t("property.agent_label");
});


rerenderProperty();