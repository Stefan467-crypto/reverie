import {
  initI18n, t, onLanguageChange, getCurrentLanguage,
  normalizeType, normalizeTransaction, normalizeStatus,
  translateType, translateTransaction, translateStatus,
  translatePropertyTypeRaw, generateTitle, translateLocation,
  roomsLabel
} from "./i18n.js";
import { initLangSwitcher } from "./langSwitcher.js";
import { initCategoryStats } from "./categoryStats.js";


// ── Helpers
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escUrl(s) {
  const str = String(s ?? "").trim();
  if (/^(tel:|mailto:|https?:\/\/)/.test(str)) return str;
  return "#";
}

function norm(s) {
  return String(s ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

function toSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}


function buildPropertySlug(p) {
  const code = String(p.code || p.id || "");
  const tx = normalizeTransaction(p.transactionType || "sale");
  const txRO = tx === "rent" ? "se-inchiriaza" : "se-vinde";
  const type = toSlug(String(p.propertyType || "proprietate"));
  const loc = toSlug(String(p.region || "").split(",")[0].trim());
  const price = typeof p.price === "number" ? p.price : "";
  const parts = [code, txRO, type, loc, price ? `${price}e` : ""].filter(Boolean);
  return parts.join("-");
}


function propertyUrl(p) {
  const slug = buildPropertySlug(p) || p.slug || p.id;
  return `pages/property/#${encodeURIComponent(slug)}`;
}


function agentUrl(a) {
  const slug = a.slug || toSlug(a.name || a.uid || "");
  return `pages/agent/#${encodeURIComponent(slug)}`;
}

function parseRegionParts(region) {
  return String(region ?? "").split(",").map(x => norm(x)).filter(Boolean);
}

async function getProjectsFromFirestore() {
  try {
    const { fsMod, db } = await getFirebase();
    const { collection, getDocs } = fsMod;
    const snap = await getDocs(collection(db, "projects"));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  } catch {
    return [];
  }
}

function getProjectTitle(project) {
  const lang = getCurrentLanguage();
  if (lang === "en") return project.titleEn || project.titleRo || "";
  if (lang === "ru") return project.titleRu || project.titleRo || "";
  return project.titleRo || project.titleEn || project.titleRu || "";
}

function shouldUseProjectsMarquee(grid) {
  if (!grid) return false;
  const container = grid.parentElement;
  if (!container) return false;
  return grid.scrollWidth > container.getBoundingClientRect().width + 1;
}

async function renderProjectsSection() {
  const section = document.querySelector(".projects-section");
  const grid = document.getElementById("projectsGrid");
  if (!section || !grid) return;

  const items = (await getProjectsFromFirestore()).sort((a, b) => String(b.createdAt || 0) - String(a.createdAt || 0));
  if (!items.length) {
    section.style.display = "none";
    grid.classList.remove("projects-grid-row--marquee");
    grid.style.animation = "none";
    return;
  }

  section.style.display = "block";

  grid.innerHTML = "";
  grid.classList.remove("projects-grid-row--marquee");
  grid.style.animation = "none";
  grid.dataset.dupCount = "0";

  items.forEach(project => {
    const card = document.createElement("article");
    card.className = "project-card-wrap";
    const date = project.date ? new Date(project.date).toLocaleDateString(getCurrentLanguage() === "en" ? "en-GB" : getCurrentLanguage() === "ru" ? "ru-RU" : "ro-RO") : "";
    card.innerHTML = `
      <div class="project-card">
        <img src="${esc(project.imageUrl || "images/img1.png")}" alt="${esc(getProjectTitle(project))}">
        <div class="card-body p-3">
          <h5 class="mb-1">${esc(getProjectTitle(project))}</h5>
          <div class="project-date">${esc(date)}</div>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  setTimeout(() => {
    const needsMarquee = shouldUseProjectsMarquee(grid);
    if (!needsMarquee) {
      grid.classList.remove("projects-grid-row--marquee");
      grid.style.animation = "none";
      grid.style.justifyContent = "center";
      grid.dataset.dupCount = "0";
      return;
    }

    const duplicated = [...items, ...items];
    grid.innerHTML = "";
    grid.classList.add("projects-grid-row--marquee");
    grid.style.animation = "projects-marquee 24s linear infinite";
    grid.style.justifyContent = "flex-start";
    grid.dataset.dupCount = String(items.length);

    duplicated.forEach(project => {
      const card = document.createElement("article");
      card.className = "project-card-wrap";
      const date = project.date ? new Date(project.date).toLocaleDateString(getCurrentLanguage() === "en" ? "en-GB" : getCurrentLanguage() === "ru" ? "ru-RU" : "ro-RO") : "";
      card.innerHTML = `
        <div class="project-card">
          <img src="${esc(project.imageUrl || "images/img1.png")}" alt="${esc(getProjectTitle(project))}">
          <div class="card-body p-3">
            <h5 class="mb-1">${esc(getProjectTitle(project))}</h5>
            <div class="project-date">${esc(date)}</div>
          </div>
        </div>`;
      grid.appendChild(card);
    });
  });
}


function autoScrollProjects() {
  const grid = document.getElementById("projectsGrid");
  if (!grid) return;

  const needsMarquee = grid.scrollWidth > grid.clientWidth + 1;
  grid.style.animationPlayState = needsMarquee ? "running" : "paused";
}

function debounce(fn, wait) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

function getQueryParam(key) {
  try { return new URLSearchParams(window.location.search).get(key); } catch { return null; }
}



const FB_CONFIG = {
  apiKey: "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
  authDomain: "reverie-c861c.firebaseapp.com",
  projectId: "reverie-c861c",
  storageBucket: "reverie-c861c.firebasestorage.app",
  messagingSenderId: "122254003952",
  appId: "1:122254003952:web:67dea6de1f5eb97a9b7c35",
  measurementId: "G-3RW7VCE2RX",
};

let _fb = null;
async function getFirebase() {
  if (_fb) return _fb;
  const [appMod, fsMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js"),
  ]);
  const { initializeApp, getApps, getApp } = appMod;
  const { getFirestore } = fsMod;
  const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
  const db = getFirestore(app);
  _fb = { appMod, fsMod, db };
  return _fb;
}

async function fetchProperties(agentId = null) {
  const { fsMod, db } = await getFirebase();
  const { collection, getDocs, query, where } = fsMod;
  const colRef = collection(db, "properties");
  const snap = agentId
    ? await getDocs(query(colRef, where("agentId", "==", agentId)))
    : await getDocs(colRef);
  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  return items;
}

async function fetchAgents() {
  const { fsMod, db } = await getFirebase();
  const { collection, getDocs, query, where } = fsMod;
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "agent")));
  const agents = [];
  snap.forEach(d => agents.push({ uid: d.id, ...d.data() }));
  return agents;
}


// ── Cahul subzones
const CAHUL_GROUP = new Set([
  "focsa", "micro 15", "lapaevca", "centru", "lipovanca", "ghidro",
  "autogara", "spirin", "valincea", "centru-str.puskin",
  "centru-str.creanga", "gebhardt", "centru-baia publica", "jubileu",
  "centru-surin market", "centru-surin magazin", "calea ferata",
  "fabrica de vinuri", "pmk 10",
].map(norm));


// ── Clean URL handler
function initCleanURLs() {
  document.addEventListener("click", e => {
    const link = e.target.closest("a[href]");
    if (!link) return;

    let href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("#")) return;

    const urlMap = {
      "/": "/index.html",
      "../": "../index.html",
      "/pages/dashboard": "/pages/dashboard.html",
      "/pages/login": "/pages/login.html",
      "pages/dashboard": "pages/dashboard.html",
      "pages/login": "pages/login.html",
      "../pages/dashboard": "../pages/dashboard.html",
      "../pages/login": "../pages/login.html",
    };

    const newHref = urlMap[href] || href;
    if (newHref !== href) {
      e.preventDefault();
      window.location.href = newHref;
      return;
    }
  });
}


// ── Hamburger menu
function initHamburger() {
  const btn = document.getElementById("navbarHamburger");
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

  menu.addEventListener("click", e => {
    const target = e.target.closest("a, button");
    if (!target) return;
    if (target.classList.contains("lang-btn")) return;
    if (target.classList.contains("social-link")) return;
    if (target.classList.contains("mobile-menu-call")) return;
    if (target.classList.contains("btn-apel")) return;
    if (target.classList.contains("mobile-menu-auth-btn")) return;
    if (target.tagName === "A" && target.href) setState(false);
  });
}


// ── Custom dropdown
function createDynamicDropdown(dropdownId, onChange) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return null;

  const toggle = dropdown.querySelector(".dropdown-toggle");
  const menu = dropdown.querySelector(".dropdown-menu");
  const searchEl = dropdown.querySelector(".dropdown-search-input");
  const labelEl = dropdown.querySelector(".dropdown-label");
  const optionsBox = dropdown.querySelector(".dropdown-options");
  if (!toggle || !menu || !labelEl || !optionsBox) return null;

  let options = [];

  const close = () => { menu.classList.remove("open"); toggle.classList.remove("open"); dropdown.setAttribute("data-dd-open", "false"); };

  toggle.addEventListener("click", e => {
    e.stopPropagation();
    const opening = !menu.classList.contains("open");

    if (opening) {
      document.querySelectorAll(".custom-dropdown[data-dd-open='true']").forEach(dd => {
        if (dd !== dropdown) {
          dd.querySelector(".dropdown-menu")?.classList.remove("open");
          dd.querySelector(".dropdown-toggle")?.classList.remove("open");
          dd.setAttribute("data-dd-open", "false");
        }
      });
    }
    menu.classList.toggle("open", opening);
    toggle.classList.toggle("open", opening);
    dropdown.setAttribute("data-dd-open", opening ? "true" : "false");
    if (opening && searchEl) searchEl.focus();
  });

  document.addEventListener("click", e => { if (!dropdown.contains(e.target)) close(); });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      const q = norm(searchEl.value);
      options.forEach(o => {
        o.wrapEl.style.display = norm(o.text).includes(q) ? "" : "none";
      });
    });
  }

  function updateLabel() {
    const checked = options.filter(o => o.cbEl.checked);
    if (checked.length === 0) {
      labelEl.textContent = t("offers.filter_all");
      labelEl.classList.remove("has-selection");
      return;
    }
    labelEl.innerHTML = "";
    labelEl.classList.add("has-selection");
    checked.forEach(o => {
      const tag = document.createElement("span");
      tag.className = "selected-tag";
      tag.textContent = o.text;
      const x = document.createElement("span");
      x.className = "remove-tag";
      x.textContent = "✕";
      x.addEventListener("click", e => {
        e.stopPropagation();
        o.cbEl.checked = false;
        updateLabel();
        onChange?.();
      });
      tag.appendChild(x);
      labelEl.appendChild(tag);
    });
  }

  function setOptions(list, sortFn) {
    optionsBox.innerHTML = "";
    const safe = (list || [])
      .filter(x => x && x.value != null && String(x.value).trim() !== "")
      .map(x => ({ value: String(x.value), text: String(x.text ?? x.value) }));

    if (sortFn) safe.sort(sortFn);
    else safe.sort((a, b) => a.text.localeCompare(b.text, getCurrentLanguage(), { sensitivity: "base" }));

    options = safe.map(({ value, text }) => {
      const wrap = document.createElement("label");
      wrap.className = "dropdown-option";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = value;
      cb.addEventListener("change", () => { updateLabel(); onChange?.(); });
      wrap.appendChild(cb);
      wrap.append(" " + text);
      optionsBox.appendChild(wrap);
      return { value, text, cbEl: cb, wrapEl: wrap };
    });
    updateLabel();
  }

  function getSelectedValues() {
    return options.filter(o => o.cbEl.checked).map(o => o.value);
  }

  function clearChecks() {
    options.forEach(o => { o.cbEl.checked = false; });
    updateLabel();
  }

  function setAvailability(allowedSet) {
    options.forEach(o => {
      const allowed = !allowedSet || allowedSet.has(o.value);
      o.wrapEl.style.display = allowed ? "" : "none";
      if (!allowed && o.cbEl.checked) { o.cbEl.checked = false; }
    });
    updateLabel();
  }


  function relabelOptions(labelFn) {
    options.forEach(o => {
      const newText = labelFn(o.value);
      if (newText && newText !== o.text) {
        o.text = newText;

        const cb = o.wrapEl.querySelector("input[type=checkbox]");
        o.wrapEl.innerHTML = "";
        o.wrapEl.appendChild(cb);
        o.wrapEl.append(" " + newText);
      }
    });
    updateLabel();
  }

  function refreshPlaceholder() {
    if (searchEl) searchEl.placeholder = t("offers.filter_search_dd");
    if (!options.filter(o => o.cbEl.checked).length) {
      labelEl.textContent = t("offers.filter_all");
    }
  }

  return { setOptions, getSelectedValues, clearChecks, setAvailability, relabelOptions, refreshPlaceholder, updateLabel };
}


// ── Agents contact section
async function loadAgentsToContactSection() {
  const row = document.getElementById("agentsRow");
  if (!row) return;

  row.innerHTML = `<div class="col-12"><div class="text-muted">${t("contact.loading_agents")}</div></div>`;

  try {
    const agents = await fetchAgents();
    agents.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), getCurrentLanguage(), { sensitivity: "base" })
    );

    if (!agents.length) {
      row.innerHTML = `<div class="col-12"><div class="text-muted">${t("contact.no_agents")}</div></div>`;
      return;
    }

    row.innerHTML = "";
    agents.forEach((a, idx) => {
      const name = (a.name || "Agent").trim();
      const phone = String(a.phone || "").trim();
      const email = String(a.email || "").trim();
      const photo = a.photoUrl || a.photo || a.avatar || a.image
        || (idx % 2 === 0 ? "images/agent1.png" : "images/agent2.png");

      const col = document.createElement("div");
      col.className = "col-md-6";
      col.innerHTML = `
        <a href="${agentUrl(a)}" class="text-decoration-none text-reset">
          <div class="agent-card p-4 d-flex align-items-center gap-3">
            <div class="agent-photo" style="background-image:url('${esc(photo)}')" aria-hidden="true"></div>
            <div class="flex-fill">
              <h5 class="mb-1">${esc(name)}</h5>
              <div class="small text-muted mb-2">${t("contact.agent_role")}</div>
              ${phone ? `<div class="mb-2"><a href="${escUrl("tel:" + phone)}" class="agent-phone">${esc(phone)}</a></div>` : ""}
              ${email ? `<div><a href="${escUrl("mailto:" + email)}" class="agent-email">${esc(email)}</a></div>` : ""}
              <div class="mt-3">
                ${phone ? `<a href="${escUrl("tel:" + phone)}" class="btn btn-danger btn-sm me-2">${t("contact.call_now")}</a>` : ""}
              </div>
            </div>
          </div>
        </a>`;
      row.appendChild(col);
    });
  } catch (e) {
    console.error("Agents load error:", e);
    row.innerHTML = `<div class="col-12"><div class="text-danger">${t("contact.error_agents")}</div></div>`;
  }
}


// ── Watermark compositing (ars pe imagine, nu doar overlay CSS)
const WATERMARK_SRC = "images/wmark.png";
let _wmCache = null;

async function loadWatermarkImg() {
  if (_wmCache) return _wmCache;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { _wmCache = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = WATERMARK_SRC;
  });
}

async function compositeWatermark(photoUrl) {
  const [photo, wm] = await Promise.all([
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("photo load failed"));
      img.src = photoUrl;
    }),
    loadWatermarkImg(),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = photo.naturalWidth || photo.width;
  canvas.height = photo.naturalHeight || photo.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(photo, 0, 0);

  if (wm) {
    const wmW = canvas.width * 0.35;
    const wmH = (wm.naturalHeight / wm.naturalWidth) * wmW;
    const x = (canvas.width - wmW) / 2;
    const y = (canvas.height - wmH) / 2;
    ctx.globalAlpha = 0.42;
    ctx.drawImage(wm, x, y, wmW, wmH);
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}


// ── Property card builder
function buildCard(p) {
  const rawTitle = String(p.title || "");
  const txCanonical = normalizeTransaction(p.transactionType || "sale");

  const displayTitle = (p.propertyType && p.region)
    ? generateTitle(txCanonical, p.propertyType, p.region)
    : (rawTitle || t("offers.no_offers"));
  const price = typeof p.price === "number" ? p.price : null;
  const formattedPrice = price !== null ? price.toLocaleString(getCurrentLanguage() === "en" ? "en-US" : "ro-RO") : "-";
  const code = String(p.code || p.id || "");
  const roomsRaw = p.rooms === 0 || p.rooms ? String(p.rooms) : "";
  const roomsValue = norm(roomsRaw);

  const canonicalType = normalizeType(p.propertyType || "");
  const typeText = p.propertyType ? translatePropertyTypeRaw(p.propertyType) : (canonicalType ? translateType(canonicalType) : "");

  const regionRaw = String(p.region || "");
  const regionParts = parseRegionParts(regionRaw);
  const img = String(p.mainImage || (Array.isArray(p.images) ? p.images[0] : "") || "images/img1.png");

  const status = normalizeStatus(p.status || p.state || p.availability || "active");
  const overlayTxt = translateStatus(status);

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
        <img src="${esc(img)}" class="card-img-top" alt="${esc(displayTitle)}">
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
            <div class="feature-item" data-type-display="${esc(canonicalType)}" data-proptype-raw="${esc(p.propertyType || "")}"><i class="fa-solid fa-house"></i><span>${esc(typeText)}</span></div>
            ${roomsRaw ? `<div class="feature-item"><i class="fa-solid fa-bed"></i><span>${esc(roomsLabel(roomsRaw))}</span></div>` : ""}
            <div class="feature-item code-item"><i class="fa-solid fa-hashtag"></i><span>${t("offers.code_label")}: ${esc(code)}</span></div>
          </div>
        </div>
        <div class="card-actions">
          <a href="${propertyUrl(p)}" class="btn btn-sm btn-outline-danger">${t("offers.view_details")}</a>
        </div>
      </div>
    </article>`;

  // Aplică watermark ars pe imaginea cardului (asincron, după inserare în DOM)
  const rawImgSrc = img;
  requestAnimationFrame(() => {
    const cardImg = col.querySelector(".card-img-top");
    if (cardImg && rawImgSrc && !rawImgSrc.includes("wmark.png") && !rawImgSrc.includes("img1.png")) {
      compositeWatermark(rawImgSrc).then(dataUrl => {
        cardImg.src = dataUrl;
      }).catch(() => { /* fallback rămâne src original */ });
    }
  });

  return col;
}


// ── Property grid & filters
async function initPropertyGrid() {
  const grid = document.getElementById("apartmentsGrid");
  if (!grid) return;

  const resultsCount = document.getElementById("resultsCount");
  const searchInput = document.getElementById("searchInput");
  const codeFilter = document.getElementById("codeFilter");
  const minRange = document.getElementById("minRange");
  const maxRange = document.getElementById("maxRange");
  const minPriceInput = document.getElementById("minPrice");
  const maxPriceInput = document.getElementById("maxPrice");
  const clearBtn = document.getElementById("clearFilters");
  const sortToggle = document.getElementById("sortToggle");
  const sortMenu = document.getElementById("sortMenu");
  const sortItems = sortMenu ? Array.from(sortMenu.querySelectorAll(".sort-item")) : [];
  const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
  const filtersCard = document.getElementById("filtersCard");

  let sortMode = "popular";
  let originalOrder = [];
  const INITIAL_VISIBLE = 6;
  let isExpanded = false;
  let noFilterResultsEl = null;

  const styleEl = document.createElement("style");
  styleEl.textContent = ".apart-hidden{display:none!important}.toggle-all-hidden{display:none!important}";
  document.head.appendChild(styleEl);

  const toggleAllBtn = document.createElement("button");
  toggleAllBtn.className = "btn btn-outline-danger mt-4 d-block mx-auto toggle-all-btn toggle-all-hidden";
  grid.insertAdjacentElement("afterend", toggleAllBtn);

  toggleAllBtn.addEventListener("click", () => { isExpanded = !isExpanded; applyVisibilityLimit(); });

  const onFilterChange = debounce(applyFilters, 120);
  const ddType = createDynamicDropdown("typeDropdown", onFilterChange);
  const ddRooms = createDynamicDropdown("dataRooms", onFilterChange);
  const ddRaions = createDynamicDropdown("raionsDropdown", onFilterChange);

  function refreshStaticLabels() {

    [ddType, ddRooms, ddRaions].forEach(dd => dd?.refreshPlaceholder?.());

    if (toggleFiltersBtn) {
      const shown = filtersCard?.classList.contains("show");
      toggleFiltersBtn.innerHTML = shown
        ? `<i class="fa-solid fa-filter-circle-xmark me-2"></i> ${t("offers.hide_filters")}`
        : `<i class="fa-solid fa-filter me-2"></i> ${t("offers.show_filters")}`;
    }

    sortItems.forEach(item => {
      const key = item.dataset.sort;
      if (key === "popular") item.textContent = t("offers.sort_popular");
      if (key === "asc") item.textContent = t("offers.sort_cheap");
      if (key === "desc") item.textContent = t("offers.sort_expensive");
    });

    if (sortToggle) {
      const activeItem = sortItems.find(i => i.dataset.sort === sortMode);
      const label = activeItem?.textContent || t("offers.sort_label");
      sortToggle.innerHTML = `${label} <span class="caret">▾</span>`;
    }

    if (noFilterResultsEl) {
      const p1 = noFilterResultsEl.querySelector("p:first-of-type");
      const p2 = noFilterResultsEl.querySelector("p:last-of-type");
      if (p1) p1.textContent = t("offers.no_results_title");
      if (p2) p2.textContent = t("offers.no_results_sub");
    }

    if (!toggleAllBtn.classList.contains("toggle-all-hidden")) {
      toggleAllBtn.textContent = isExpanded ? t("offers.hide_all") : t("offers.see_all");
    }

    const total = resultsCount?.dataset.total;
    if (total !== undefined && resultsCount) {
      resultsCount.textContent = t("offers.showing", { count: total });
    }

    grid.querySelectorAll("[data-type-display]").forEach(el => {
      const rawPropType = el.dataset.proptypeRaw || "";
      const canonical = el.dataset.typeDisplay;
      const span = el.querySelector("span");
      if (span) {
        span.textContent = rawPropType
          ? translatePropertyTypeRaw(rawPropType)
          : (canonical ? translateType(canonical) : "");
      }
    });

    grid.querySelectorAll(".apart-card").forEach(card => {

      const titleEl = card.querySelector(".card-title");
      const propTypeRaw = card.getAttribute("data-proptype-raw") || "";
      const regionRaw = card.getAttribute("data-region") || "";
      const txCanonical = card.getAttribute("data-transaction") || "sale";
      if (titleEl && propTypeRaw && regionRaw) {
        titleEl.textContent = generateTitle(txCanonical, propTypeRaw, regionRaw);
      }

      const roomsRaw = card.getAttribute("data-roomsraw") || "";
      const bedEl = card.querySelector(".feature-item .fa-bed")?.parentElement?.querySelector("span");
      if (bedEl && roomsRaw) bedEl.textContent = roomsLabel(roomsRaw);

      const status = card.getAttribute("data-status") || "active";
      const overlaySpan = card.querySelector(".prop-status-overlay span");
      if (overlaySpan) overlaySpan.textContent = translateStatus(status);

      const viewBtn = card.querySelector(".card-actions a");
      if (viewBtn) viewBtn.textContent = t("offers.view_details");

      const codeEl = card.querySelector(".code-item span");
      if (codeEl) {
        const code = card.getAttribute("data-code") || "";
        codeEl.textContent = `${t("offers.code_label")}: ${code}`;
      }
    });
  }

  onLanguageChange(() => refreshStaticLabels());

  if (toggleFiltersBtn && filtersCard) {
    toggleFiltersBtn.addEventListener("click", () => {
      filtersCard.classList.toggle("show");
      const isShown = filtersCard.classList.contains("show");
      toggleFiltersBtn.innerHTML = isShown
        ? `<i class="fa-solid fa-filter-circle-xmark me-2"></i> ${t("offers.hide_filters")}`
        : `<i class="fa-solid fa-filter me-2"></i> ${t("offers.show_filters")}`;
    });
  }

  if (sortToggle && sortMenu) {
    sortToggle.addEventListener("click", e => {
      e.stopPropagation();
      const open = !sortMenu.classList.contains("open");
      sortMenu.classList.toggle("open", open);
      sortToggle.classList.toggle("open", open);
      sortToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", e => {
      if (!sortToggle.contains(e.target) && !sortMenu.contains(e.target)) {
        sortMenu.classList.remove("open");
        sortToggle.classList.remove("open");
        sortToggle.setAttribute("aria-expanded", "false");
      }
    });
    sortItems.forEach(item => {
      item.addEventListener("click", () => {
        sortItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        sortMode = item.dataset.sort;
        sortToggle.innerHTML = `${item.textContent} <span class="caret">▾</span>`;
        sortToggle.classList.add("active");
        sortMenu.classList.remove("open");
        sortToggle.classList.remove("open");
        sortToggle.setAttribute("aria-expanded", "false");
        applyFilters();
      });
    });
  }

  function updateRangeZIndex() {
    if (!minRange || !maxRange) return;
    const minPct = (Number(minRange.value) - Number(minRange.min)) /
      (Number(minRange.max) - Number(minRange.min) || 1);
    if (minPct > 0.5) {
      minRange.style.zIndex = "5"; maxRange.style.zIndex = "4";
    } else {
      minRange.style.zIndex = "4"; maxRange.style.zIndex = "5";
    }
  }

  if (minRange && maxRange) {
    minRange.addEventListener("input", () => {
      if (Number(minRange.value) > Number(maxRange.value)) minRange.value = maxRange.value;
      if (minPriceInput) minPriceInput.value = minRange.value;
      updateRangeZIndex(); applyFilters();
    });
    maxRange.addEventListener("input", () => {
      if (Number(maxRange.value) < Number(minRange.value)) maxRange.value = minRange.value;
      if (maxPriceInput) maxPriceInput.value = maxRange.value;
      updateRangeZIndex(); applyFilters();
    });
  }

  if (minPriceInput) minPriceInput.addEventListener("change", () => {
    let v = Number(minPriceInput.value || 0);
    if (!isFinite(v) || v < 0) v = 0;
    if (minRange) minRange.value = String(v);
    applyFilters();
  });
  if (maxPriceInput) maxPriceInput.addEventListener("change", () => {
    let v = Number(maxPriceInput.value || 0);
    const lim = Number(maxRange?.max || 120000);
    if (!isFinite(v) || v <= 0) v = lim;
    if (maxRange) maxRange.value = String(Math.min(v, lim));
    applyFilters();
  });

  if (searchInput) searchInput.addEventListener("input", debounce(applyFilters, 150));
  if (codeFilter) codeFilter.addEventListener("input", debounce(applyFilters, 150));
  if (clearBtn) clearBtn.addEventListener("click", resetAll);

  function applyVisibilityLimit() {
    const allCols = Array.from(grid.children).filter(c => !c.classList.contains("no-results-msg"));
    allCols.forEach(c => c.classList.remove("apart-hidden"));
    const visible = allCols.filter(c => c.style.display !== "none");
    const total = visible.length;

    if (total === 0 && allCols.length > 0) {
      if (!noFilterResultsEl) {
        noFilterResultsEl = document.createElement("div");
        noFilterResultsEl.className = "no-results-msg col-12 text-center py-5";
        noFilterResultsEl.innerHTML = `
          <i class="fa-solid fa-magnifying-glass fa-2x mb-3 text-muted"></i>
          <p class="fw-semibold fs-5 mb-1">${t("offers.no_results_title")}</p>
          <p class="text-muted">${t("offers.no_results_sub")}</p>`;
        grid.appendChild(noFilterResultsEl);
      }
      noFilterResultsEl.style.display = "";
      toggleAllBtn.classList.add("toggle-all-hidden");
      if (resultsCount) { resultsCount.textContent = t("offers.showing", { count: 0 }); resultsCount.dataset.total = "0"; }
      return;
    }
    if (noFilterResultsEl) noFilterResultsEl.style.display = "none";

    if (total <= INITIAL_VISIBLE) {
      toggleAllBtn.classList.add("toggle-all-hidden");
      if (resultsCount) { resultsCount.textContent = t("offers.showing", { count: total }); resultsCount.dataset.total = String(total); }
      return;
    }

    toggleAllBtn.classList.remove("toggle-all-hidden");
    if (isExpanded) {
      toggleAllBtn.textContent = t("offers.hide_all");
      if (resultsCount) { resultsCount.textContent = t("offers.showing", { count: total }); resultsCount.dataset.total = String(total); }
    } else {
      visible.forEach((col, i) => { if (i >= INITIAL_VISIBLE) col.classList.add("apart-hidden"); });
      toggleAllBtn.textContent = t("offers.see_all");
      if (resultsCount) { resultsCount.textContent = t("offers.showing", { count: INITIAL_VISIBLE }); resultsCount.dataset.total = String(INITIAL_VISIBLE); }
    }
  }

  function matchesLocation(regionParts, selectedLoc) {
    if (!selectedLoc.length) return true;
    const selectedNorm = selectedLoc.map(norm);
    if (regionParts.some(r => selectedNorm.includes(r))) return true;
    if (selectedNorm.includes("cahul")) {
      if (regionParts.includes("cahul") || regionParts.some(r => CAHUL_GROUP.has(r))) return true;
    }
    return false;
  }

  function getState() {
    return {
      q: norm(searchInput?.value || ""),
      c: norm(codeFilter?.value || ""),
      minP: minPriceInput?.value ? Number(minPriceInput.value) : null,
      maxP: maxPriceInput?.value ? Number(maxPriceInput.value) : null,
      selectedTypes: [...(ddType?.getSelectedValues() ?? []), ...Array.from(document.querySelectorAll('.sub-filter-btn.active[data-filter-type="type"]')).map(b => b.getAttribute('data-filter-val')).filter(v => v !== "")],
      selectedRooms: [...(ddRooms?.getSelectedValues() ?? []), ...Array.from(document.querySelectorAll('.sub-filter-btn.active[data-filter-type="rooms"]')).map(b => b.getAttribute('data-filter-val')).filter(v => v !== "")],
      selectedLoc: ddRaions?.getSelectedValues() ?? [],
    };
  }

  const COMMERCIAL_SUBTYPES_FILTER = new Set(["Restaurant", "Bar", "Oficiu", "Magazin", "Depozit", "Comercial"].map(norm));
  const LAND_SUBTYPES_FILTER = new Set(["Teren pentru construcții", "Teren Agricol", "Terenuri", "Teren"].map(norm));

  function matchesTypeFilter(rawPropType, canonical, selectedTypes) {
    if (!selectedTypes.length) return true;
    const normTypes = selectedTypes.map(norm);
    const nRaw = norm(rawPropType);
    const nCan = norm(canonical);

    if (normTypes.includes(nRaw) || normTypes.includes(nCan)) return true;

    if (normTypes.includes("commercial") && COMMERCIAL_SUBTYPES_FILTER.has(nRaw)) return true;

    if (normTypes.includes("land") && LAND_SUBTYPES_FILTER.has(nRaw)) return true;
    return false;
  }

  function applyFilters() {
    const st = getState();
    const possibleTypes = new Set(), possibleRooms = new Set(), possibleLoc = new Set();
    let shown = 0;

    Array.from(grid.children).forEach(col => {
      const card = col.querySelector(".apart-card");
      if (!card) return;

      const title = card.getAttribute("data-title") || "";
      const code = card.getAttribute("data-code") || "";
      const type = card.getAttribute("data-type") || "";          // canonical
      const rawPropType = card.getAttribute("data-proptype-raw") || ""; // exact stored type
      const rooms = card.getAttribute("data-rooms") || "";
      const priceRaw = card.getAttribute("data-price");
      const price = priceRaw ? Number(priceRaw) : null;
      const regionParts = (card.getAttribute("data-regionparts") || "").split(",").map(x => x.trim()).filter(Boolean);

      const titleOk = !st.q || title.includes(st.q);
      const codeOk = !st.c || code.includes(st.c);
      const typeOk = matchesTypeFilter(rawPropType, type, st.selectedTypes);
      const roomsOk = !st.selectedRooms.length || st.selectedRooms.some(r => {
        const nr = norm(r);
        const nRoom = norm(rooms);
        if (nr === "4+" || nr === "4") return parseInt(nRoom) >= 4;
        return nr === nRoom;
      });
      let priceOk = true;
      if (st.minP !== null && price !== null) priceOk = price >= st.minP;
      if (st.maxP !== null && price !== null) priceOk = priceOk && price <= st.maxP;
      const locOk = matchesLocation(regionParts, st.selectedLoc);

      const ok = titleOk && codeOk && typeOk && roomsOk && priceOk && locOk;
      col.style.display = ok ? "" : "none";

      if (ok) {
        shown++;
        if (rawPropType || type) possibleTypes.add(rawPropType || type);
        if (rooms) possibleRooms.add(rooms);
        regionParts.forEach(r => possibleLoc.add(r));
        if (regionParts.includes("cahul") || regionParts.some(r => CAHUL_GROUP.has(r))) possibleLoc.add("cahul");
      }
    });

    if (resultsCount) resultsCount.dataset.total = shown;
    ddType?.setAvailability(possibleTypes);
    ddRooms?.setAvailability(possibleRooms);
    ddRaions?.setAvailability(possibleLoc);
    isExpanded = false;
    applySort();
  }

  function applySort() {
    if (sortMode === "popular") {
      originalOrder.forEach(el => grid.appendChild(el));
      applyVisibilityLimit();
      return;
    }
    const visible = Array.from(grid.children).filter(c => c.style.display !== "none");
    visible.sort((a, b) => {
      const ap = Number(a.querySelector(".apart-card")?.getAttribute("data-price") || 0);
      const bp = Number(b.querySelector(".apart-card")?.getAttribute("data-price") || 0);
      return sortMode === "asc" ? ap - bp : bp - ap;
    });
    visible.forEach(el => grid.appendChild(el));
    applyVisibilityLimit();
  }

  function resetAll() {
    if (searchInput) searchInput.value = "";
    if (codeFilter) codeFilter.value = "";
    if (minPriceInput) minPriceInput.value = "";
    if (maxPriceInput) maxPriceInput.value = String(maxRange?.max || "");
    if (minRange) minRange.value = "0";
    if (maxRange) maxRange.value = String(maxRange.max || "0");
    ddType?.clearChecks(); ddType?.setAvailability(null);
    ddRooms?.clearChecks(); ddRooms?.setAvailability(null);
    ddRaions?.clearChecks(); ddRaions?.setAvailability(null);
    sortMode = "popular";
    sortItems.forEach(i => i.classList.remove("active"));
    sortItems[0]?.classList.add("active");
    if (sortToggle) {
      sortToggle.classList.remove("open", "active");
      sortToggle.setAttribute("aria-expanded", "false");
      sortToggle.innerHTML = `${t("offers.sort_label")} <span class="caret">▾</span>`;
    }
    applyFilters();
  }

  function setPriceMaxFromData(items) {
    const max = Math.max(0, ...items.map(p => (typeof p.price === "number" ? p.price : 0)));
    const maxVal = max > 0 ? max : 120000;
    [minRange, maxRange].forEach(r => { if (r) { r.min = "0"; r.max = String(maxVal); } });
    if (minRange) minRange.value = "0";
    if (maxRange) maxRange.value = String(maxVal);
    if (minPriceInput) { minPriceInput.min = "0"; minPriceInput.max = String(maxVal); minPriceInput.value = ""; }
    if (maxPriceInput) { maxPriceInput.min = "0"; maxPriceInput.max = String(maxVal); maxPriceInput.value = String(maxVal); }
  }

  function rebuildOptionsFromCards() {
    const cards = Array.from(grid.querySelectorAll(".apart-card"));
    const typesMap = new Map(), roomsMap = new Map(), raionsMap = new Map();

    const COMMERCIAL_SUBTYPES = new Set(["Restaurant", "Bar", "Oficiu", "Magazin", "Depozit"]);
    const LAND_SUBTYPES = new Set(["Teren pentru construcții", "Teren Agricol", "Terenuri", "Teren"]);
    // Generic values that collapse into the single "land" entry — named subtypes stay individual
    const LAND_GENERIC = new Set(["Teren", "Terenuri"]);
    let hasCommercialSub = false;
    let hasLandSub = false;

    cards.forEach(card => {
      const canonical = card.getAttribute("data-type") || "";
      const rawPropType = card.getAttribute("data-proptype-raw") || "";
      if (COMMERCIAL_SUBTYPES.has(rawPropType)) hasCommercialSub = true;
      if (LAND_SUBTYPES.has(rawPropType)) hasLandSub = true;

      if (canonical) {
        // "Teren" / "Terenuri" collapse into the generic "land" entry added below.
        // Named subtypes like "Teren pentru construcții" and "Teren Agricol" stay as individual entries.
        const isGenericLand = canonical === "land" && LAND_GENERIC.has(rawPropType);
        if (!isGenericLand) {
          const displayText = rawPropType
            ? translatePropertyTypeRaw(rawPropType)
            : translateType(canonical);
          typesMap.set(rawPropType || canonical, displayText);
        }
      }

      const roomsValue = card.getAttribute("data-rooms") || "";
      const roomsRaw = (card.getAttribute("data-roomsraw") || "").trim();
      if (roomsValue && roomsRaw) roomsMap.set(roomsValue, roomsRaw);

      const parts = (card.getAttribute("data-regionparts") || "").split(",").map(x => x.trim()).filter(Boolean);
      const regionRaw = card.getAttribute("data-region") || "";

      parts.forEach(pv => {
        if (pv) raionsMap.set(pv, translateLocation(regionRaw) || pv);
      });

      const hasSub = parts.some(p => CAHUL_GROUP.has(p));
      if (hasSub) raionsMap.set("cahul", translateLocation("Cahul"));
    });

    if (hasCommercialSub && !typesMap.has("Comercial") && !typesMap.has("commercial")) {
      typesMap.set("commercial", translateType("commercial"));
    }

    if (hasLandSub && !typesMap.has("Terenuri") && !typesMap.has("land")) {
      typesMap.set("land", translateType("land"));
    }

    const types = Array.from(typesMap.entries())
      .map(([value, text]) => ({ value, text }))
      .sort((a, b) => a.text.localeCompare(b.text, getCurrentLanguage(), { sensitivity: "base" }));

    const rooms = Array.from(roomsMap.entries())
      .map(([value, raw]) => ({ value, raw }))
      .sort((a, b) => {
        const na = Number(a.raw), nb = Number(b.raw);
        if (isFinite(na) && isFinite(nb)) return na - nb;
        return String(a.raw).localeCompare(String(b.raw), getCurrentLanguage(), { sensitivity: "base" });
      })
      .map(x => ({ value: x.value, text: roomsLabel(x.raw) }));

    const raions = Array.from(raionsMap.entries())
      .map(([value, text]) => ({ value, text }))
      .sort((a, b) => a.text.localeCompare(b.text, getCurrentLanguage(), { sensitivity: "base" }));

    ddType?.setOptions(types);
    ddRooms?.setOptions(rooms);
    ddRaions?.setOptions(raions);
  }
  onLanguageChange(() => { if (grid.children.length > 0) rebuildOptionsFromCards(); });

  grid.innerHTML = `<p>${t("offers.loading")}</p>`;
  try {
    const agentId = getQueryParam("agent");
    let items = await fetchProperties(agentId);

    const pageCategory = document.body.getAttribute("data-page-category");
    if (pageCategory) {
      items = items.filter(p => {
        const type = normalizeType(p.propertyType || "");
        const rawPropType = p.propertyType || "";
        const nRaw = norm(rawPropType);
        if (pageCategory === "commercial" && COMMERCIAL_SUBTYPES_FILTER.has(nRaw)) return true;
        if (pageCategory === "land" && LAND_SUBTYPES_FILTER.has(nRaw)) return true;
        return nRaw === pageCategory || type === pageCategory;
      });
    }

    if (!items.length) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fa-solid fa-house-circle-xmark fa-2x mb-3 text-muted"></i>
          <p class="fw-semibold fs-5 mb-0">${t("offers.no_offers")}</p>
        </div>`;
      if (resultsCount) resultsCount.textContent = t("offers.showing", { count: 0 });
      return;
    }

    // Sort newest-first (default "popular" order)
    function tsToMs(v) {
      if (!v) return 0;
      if (typeof v.toMillis === "function") return v.toMillis();
      if (typeof v.seconds === "number") return v.seconds * 1000;
      if (typeof v === "number") return v;
      return 0;
    }
    items.sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));

    grid.innerHTML = "";
    const isDashboard = window.location.pathname.includes("dashboard.html");
    const adminMode = isDashboard && localStorage.getItem("rv_role") === "admin";
    const currentAgent = localStorage.getItem("rv_uid");

    originalOrder = [];
    items.forEach(p => {
      const col = buildCard(p);
      if (isDashboard) {
        let isMine = false;
        if (adminMode) { isMine = true; }
        else if (currentAgent && p.agentId === currentAgent) { isMine = true; }
        if (!isMine) return;
      }
      grid.appendChild(col);
      originalOrder.push(col);
    });

    setPriceMaxFromData(items);
    rebuildOptionsFromCards();
    applyFilters();

    // Attach pill listeners once the grid is populated
    const subFilterBtns = document.querySelectorAll('.sub-filter-btn');
    if (subFilterBtns.length > 0) {
      subFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const fType = btn.getAttribute('data-filter-type');
          const isAll = !btn.getAttribute('data-filter-val');
          
          if (isAll) {
            // Activate "All", deactivate others
            document.querySelectorAll(`.sub-filter-btn[data-filter-type="${fType}"]`).forEach(b => {
               b.classList.toggle('active', b === btn);
            });
          } else {
            // Toggle the clicked button
            const wasActive = btn.classList.contains('active');
            
            // Deactivate all specific buttons
            document.querySelectorAll(`.sub-filter-btn[data-filter-type="${fType}"]:not([data-filter-val=""])`).forEach(b => {
               b.classList.remove('active');
            });
            
            if (!wasActive) {
               btn.classList.add('active');
               const allBtn = document.querySelector(`.sub-filter-btn[data-filter-type="${fType}"][data-filter-val=""]`);
               if (allBtn) allBtn.classList.remove('active');
            } else {
               const allBtn = document.querySelector(`.sub-filter-btn[data-filter-type="${fType}"][data-filter-val=""]`);
               if (allBtn) allBtn.classList.add('active');
            }
          }
          applyFilters();
        });
      });
    }

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="text-danger">${t("offers.error_load")}</p>`;
  }
}


// ── Auth state
async function initAuthState() {
  const dashBtn = document.getElementById("floatingDashBtn");
  const loginBtn = document.getElementById("floatingLoginBtn");
  const mobileDashBtn = document.getElementById("mobileDashBtn");
  const mobileLoginBtn = document.getElementById("mobileLoginBtn");
  if (!dashBtn && !loginBtn) return;

  try {
    const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js");
    const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js");
    const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
    const auth = getAuth(app);
    onAuthStateChanged(auth, user => {
      if (user) {
        dashBtn?.classList.remove("d-none");
        loginBtn?.classList.add("d-none");
        mobileDashBtn?.classList.remove("d-none");
        mobileLoginBtn?.classList.add("d-none");
      } else {
        dashBtn?.classList.add("d-none");
        loginBtn?.classList.remove("d-none");
        mobileDashBtn?.classList.add("d-none");
        mobileLoginBtn?.classList.remove("d-none");
      }
    });
  } catch { }
}


// ── Page translation helpers
function formatMoney(value) {
  const locale = getCurrentLanguage() === "en" ? "en-US" : getCurrentLanguage() === "ru" ? "ru-RU" : "ro-RO";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function initMortgageCalculator() {
  const priceEl = document.getElementById("calcPrice");
  const downEl = document.getElementById("calcDown");
  const rateEl = document.getElementById("calcRate");
  const termEl = document.getElementById("calcTerm");
  const loanEl = document.getElementById("loanAmount");
  const monthlyEl = document.getElementById("monthlyPayment");
  const annualEl = document.getElementById("annualCost");
  if (!priceEl || !downEl || !rateEl || !termEl || !loanEl || !monthlyEl || !annualEl) return;

  const STORAGE_KEY = "reverie_mortgage_calculator";
  const defaults = { price: 70000, down: 15000, rate: 7.5, term: 20 };

  function parseNumber(el, fallback = 0) {
    const value = Number(el.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_e) { }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_e) { }
    return null;
  }

  function updateCalculator() {
    const price = Math.max(0, parseNumber(priceEl, 0));
    const down = Math.min(Math.max(0, parseNumber(downEl, 0)), price);
    const rate = Math.max(0, parseNumber(rateEl, 0));
    const termYears = Math.min(Math.max(1, parseNumber(termEl, 20)), 50);
    const loanAmount = Math.max(0, price - down);
    const months = termYears * 12;
    let monthly = 0;

    if (loanAmount > 0 && months > 0) {
      if (rate > 0) {
        const monthlyRate = rate / 100 / 12;
        monthly = loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
      } else {
        monthly = loanAmount / months;
      }
    }

    loanEl.textContent = formatMoney(loanAmount);
    monthlyEl.textContent = formatMoney(monthly);
    annualEl.textContent = formatMoney(monthly * 12);

    saveState({ price, down, rate, term: termYears });
  }

  const saved = loadState();
  const initial = saved || defaults;
  priceEl.value = initial.price;
  downEl.value = initial.down;
  rateEl.value = initial.rate;
  termEl.value = initial.term;

  [priceEl, downEl, rateEl, termEl].forEach(el => el.addEventListener("input", updateCalculator));
  updateCalculator();
}

function translatePage() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
  });

  const titleKey = document.body.dataset.metaTitle;
  if (titleKey) document.title = t(titleKey);

  const descKey = document.body.dataset.metaDesc;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (descKey && metaDesc) metaDesc.setAttribute("content", t(descKey));
}


// ── Init
document.addEventListener("DOMContentLoaded", async () => {

  await initI18n();

  translatePage();
  onLanguageChange(() => translatePage());

  initHamburger();

  initLangSwitcher();

  initCleanURLs();

  initAuthState();

  renderProjectsSection();
  autoScrollProjects();
  window.addEventListener("resize", () => { renderProjectsSection(); autoScrollProjects(); });
  onLanguageChange(() => { renderProjectsSection(); autoScrollProjects(); });
  window.addEventListener("reverie-projects-updated", () => { renderProjectsSection(); autoScrollProjects(); });

  initMortgageCalculator();

  loadAgentsToContactSection();
  onLanguageChange(() => loadAgentsToContactSection());

  initPropertyGrid();
  initCategoryStats();
});