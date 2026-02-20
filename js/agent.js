// js/script.js

(() => {
  "use strict";

  /* =========================
     Helpers
  ========================= */
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(s) {
    return String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseRegionParts(region) {
    return String(region ?? "")
      .split(",")
      .map((x) => norm(x))
      .filter(Boolean);
  }

  function splitList(raw) {
    return String(raw ?? "")
      .split(/[,|;]/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function roomsLabel(nStr) {
    const n = Number(String(nStr).trim());
    if (!Number.isFinite(n) || n <= 0) return String(nStr).trim();
    return `${n} ${n === 1 ? "cameră" : "camere"}`;
  }

  // ✅ query param helper (agent.html?agent=UID)
  function getQueryParam(key) {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch {
      return null;
    }
  }

  /* =========================
     Status helpers (public overlay)
  ========================= */
  function normalizeStatus(s) {
    const v = String(s ?? "").toLowerCase().trim();
    if (["active", "stopped", "sold", "rented"].includes(v)) return v;
    return "active";
  }

  function statusOverlayText(status) {
    const st = normalizeStatus(status);
    if (st === "stopped") return "STOPAT";
    if (st === "sold") return "VÂNDUT";
    if (st === "rented") return "ÎNCHIRIAT";
    return ""; // active -> fără overlay
  }

  /* =========================
     Mobile hamburger
  ========================= */
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

  /* =========================
     Custom dropdown (DINAMIC)
  ========================= */
  function createDynamicDropdown(dropdownId, onChange) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return null;

    const toggle = dropdown.querySelector(".dropdown-toggle");
    const menu = dropdown.querySelector(".dropdown-menu");
    const searchInput = dropdown.querySelector(".dropdown-search-input");
    const label = dropdown.querySelector(".dropdown-label");
    const optionsBox = dropdown.querySelector(".dropdown-options");

    if (!toggle || !menu || !label || !optionsBox) return null;

    let options = []; // [{value,text,cbEl,wrapEl}]

    const close = () => {
      menu.classList.remove("open");
      toggle.classList.remove("open");
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      toggle.classList.toggle("open", open);
      if (open && searchInput) searchInput.focus();
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) close();
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const q = norm(searchInput.value);
        options.forEach((o) => {
          const txt = norm(o.text);
          o.wrapEl.style.display = txt.includes(q) ? "" : "none";
        });
      });
    }

    function updateLabel() {
      const checked = options.filter((o) => o.cbEl.checked);
      if (checked.length === 0) {
        label.textContent = "Toate";
        label.classList.remove("has-selection");
        return;
      }

      label.innerHTML = "";
      label.classList.add("has-selection");

      checked.forEach((o) => {
        const tag = document.createElement("span");
        tag.className = "selected-tag";
        tag.textContent = o.text;

        const x = document.createElement("span");
        x.className = "remove-tag";
        x.textContent = "✕";
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          o.cbEl.checked = false;
          updateLabel();
          onChange?.();
        });

        tag.appendChild(x);
        label.appendChild(tag);
      });
    }

    function setOptions(list, sortFn) {
      optionsBox.innerHTML = "";

      const safe = (list || [])
        .filter((x) => x && x.value !== undefined && x.value !== null && String(x.value).trim() !== "")
        .map((x) => ({ value: String(x.value), text: String(x.text ?? x.value) }));

      if (sortFn) safe.sort(sortFn);
      else safe.sort((a, b) => a.text.localeCompare(b.text, "ro", { sensitivity: "base" }));

      options = safe.map(({ value, text }) => {
        const wrap = document.createElement("label");
        wrap.className = "dropdown-option";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = value;

        cb.addEventListener("change", () => {
          updateLabel();
          onChange?.();
        });

        wrap.appendChild(cb);
        wrap.append(" " + text);

        optionsBox.appendChild(wrap);

        return { value, text, cbEl: cb, wrapEl: wrap };
      });

      updateLabel();
    }

    function getSelectedValues() {
      return options.filter((o) => o.cbEl.checked).map((o) => o.value);
    }

    function clearChecks() {
      options.forEach((o) => (o.cbEl.checked = false));
      updateLabel();
    }

    function setAvailability(allowedSet) {
      options.forEach((o) => {
        const allowed = !allowedSet || allowedSet.has(o.value);
        o.wrapEl.style.display = allowed ? "" : "none";
        if (!allowed && o.cbEl.checked) o.cbEl.checked = false;
      });
      updateLabel();
    }

    return { setOptions, getSelectedValues, clearChecks, setAvailability };
  }

  /* =========================
     Firebase (single init) - dynamic import
  ========================= */
  const firebaseConfig = {
    apiKey: "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
    authDomain: "reverie-c861c.firebaseapp.com",
    projectId: "reverie-c861c",
    storageBucket: "reverie-c861c.firebasestorage.app",
    messagingSenderId: "122254003952",
    appId: "1:122254003952:web:67dea6de1f5eb97a9b7c35",
    measurementId: "G-3RW7VCE2RX",
  };

  let _fb = null; // cache module refs + db
  async function getFirebase() {
    if (_fb) return _fb;

    const appMod = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");

    const { initializeApp, getApps, getApp } = appMod;
    const { getFirestore } = fsMod;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    _fb = { appMod, fsMod, db };
    return _fb;
  }

  // acceptă agentId (opțional)
  async function fetchProperties(agentId = null) {
    const { fsMod, db } = await getFirebase();
    const { collection, getDocs, query, where } = fsMod;

    const colRef = collection(db, "properties");

    let snap;
    if (agentId) {
      snap = await getDocs(query(colRef, where("agentId", "==", agentId)));
    } else {
      snap = await getDocs(colRef);
    }

    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    return items;
  }

  async function fetchAgents() {
    const { fsMod, db } = await getFirebase();
    const { collection, getDocs, query, where } = fsMod;

    const qy = query(collection(db, "users"), where("role", "==", "agent"));
    const snap = await getDocs(qy);

    const agents = [];
    snap.forEach((d) => agents.push({ uid: d.id, ...d.data() }));
    return agents;
  }

  /* =========================
     Contacte (agents from Firestore)
  ========================= */
  async function loadAgentsToContactSection() {
    const row = document.getElementById("agentsRow");
    if (!row) return;

    row.innerHTML = `<div class="col-12"><div class="text-muted">Se încarcă agenții...</div></div>`;

    try {
      const agents = await fetchAgents();

      agents.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "ro", { sensitivity: "base" })
      );

      if (!agents.length) {
        row.innerHTML = `<div class="col-12"><div class="text-muted">Nu există agenți momentan.</div></div>`;
        return;
      }

      row.innerHTML = "";

      agents.forEach((a, idx) => {
        const name = (a.name || "Agent").trim();
        const phone = String(a.phone || "").trim();
        const email = String(a.email || "").trim();

        const photo =
          a.photoUrl || a.photo || a.avatar || a.image || (idx % 2 === 0 ? "images/agent1.png" : "images/agent2.png");

        const col = document.createElement("div");
        col.className = "col-md-6";

        col.innerHTML = `
          <a href="pages/agent.html?agent=${encodeURIComponent(a.uid)}" class="text-decoration-none text-reset">
            <div class="agent-card p-4 d-flex align-items-center gap-3">
              <div class="agent-photo" style="background-image:url('${esc(photo)}')" aria-hidden="true"></div>
              <div class="flex-fill">
                <h5 class="mb-1">${esc(name)}</h5>
                <div class="small text-muted mb-2">Agent Imobiliar</div>

                ${phone ? `
                  <div class="mb-2">
                    <a href="tel:${esc(phone)}" class="agent-phone">${esc(phone)}</a>
                  </div>
                ` : ""}

                ${email ? `
                  <div>
                    <a href="mailto:${esc(email)}" class="agent-email">${esc(email)}</a>
                  </div>
                ` : ""}

                <div class="mt-3">
                  ${phone ? `<a href="tel:${esc(phone)}" class="btn btn-danger btn-sm me-2">Sună acum</a>` : ""}
                </div>
              </div>
            </div>
          </a>
        `;

        row.appendChild(col);
      });
    } catch (e) {
      console.error("Agents load error:", e);
      row.innerHTML = `<div class="col-12"><div class="text-danger">Eroare la încărcarea agenților.</div></div>`;
    }
  }

  /* =========================
     Main (properties page logic)
  ========================= */
  document.addEventListener("DOMContentLoaded", async () => {
    initHamburger();

    // 1) Contacte (if exists on this page)
    loadAgentsToContactSection();

    // 2) Properties grid logic (only if grid exists)
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
    let sortMode = "popular";

    const CAHUL_GROUP = new Set(
      [
        "focșa",
        "micro 15",
        "lapaevca",
        "centru",
        "lipovanca",
        "ghidro",
        "autogara",
        "spirin",
        "valincea",
        "centru-str.pușkin",
        "centru-str.creangă",
        "gebhardt",
        "centru-baia publică",
        "jubileu",
        "centru-șurin market",
        "calea ferată",
        "fabrica de vinuri",
        "pmk 10",
      ].map(norm)
    );

    const onFilterChange = debounce(applyFilters, 120);
    const ddType = createDynamicDropdown("typeDropdown", onFilterChange);
    const ddRooms = createDynamicDropdown("dataRooms", onFilterChange);
    const ddRaions = createDynamicDropdown("raionsDropdown", onFilterChange);

    let originalOrder = [];

    /* =========================
       "Vezi toate" / "Ascunde toate" button
    ========================= */
    const INITIAL_VISIBLE = 6;
    let isExpanded = false;

    // Injectăm stilurile necesare
    const styleEl = document.createElement("style");
    styleEl.textContent = ".apart-hidden { display: none !important; } .toggle-all-hidden { display: none !important; }";
    document.head.appendChild(styleEl);

    // Creăm butonul și îl inserăm după grid
    const toggleAllBtn = document.createElement("button");
    toggleAllBtn.className = "btn btn-outline-danger mt-4 d-block mx-auto toggle-all-btn toggle-all-hidden";
    grid.insertAdjacentElement("afterend", toggleAllBtn);

    toggleAllBtn.addEventListener("click", () => {
      isExpanded = !isExpanded;
      applyVisibilityLimit();
    });

    // Element pentru mesajul de "fără rezultate" din filtre
    let noFilterResultsEl = null;

    function applyVisibilityLimit() {
      const allCols = Array.from(grid.children).filter((col) => !col.classList.contains("no-results-msg"));

      // Resetăm apart-hidden de pe toate înainte de orice
      allCols.forEach((col) => col.classList.remove("apart-hidden"));

      // Numărăm doar ce e ascuns de filtre (style.display = "none")
      const visibleCols = allCols.filter((col) => col.style.display !== "none");
      const total = visibleCols.length;

      // Gestionăm mesajul "fără rezultate la filtre"
      if (total === 0 && allCols.length > 0) {
        if (!noFilterResultsEl) {
          noFilterResultsEl = document.createElement("div");
          noFilterResultsEl.className = "no-results-msg col-12 text-center py-5";
          noFilterResultsEl.innerHTML = `
            <i class="fa-solid fa-magnifying-glass fa-2x mb-3 text-muted"></i>
            <p class="fw-semibold fs-5 mb-1">Nu a fost găsit nici un rezultat care să corespundă filtrelor corespunzătoare</p>
            <p class="text-muted">Te rugăm să modifici sau să resetezi filtrele</p>
          `;
          grid.appendChild(noFilterResultsEl);
        }
        noFilterResultsEl.style.display = "";
        toggleAllBtn.classList.add("toggle-all-hidden");
        if (resultsCount) resultsCount.textContent = `Arată: 0`;
        return;
      } else if (noFilterResultsEl) {
        noFilterResultsEl.style.display = "none";
      }

      if (total <= INITIAL_VISIBLE) {
        toggleAllBtn.classList.add("toggle-all-hidden");
        if (resultsCount) resultsCount.textContent = `Arată: ${total}`;
        return;
      }

      toggleAllBtn.classList.remove("toggle-all-hidden");

      if (isExpanded) {
        toggleAllBtn.textContent = "Ascunde toate";
        if (resultsCount) resultsCount.textContent = `Arată: ${total}`;
      } else {
        visibleCols.forEach((col, i) => {
          if (i >= INITIAL_VISIBLE) col.classList.add("apart-hidden");
        });
        toggleAllBtn.textContent = "Vezi toate";
        if (resultsCount) resultsCount.textContent = `Arată: ${INITIAL_VISIBLE}`;
      }
    }

    // ✅ watermark source (poți schimba dacă vrei alt logo)
    const WATERMARK_SRC = "../images/wmark.png";

    function buildCard(p) {
      const title = String(p.title || "Fără titlu");

      const price = typeof p.price === "number" ? p.price : null;
      const code = String(p.code || p.id || "");

      const roomsRaw = p.rooms === 0 || p.rooms ? String(p.rooms) : "";
      const roomsValue = norm(roomsRaw);

      const propertyTypeRaw = String(p.propertyType || "");
      const typeValue = norm(propertyTypeRaw) || "";
      const typeText = propertyTypeRaw.trim() || "";

      const regionRaw = String(p.region || "");
      const regionParts = parseRegionParts(regionRaw);

      const img = String(p.mainImage || (Array.isArray(p.images) ? p.images[0] : "") || "../images/wmark.png");

      // ✅ NEW: status + overlay text
      const status = normalizeStatus(p.status);
      const overlayTxt = statusOverlayText(status);

      const col = document.createElement("div");
      col.className = "col-12 col-sm-6 col-md-4";
      col.dataset.id = p.id;

      // ✅ IMPORTANT: articolul are acum .prop-card + data-status
      col.innerHTML = `
        <article class="card apart-card prop-card"
          data-id="${esc(p.id)}"
          data-title="${esc(title)}"
          data-price="${price ?? ""}"
          data-code="${esc(code)}"
          data-rooms="${esc(roomsValue)}"
          data-roomsraw="${esc(roomsRaw)}"
          data-type="${esc(typeValue)}"
          data-typename="${esc(typeText)}"
          data-region="${esc(regionRaw)}"
          data-regionparts="${esc(regionParts.join(","))}"
          data-status="${esc(status)}"
        >
          <div class="prop-img-wrap">
            <img src="${esc(img)}" class="card-img-top" alt="${esc(title)}">

            <div class="prop-wmark" aria-hidden="true">
              <img src="${esc(WATERMARK_SRC)}" alt="">
            </div>

            <div class="prop-status-overlay" aria-hidden="true">
              <span>${esc(overlayTxt)}</span>
            </div>
          </div>

          <div class="card-body">
            <h5 class="card-title">${esc(title)}</h5>

            <p class="mb-1 small text-muted">Preț: €${price ?? "-"}</p>
            ${roomsRaw ? `<p class="mb-1 small text-muted">Camere: ${esc(roomsRaw)}</p>` : ""}

            <div class="d-flex gap-2 flex-wrap mb-2">
              ${regionRaw ? `<span class="badge raion-badge">${esc(regionRaw)}</span>` : ""}
              ${typeText ? `<span class="badge raion-badge">${esc(typeText)}</span>` : ""}
            </div>

            <div class="d-flex gap-2">
              <a href="property.html?id=${encodeURIComponent(p.id)}" class="btn btn-sm btn-outline-danger">Vezi Detalii</a>
            </div>

            <div class="apart-code">Cod: ${esc(code)}</div>
          </div>
        </article>
      `;

      return col;
    }

    function renderGrid(items) {
      grid.innerHTML = "";
      items.forEach((p) => grid.appendChild(buildCard(p)));
      originalOrder = Array.from(grid.children);
    }

    function setPriceMaxFromData(items) {
      const max = Math.max(0, ...items.map((p) => (typeof p.price === "number" ? p.price : 0)));
      const maxVal = max > 0 ? max : 120000;

      if (minRange) {
        minRange.min = "0";
        minRange.max = String(maxVal);
        minRange.value = "0";
      }
      if (maxRange) {
        maxRange.min = "0";
        maxRange.max = String(maxVal);
        maxRange.value = String(maxVal);
      }

      if (minPriceInput) {
        minPriceInput.min = "0";
        minPriceInput.max = String(maxVal);
        minPriceInput.value = "";
      }
      if (maxPriceInput) {
        maxPriceInput.min = "0";
        maxPriceInput.max = String(maxVal);
        maxPriceInput.value = String(maxVal);
      }
    }

    function rebuildOptionsFromCards() {
      const cards = Array.from(grid.querySelectorAll(".apart-card"));

      const typesMap = new Map();
      const roomsMap = new Map();
      const raionsMap = new Map();

      cards.forEach((card) => {
        const tv = card.getAttribute("data-type") || "";
        const tn = card.getAttribute("data-typename") || "";
        if (tv) typesMap.set(tv, tn || tv);

        const roomsValue = card.getAttribute("data-rooms") || "";
        const roomsRaw = (card.getAttribute("data-roomsraw") || "").trim();
        if (roomsValue && roomsRaw) roomsMap.set(roomsValue, roomsRaw);

        const parts = (card.getAttribute("data-regionparts") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

        const regionRaw = String(card.getAttribute("data-region") || "");
        const prettyParts = splitList(regionRaw);

        if (prettyParts.length === parts.length) {
          for (let i = 0; i < parts.length; i++) {
            const pv = parts[i];
            const pt = prettyParts[i] || pv;
            if (pv) raionsMap.set(pv, pt);
          }
        } else {
          parts.forEach((pv) => pv && raionsMap.set(pv, pv));
        }

        const hasSub = parts.some((p) => CAHUL_GROUP.has(p));
        if (hasSub) raionsMap.set("cahul", "Cahul");
      });

      const types = Array.from(typesMap.entries())
        .map(([value, text]) => ({ value, text }))
        .sort((a, b) => a.text.localeCompare(b.text, "ro", { sensitivity: "base" }));

      const rooms = Array.from(roomsMap.entries())
        .map(([value, raw]) => ({ value, raw }))
        .sort((a, b) => {
          const na = Number(a.raw),
            nb = Number(b.raw);
          const aNum = Number.isFinite(na),
            bNum = Number.isFinite(nb);
          if (aNum && bNum) return na - nb;
          if (aNum && !bNum) return -1;
          if (!aNum && bNum) return 1;
          return String(a.raw).localeCompare(String(b.raw), "ro", { sensitivity: "base" });
        })
        .map((x) => ({ value: x.value, text: roomsLabel(x.raw) }));

      const raions = Array.from(raionsMap.entries())
        .map(([value, text]) => ({ value, text }))
        .sort((a, b) => a.text.localeCompare(b.text, "ro", { sensitivity: "base" }));

      ddType?.setOptions(types);
      ddRooms?.setOptions(rooms);
      ddRaions?.setOptions(raions);
    }

    function getState() {
      const q = norm(searchInput?.value || "");
      const c = norm(codeFilter?.value || "");

      const minP = minPriceInput?.value ? Number(minPriceInput.value) : null;
      const maxP = maxPriceInput?.value ? Number(maxPriceInput.value) : null;

      const selectedTypes = ddType ? ddType.getSelectedValues() : [];
      const selectedRooms = ddRooms ? ddRooms.getSelectedValues() : [];
      const selectedLoc = ddRaions ? ddRaions.getSelectedValues() : [];

      return { q, c, minP, maxP, selectedTypes, selectedRooms, selectedLoc };
    }

    function matchesLocation(regionParts, selectedLoc) {
      if (selectedLoc.length === 0) return true;

      const selectedNorm = selectedLoc.map(norm);
      const hasDirect = regionParts.some((r) => selectedNorm.includes(r));
      if (hasDirect) return true;

      const wantCahul = selectedNorm.includes("cahul");
      if (wantCahul) {
        const hasCahul = regionParts.includes("cahul");
        const hasSub = regionParts.some((r) => CAHUL_GROUP.has(r));
        if (hasCahul || hasSub) return true;
      }
      return false;
    }

    function applyFilters() {
      const st = getState();

      const possibleTypes = new Set();
      const possibleRooms = new Set();
      const possibleLoc = new Set();

      let shown = 0;

      Array.from(grid.children).forEach((col) => {
        const card = col.querySelector(".apart-card");
        if (!card) return;

        const title = norm(card.getAttribute("data-title") || "");
        const code = norm(card.getAttribute("data-code") || "");
        const type = card.getAttribute("data-type") || "";
        const roomsValue = card.getAttribute("data-rooms") || "";

        const priceRaw = card.getAttribute("data-price");
        const price = priceRaw ? Number(priceRaw) : null;

        const regionParts = (card.getAttribute("data-regionparts") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

        const titleOk = !st.q || title.includes(st.q);
        const codeOk = !st.c || code.includes(st.c);
        const typeOk = st.selectedTypes.length === 0 || st.selectedTypes.includes(type);
        const roomsOk = st.selectedRooms.length === 0 || st.selectedRooms.includes(roomsValue);

        let priceOk = true;
        if (st.minP !== null && price !== null) priceOk = price >= st.minP;
        if (st.maxP !== null && price !== null) priceOk = priceOk && price <= st.maxP;

        const locOk = matchesLocation(regionParts, st.selectedLoc);

        const ok = titleOk && codeOk && typeOk && roomsOk && priceOk && locOk;
        col.style.display = ok ? "" : "none";

        if (ok) {
          shown++;
          if (type) possibleTypes.add(type);
          if (roomsValue) possibleRooms.add(roomsValue);

          regionParts.forEach((r) => possibleLoc.add(r));
          if (regionParts.includes("cahul") || regionParts.some((r) => CAHUL_GROUP.has(r))) possibleLoc.add("cahul");
        }
      });

      // resultsCount va fi actualizat de applyVisibilityLimit() după ce se stabilește câte sunt afișate efectiv
      if (resultsCount) resultsCount.dataset.total = shown;

      ddType?.setAvailability(possibleTypes);
      ddRooms?.setAvailability(possibleRooms);
      ddRaions?.setAvailability(possibleLoc);

      // La fiecare schimbare de filtru resetăm starea de expandare
      isExpanded = false;

      applySort();
    }

    function applySort() {
      // ai zis că nu ai nevoie de sortări, dar UI există -> păstrăm logică minimă
      if (sortMode === "popular") {
        originalOrder.forEach((el) => grid.appendChild(el));
        applyVisibilityLimit();
        return;
      }

      const visible = Array.from(grid.children).filter((col) => col.style.display !== "none");

      visible.sort((a, b) => {
        const aCard = a.querySelector(".apart-card");
        const bCard = b.querySelector(".apart-card");
        const ap = aCard ? Number(aCard.getAttribute("data-price") || 0) : 0;
        const bp = bCard ? Number(bCard.getAttribute("data-price") || 0) : 0;
        return sortMode === "asc" ? ap - bp : bp - ap;
      });

      visible.forEach((el) => grid.appendChild(el));
      applyVisibilityLimit();
    }

    function resetAll() {
      if (searchInput) searchInput.value = "";
      if (codeFilter) codeFilter.value = "";

      if (minPriceInput) minPriceInput.value = "";
      if (maxPriceInput) maxPriceInput.value = String(maxRange?.max || "");

      if (minRange) minRange.value = "0";
      if (maxRange) maxRange.value = String(maxRange.max || "0");

      ddType?.clearChecks();
      ddRooms?.clearChecks();
      ddRaions?.clearChecks();

      ddType?.setAvailability(null);
      ddRooms?.setAvailability(null);
      ddRaions?.setAvailability(null);

      sortMode = "popular";
      sortItems.forEach((it) => it.classList.remove("active"));
      sortItems[0]?.classList.add("active");
      if (sortToggle) {
        sortToggle.classList.remove("open");
        sortToggle.classList.remove("active");
        sortToggle.setAttribute("aria-expanded", "false");
        sortToggle.innerHTML = `Sortează <span class="caret">▾</span>`;
      }

      applyFilters();
    }

    // listeners
    if (searchInput) searchInput.addEventListener("input", debounce(applyFilters, 150));
    if (codeFilter) codeFilter.addEventListener("input", debounce(applyFilters, 150));

    if (minRange && maxRange) {
      function updateRangeZIndex() {
        const minVal = Number(minRange.value);
        const maxVal = Number(maxRange.value);
        const total = Number(minRange.max) - Number(minRange.min) || 1;
        const minPct = (minVal - Number(minRange.min)) / total;
        const maxPct = (maxVal - Number(minRange.min)) / total;
        // maxRange la valori mici (stanga) -> maxRange deasupra
        // minRange la valori mari (dreapta) -> minRange deasupra
        if (minPct > 0.5) {
          // minRange e in jumatatea dreapta -> el ia prioritate
          minRange.style.zIndex = "5";
          maxRange.style.zIndex = "4";
        } else {
          // maxRange e in jumatatea stanga sau ambii la inceput -> maxRange ia prioritate
          minRange.style.zIndex = "4";
          maxRange.style.zIndex = "5";
        }
      }

      minRange.addEventListener("input", () => {
        let minV = Number(minRange.value);
        let maxV = Number(maxRange.value);
        if (minV > maxV) {
          minV = maxV;
          minRange.value = String(minV);
        }
        if (minPriceInput) minPriceInput.value = String(minV);
        updateRangeZIndex();
        applyFilters();
      });

      maxRange.addEventListener("input", () => {
        let minV = Number(minRange.value);
        let maxV = Number(maxRange.value);
        if (maxV < minV) {
          maxV = minV;
          maxRange.value = String(maxV);
        }
        if (maxPriceInput) maxPriceInput.value = String(maxV);
        updateRangeZIndex();
        applyFilters();
      });
    }

    if (minPriceInput) {
      minPriceInput.addEventListener("change", () => {
        let v = Number(minPriceInput.value || 0);
        if (!Number.isFinite(v) || v < 0) v = 0;
        if (minRange) minRange.value = String(v);
        applyFilters();
      });
    }

    if (maxPriceInput) {
      maxPriceInput.addEventListener("change", () => {
        let v = Number(maxPriceInput.value || 0);
        const maxLim = Number(maxRange?.max || 120000);
        if (!Number.isFinite(v) || v <= 0) v = maxLim;
        v = Math.min(v, maxLim);
        if (maxRange) maxRange.value = String(v);
        applyFilters();
      });
    }

    if (clearBtn) clearBtn.addEventListener("click", resetAll);

    if (sortToggle && sortMenu) {
      sortToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = !sortMenu.classList.contains("open");
        sortMenu.classList.toggle("open", open);
        sortToggle.classList.toggle("open", open);
        sortToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });

      document.addEventListener("click", (e) => {
        if (!sortToggle.contains(e.target) && !sortMenu.contains(e.target)) {
          sortMenu.classList.remove("open");
          sortToggle.classList.remove("open");
          sortToggle.setAttribute("aria-expanded", "false");
        }
      });

      sortItems.forEach((item) => {
        item.addEventListener("click", () => {
          sortItems.forEach((i) => i.classList.remove("active"));
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

    // Toggle filters visibility (Mobile/Tablet)
    const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
    const filtersCard = document.getElementById("filtersCard");

    if (toggleFiltersBtn && filtersCard) {
      toggleFiltersBtn.addEventListener("click", () => {
        filtersCard.classList.toggle("show");
        const isShown = filtersCard.classList.contains("show");
        toggleFiltersBtn.innerHTML = isShown
          ? '<i class="fa-solid fa-filter-circle-xmark me-2"></i> Ascunde Filtrele'
          : '<i class="fa-solid fa-filter me-2"></i> Arată Filtrele';
      });
    }

    /* =========================
       Load properties
    ========================= */
    grid.innerHTML = `<p>Se încarcă...</p>`;
    try {
      // dacă suntem pe agent.html?agent=UID => filtrăm
      const agentId = getQueryParam("agent");

      const items = await fetchProperties(agentId);

      if (!items.length) {
        if (agentId) {
          grid.innerHTML = `
            <div class="col-12 text-center py-5">
              <i class="fa-solid fa-user-slash fa-2x mb-3 text-muted"></i>
              <p class="fw-semibold fs-5 mb-0">Din păcate acest agent nu are oferte disponibile</p>
            </div>`;
        } else {
          grid.innerHTML = `
            <div class="col-12 text-center py-5">
              <i class="fa-solid fa-house-circle-xmark fa-2x mb-3 text-muted"></i>
              <p class="fw-semibold fs-5 mb-0">Din păcate momentan nu avem oferte disponibile</p>
            </div>`;
        }
        if (resultsCount) resultsCount.textContent = "Arată: 0";
        return;
      }

      renderGrid(items);
      setPriceMaxFromData(items);
      rebuildOptionsFromCards();
      applyFilters();
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<p>Eroare la încărcare din Firestore.</p>`;
    }
  });
})();