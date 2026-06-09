/**
 * categoryStats.js
 * Fetches all active properties from Firestore and updates
 * the category counter elements on the homepage.
 */

import { normalizeType, normalizeStatus } from "./i18n.js";

const FB_CONFIG = {
  apiKey: "AIzaSyCqXpk1NuWfiq6QjHViK80HLl9zwFVGNGo",
  authDomain: "reverie-c861c.firebaseapp.com",
  projectId: "reverie-c861c",
  storageBucket: "reverie-c861c.firebasestorage.app",
  messagingSenderId: "122254003952",
  appId: "1:122254003952:web:67dea6de1f5eb97a9b7c35",
};

// Map canonical type → DOM element id
const COUNT_IDS = {
  apartment:  "countApartments",
  house:      "countHouses",
  land:       "countLands",
  commercial: "countCommercial",
};

let _fetched = false;

export async function initCategoryStats() {
  // Only run if the section exists on this page
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;

  // Set skeleton animation
  Object.values(COUNT_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "—";
  });

  try {
    if (_fetched) return;
    _fetched = true;

    const [appMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js"),
    ]);
    const { initializeApp, getApps, getApp } = appMod;
    const { getFirestore, collection, getDocs } = fsMod;

    const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, "properties"));

    const counts = { apartment: 0, house: 0, land: 0, commercial: 0 };

    snap.forEach(doc => {
      const data = doc.data();
      const status = normalizeStatus(data.status || data.state || data.availability || "active");
      if (status !== "active") return; // count only active listings

      const canonical = normalizeType(data.propertyType || "");
      if (canonical in counts) counts[canonical]++;
    });

    // Animate counter update
    Object.entries(COUNT_IDS).forEach(([type, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      animateCount(el, counts[type] || 0);
    });

  } catch (err) {
    console.warn("[categoryStats] Could not load counts:", err);
    Object.values(COUNT_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "0";
    });
  }
}

function animateCount(el, target) {
  if (target === 0) { el.textContent = "0"; return; }
  const duration = 900;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}
