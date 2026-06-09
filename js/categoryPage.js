/**
 * categoryPage.js
 * Powers all four category pages: apartments, houses, lands, commercial.
 * Reads data-category from <body>, fetches Firestore, renders cards.
 */

import {
  initI18n, t, onLanguageChange, getCurrentLanguage,
  normalizeType, normalizeTransaction, normalizeStatus,
  translatePropertyTypeRaw, generateTitle, translateLocation,
  translateStatus, roomsLabel, translatePage
} from "../js/i18n.js";
import { initLangSwitcher } from "../js/langSwitcher.js";

// ── Helpers
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function norm(s) {
  return String(s ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

function toSlug(str) {
  return String(str || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-");
}

function buildPropertySlug(p) {
  const code = String(p.code || p.id || "");
  const tx = normalizeTransaction(p.transactionType || "sale");
  const txRO = tx === "rent" ? "se-inchiriaza" : "se-vinde";
  const type = toSlug(String(p.propertyType || "proprietate"));
  const loc  = toSlug(String(p.region || "").split(",")[0].trim());
  const price = typeof p.price === "number" ? p.price : "";
  return [code, txRO, type, loc, price ? `${price}e` : ""].filter(Boolean).join("-");
}

function propertyUrl(p) {
  const slug = buildPropertySlug(p) || p.slug || p.id;
  return `property/#${encodeURIComponent(slug)}`;
}

function parseRegionParts(region) {
  return String(region ?? "").split(",").map(x => norm(x)).filter(Boolean);
}

// ── Firebase config
const FB_CONFIG = {
  apiKey:            "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
  authDomain:        "reverie-c861c.firebaseapp.com",
  projectId:         "reverie-c861c",
  storageBucket:     "reverie-c861c.firebasestorage.app",
  messagingSenderId: "122254003952",
  appId:             "1:122254003952:web:67dea6de1f5eb97a9b7c35",
};

async function fetchByCategory(categoryCanonical) {
  const [appMod, fsMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js"),
  ]);
  const { initializeApp, getApps, getApp } = appMod;
  const { getFirestore, collection, getDocs } = fsMod;
  const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
  const db  = getFirestore(app);
  const snap = await getDocs(collection(db, "properties"));
  const items = [];
  snap.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    const canonical = normalizeType(data.propertyType || "");
    const status    = normalizeStatus(data.status || data.state || data.availability || "active");
    if (canonical === categoryCanonical && status === "active") items.push(data);
  });
  return items;
}

// ── Build a property card — identical structure/classes to the homepage
function buildCard(p) {
  const rawTitle    = String(p.title || "");
  const txCanonical = normalizeTransaction(p.transactionType || "sale");

  const displayTitle = (p.propertyType && p.region)
    ? generateTitle(txCanonical, p.propertyType, p.region)
    : (rawTitle || t("offers.no_offers"));

  const price         = typeof p.price === "number" ? p.price : null;
  const formattedPrice = price !== null
    ? price.toLocaleString(getCurrentLanguage() === "en" ? "en-US" : "ro-RO") : "-";

  const code        = String(p.code || p.id || "");
  const roomsRaw    = (p.rooms === 0 || p.rooms) ? String(p.rooms) : "";
  const roomsValue  = norm(roomsRaw);
  const canonicalType = normalizeType(p.propertyType || "");
  const typeText    = p.propertyType ? translatePropertyTypeRaw(p.propertyType)
                    : (canonicalType ? canonicalType : "");
  const regionRaw   = String(p.region || "");
  const regionParts = parseRegionParts(regionRaw);
  const img         = String(p.mainImage || (Array.isArray(p.images) ? p.images[0] : "") || "../images/wmark.png");
  const status      = normalizeStatus(p.status || p.state || p.availability || "active");
  const overlayTxt  = translateStatus(status);

  // Outer col div — same Bootstrap col classes as homepage
  const col = document.createElement("div");
  col.className = "col-12 col-sm-6 col-md-4";
  col.dataset.id = p.id;

  col.innerHTML = `
    <article class="card apart-card prop-card"
      data-id="${esc(p.id)}"
      data-title="${esc(norm(rawTitle))}"
      data-price="${price ?? ""}"
      data-code="${esc(norm(code))}"
      data-rooms="${esc(roomsValue)}"
      data-roomsraw="${esc(roomsRaw)}"
      data-type="${esc(canonicalType)}"
      data-proptype-raw="${esc(p.propertyType || "")}"
      data-region="${esc(regionRaw)}"
      data-regionparts="${esc(regionParts.join(","))}"
      data-status="${esc(status)}"
      data-transaction="${esc(txCanonical)}"
    >
      <div class="prop-img-wrap image-overlay-wrapper">
        <img src="${esc(img)}" class="card-img-top" alt="${esc(displayTitle)}" loading="lazy">
        <div class="prop-status-overlay" aria-hidden="true">
          <span>${esc(overlayTxt)}</span>
        </div>
      </div>
      <div class="card-body">
        <div>
          <div class="card-head d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <h5 class="card-title">${esc(displayTitle)}</h5>
            <div class="card-price"><i class="fa-solid fa-euro-sign"></i> €${formattedPrice}</div>
          </div>
          <div class="card-feature-grid">
            ${regionRaw ? `<div class="feature-item"><i class="fa-solid fa-location-dot"></i><span>${esc(translateLocation(regionRaw))}</span></div>` : ""}
            <div class="feature-item" data-type-display="${esc(canonicalType)}" data-proptype-raw="${esc(p.propertyType || "")}">
              <i class="fa-solid fa-house"></i><span>${esc(typeText)}</span>
            </div>
            ${roomsRaw ? `<div class="feature-item"><i class="fa-solid fa-bed"></i><span>${esc(roomsLabel(roomsRaw))}</span></div>` : ""}
            <div class="feature-item code-item">
              <i class="fa-solid fa-hashtag"></i><span>${t("offers.code_label")}: ${esc(code)}</span>
            </div>
          </div>
        </div>
        <div class="card-actions">
          <a href="${propertyUrl(p)}" class="btn btn-sm btn-outline-danger">${t("offers.view_details")}</a>
        </div>
      </div>
    </article>`;

  return col;
}

// ── Rooms filter (apartments only)
let _activeRoom = "all";

function buildRoomsFilter(items) {
  const wrap = document.getElementById("roomsFilterWrap");
  if (!wrap) return;

  // Collect available room counts from data
  const roomSet = new Set();
  items.forEach(p => {
    const r = p.rooms === 0 || p.rooms ? Number(p.rooms) : NaN;
    if (!isNaN(r) && r > 0) roomSet.add(r);
  });

  const tabs = [
    { key: "all",  label: () => t("rooms_filter.all"), test: () => true },
    { key: "1",    label: () => t("rooms_filter.n1"),  test: (r) => r === 1 },
    { key: "2",    label: () => t("rooms_filter.n2"),  test: (r) => r === 2 },
    { key: "3",    label: () => t("rooms_filter.n3"),  test: (r) => r === 3 },
    { key: "4",    label: () => t("rooms_filter.n4"),  test: (r) => r >= 4 },
  ];

  function renderTabs() {
    wrap.innerHTML = "";
    tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rooms-tab" + (tab.key === _activeRoom ? " active" : "");
      btn.textContent = tab.label();
      btn.dataset.room = tab.key;
      btn.addEventListener("click", () => {
        _activeRoom = tab.key;
        renderTabs();
        applyRoomsFilter(items);
      });
      wrap.appendChild(btn);
    });
  }

  renderTabs();
  // Re-render tab labels on lang change
  onLanguageChange(() => renderTabs());
}

function applyRoomsFilter(items) {
  const grid = document.getElementById("catGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = _activeRoom === "all" ? items : items.filter(p => {
    const r = p.rooms === 0 || p.rooms ? Number(p.rooms) : NaN;
    if (isNaN(r)) return false;
    if (_activeRoom === "1") return r === 1;
    if (_activeRoom === "2") return r === 2;
    if (_activeRoom === "3") return r === 3;
    if (_activeRoom === "4") return r >= 4;
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="cat-empty" style="grid-column:1/-1;">
      <i class="fa-solid fa-house-circle-xmark"></i>
      <p class="fw-semibold fs-5 mb-0">${t("category_page.no_results")}</p>
    </div>`;
    updateBadge(0);
    return;
  }

  filtered.forEach(p => grid.appendChild(buildCard(p)));
  updateBadge(filtered.length);
}

function renderGrid(items) {
  const grid = document.getElementById("catGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = `<div class="cat-empty" style="grid-column:1/-1;">
      <i class="fa-solid fa-house-circle-xmark"></i>
      <p class="fw-semibold fs-5 mb-0">${t("category_page.no_results")}</p>
    </div>`;
    return;
  }
  items.forEach(p => grid.appendChild(buildCard(p)));
}

function updateBadge(count) {
  const badge = document.getElementById("catCountBadge");
  if (badge) badge.textContent = t("category_page.showing", { count });
}

// ── Hamburger
function initHamburger() {
  const btn  = document.getElementById("navbarHamburger");
  const menu = document.querySelector(".mobile-menu-content");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
  });
  document.addEventListener("click", e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
    }
  });
}

// ── Main
let _allItems = [];

(async function main() {
  await initI18n();
  initLangSwitcher();
  translatePage();
  initHamburger();

  const category = document.body.dataset.category || "apartment";
  const isApartments = category === "apartment";

  // Update heading
  const titleEl = document.getElementById("catTitle");
  function syncTitle() {
    if (titleEl) {
      const key = titleEl.dataset.i18n;
      if (key) titleEl.textContent = t(key);
    }
  }
  syncTitle();

  // Show/hide rooms filter section
  const roomsSection = document.getElementById("roomsFilterSection");
  if (roomsSection) roomsSection.style.display = isApartments ? "" : "none";

  // Re-translate everything on lang change
  onLanguageChange(() => {
    translatePage();
    syncTitle();
    updateBadge(isApartments ? document.querySelectorAll("#catGrid .apart-card").length : _allItems.length);
    if (_allItems.length) {
      if (isApartments) {
        applyRoomsFilter(_allItems);
      } else {
        renderGrid(_allItems);
        updateBadge(_allItems.length);
      }
    }
  });

  const grid = document.getElementById("catGrid");
  if (grid) {
    grid.innerHTML = `<div class="cat-loading" style="grid-column:1/-1;">
      <i class="fa-solid fa-spinner fa-spin me-2"></i>
      <span>${t("category_page.loading")}</span>
    </div>`;
  }

  try {
    _allItems = await fetchByCategory(category);

    if (isApartments) {
      buildRoomsFilter(_allItems);
      applyRoomsFilter(_allItems);
    } else {
      renderGrid(_allItems);
      updateBadge(_allItems.length);
    }
  } catch (err) {
    console.error(err);
    if (grid) {
      grid.innerHTML = `<div class="cat-loading" style="grid-column:1/-1;color:var(--red);">${t("offers.error_load")}</div>`;
    }
  }
})();