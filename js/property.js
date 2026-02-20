import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
  authDomain: "reverie-c861c.firebaseapp.com",
  projectId: "reverie-c861c",
  storageBucket: "reverie-c861c.firebasestorage.app",
  messagingSenderId: "122254003952",
  appId: "1:122254003952:web:67dea6de1f5eb97a9b7c35"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ✅ Hamburger (fără script.js) */
function initHamburger() {
  const btn = document.getElementById("navbarHamburger");
  const menu = document.querySelector(".mobile-menu-content");
  if (!btn || !menu) return;

  const setState = (open) => {
    btn.classList.toggle("active", open);
    menu.classList.toggle("open", open);
    document.body.classList.toggle("no-scroll", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  btn.addEventListener("click", () => setState(!btn.classList.contains("active")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) setState(false);
  });
  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("open")) return;
    if (e.target === btn || btn.contains(e.target) || menu.contains(e.target)) return;
    setState(false);
  });
}
initHamburger();

/* Helpers */
function qp(key) { try { return new URLSearchParams(location.search).get(key); } catch { return null; } }
function safe(v, fb = "—") { const s = String(v ?? "").trim(); return s ? s : fb; }

function normalizeStatus(raw) {
  const s = String(raw || "active").trim().toLowerCase();
  if (["stopat", "stopped", "paused", "inactive"].includes(s)) return "stopped";
  if (["inchiriat", "rented", "rent"].includes(s)) return "rented";
  if (["vandut", "sold", "sale_done"].includes(s)) return "sold";
  return "active";
}
function statusLabel(st) {
  if (st === "stopped") return "STOPAT";
  if (st === "rented") return "ÎNCHIRIAT";
  if (st === "sold") return "VÂNDUT";
  return "";
}

/* DOM */
const titleEl = document.getElementById("title");
const priceEl = document.getElementById("price");
const transactionTypeEl = document.getElementById("transactionType");
const generalInfoEl = document.getElementById("generalInfo");
const featuresEl = document.getElementById("features");

const mainImageEl = document.getElementById("mainImage");
const thumbsEl = document.getElementById("thumbs");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const statusOverlayEl = document.getElementById("statusOverlay");
const statusTextEl = document.getElementById("statusText");

const agentNameEl = document.getElementById("agentName");
const agentEmailEl = document.getElementById("agentEmail");
const agentPhoneEl = document.getElementById("agentPhone");
const agentPhotoEl = document.getElementById("agentPhoto");

const callBtn = document.getElementById("callAgentBtn");
const messageBtn = document.getElementById("messageBtn");

/* Load property */
const propertyId = qp("id");
if (!propertyId) {
  document.body.innerHTML = "<p style='padding:20px'>Proprietate invalidă (lipsește id).</p>";
  throw new Error("Missing property id");
}

const snap = await getDoc(doc(db, "properties", propertyId));
if (!snap.exists()) {
  document.body.innerHTML = "<p style='padding:20px'>Proprietatea nu există.</p>";
  throw new Error("Property not found");
}
const p = snap.data() || {};

/* ✅ STATUS OVERLAY FULL (doar pentru stopat/inchiriat/vandut) */
const rawStatus = (p.status ?? p.state ?? p.availability) ?? "active";
const st = normalizeStatus(rawStatus);
const lbl = statusLabel(st);

if (statusOverlayEl && statusTextEl) {
  if (lbl) {
    statusTextEl.textContent = lbl;
    statusOverlayEl.style.display = "flex";
  } else {
    statusOverlayEl.style.display = "none";
  }
}

/* Title / price / type */
if (titleEl) titleEl.textContent = safe(p.title || p.propertyType, "Fără titlu");

if (priceEl) {
  const pr = (typeof p.price === "number" || String(p.price ?? "").trim() !== "") ? p.price : null;
  priceEl.textContent = pr !== null ? `€${pr}` : "€-";
}

if (transactionTypeEl) {
  const tt = String(p.transactionType || "").toLowerCase();
  transactionTypeEl.textContent = tt === "sale" ? "Vânzare" : "Chirie";
}

/* General info */
function addRow(label, value) {
  if (!generalInfoEl) return;
  if (value === undefined || value === null || String(value).trim() === "") return;
  const li = document.createElement("li");
  li.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  generalInfoEl.appendChild(li);
}
addRow("Cod", safe(p.code, ""));
addRow("Suprafață", p.area ? `${p.area} m²` : "");
addRow("Camere", (p.rooms ?? "") === "" ? "" : p.rooms);
addRow("Etaj", (p.floor && p.totalFloors) ? `${p.floor} / ${p.totalFloors}` : "");
addRow("Înălțime camere", p.ceilingHeight ? `${p.ceilingHeight} m` : "");
addRow("Băi", (p.bathrooms ?? "") === "" ? "" : p.bathrooms);
addRow("Bucătărie", p.kitchenAera ? `${p.kitchenAera} m²` : "");

/* Features */
if (featuresEl) featuresEl.innerHTML = "";
const hasFeatures = Array.isArray(p.features) && p.features.length > 0;
if (hasFeatures && featuresEl) {
  p.features.forEach(f => {
    const li = document.createElement("li");
    li.textContent = "• " + String(f);
    featuresEl.appendChild(li);
  });
}
// Hide "Caracteristici" heading and list if no features
if (!hasFeatures && featuresEl) {
  // Hide the h3 before featuresEl and the featuresEl itself
  const h3 = featuresEl.previousElementSibling;
  if (h3 && h3.tagName === "H3") h3.style.display = "none";
  featuresEl.style.display = "none";
}

/* Gallery */
const images = Array.isArray(p.images) ? p.images : (p.mainImage ? [p.mainImage] : []);
let current = 0;

function setActiveThumb(index) {
  if (!thumbsEl) return;
  const imgs = Array.from(thumbsEl.querySelectorAll("img"));
  imgs.forEach((im, i) => im.classList.toggle("active", i === index));
}

function showImage(index) {
  if (!mainImageEl || images.length === 0) return;
  current = (index + images.length) % images.length;
  mainImageEl.src = images[current];
  setActiveThumb(current);
}

if (thumbsEl) thumbsEl.innerHTML = "";
if (images.length > 0) {
  if (thumbsEl) {
    images.forEach((src, idx) => {
      const im = document.createElement("img");
      im.src = src;
      im.alt = "";
      im.addEventListener("click", () => showImage(idx));
      thumbsEl.appendChild(im);
    });
  }
  showImage(0);
} else {
  if (mainImageEl) mainImageEl.src = "../images/img1.png";
}

prevBtn?.addEventListener("click", () => showImage(current - 1));
nextBtn?.addEventListener("click", () => showImage(current + 1));

/* Lightbox */
const lightbox = document.createElement("div");
lightbox.id = "lightbox";
lightbox.style.cssText = `
  display:none; position:fixed; inset:0; z-index:9999;
  background:rgba(0,0,0,0.92); align-items:center; justify-content:center;
`;
lightbox.innerHTML = `
  <button id="lbClose" style="position:absolute;top:16px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;line-height:1;" aria-label="Inchide">&times;</button>
  <button id="lbPrev" style="position:absolute;left:16px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:1.8rem;padding:10px 16px;cursor:pointer;border-radius:50%;" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>
  <div style="position:relative;display:inline-flex;">
    <img id="lbImg" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:6px;" src="" alt="">
    <div class="wm-center" aria-hidden="true"></div>
  </div>
  <button id="lbNext" style="position:absolute;right:16px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:1.8rem;padding:10px 16px;cursor:pointer;border-radius:50%;" aria-label="Urmator"><i class="fas fa-chevron-right"></i></button>
`;
document.body.appendChild(lightbox);

const lbImg = document.getElementById("lbImg");
const lbClose = document.getElementById("lbClose");
const lbPrev = document.getElementById("lbPrev");
const lbNext = document.getElementById("lbNext");

function openLightbox(index) {
  current = (index + images.length) % images.length;
  lbImg.src = images[current];
  lightbox.style.display = "flex";
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  lightbox.style.display = "none";
  document.body.style.overflow = "";
}
function lbShowImage(index) {
  current = (index + images.length) % images.length;
  lbImg.src = images[current];
  setActiveThumb(current);
  if (mainImageEl) mainImageEl.src = images[current];
}

if (mainImageEl) mainImageEl.style.cursor = "zoom-in";
mainImageEl?.addEventListener("click", () => openLightbox(current));
lbClose.addEventListener("click", closeLightbox);
lbPrev.addEventListener("click", () => lbShowImage(current - 1));
lbNext.addEventListener("click", () => lbShowImage(current + 1));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (e) => {
  if (lightbox.style.display !== "flex") return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lbShowImage(current - 1);
  if (e.key === "ArrowRight") lbShowImage(current + 1);
});

/* Agent */
async function loadAgent(agentId) {
  if (!agentId) return null;
  const aSnap = await getDoc(doc(db, "users", agentId));
  if (!aSnap.exists()) return null;
  return aSnap.data() || null;
}

const agent = await loadAgent(p.agentId);
if (agent) {
  if (agentNameEl) agentNameEl.textContent = safe(agent.name, "Agent");

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

  if (callBtn && agentPhoneEl) callBtn.href = agentPhoneEl.href || "#";
  if (messageBtn && agentEmailEl) messageBtn.href = agentEmailEl.href || "#";
}
