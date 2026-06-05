// ── Imports
import { setLanguage, getCurrentLanguage, onLanguageChange, SUPPORTED_LANGS } from "./i18n.js";

// ── Labels & config
const LANG_LABELS = { ro: "RO", ru: "RU", en: "EN" };
const LANG_ARIA   = { ro: "Română",  ru: "Русский", en: "English" };

// ── Build switcher element
function _createSwitcherGroup(isMobile = false) {
  const wrap = document.createElement("div");
  wrap.className = isMobile ? "lang-switcher lang-switcher--mobile" : "lang-switcher lang-switcher--desktop";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Language selector");

  SUPPORTED_LANGS.forEach(lang => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-btn";
    btn.dataset.lang = lang;
    btn.textContent = LANG_LABELS[lang];
    btn.setAttribute("aria-label", LANG_ARIA[lang]);
    btn.setAttribute("title", LANG_ARIA[lang]);

    if (lang === getCurrentLanguage()) btn.classList.add("active");

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await setLanguage(lang);
    });

    wrap.appendChild(btn);
  });

  return wrap;
}

// ── Sync active button state
function _syncActive(lang) {
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
}

// ── Inject switchers into DOM
export function initLangSwitcher() {

  const navActions = document.querySelector(".nav-actions");
  if (navActions && !navActions.querySelector(".lang-switcher--desktop")) {
    const apelBtn = navActions.querySelector(".btn-apel");
    const desktopSwitcher = _createSwitcherGroup(false);
    if (apelBtn) navActions.insertBefore(desktopSwitcher, apelBtn);
    else navActions.prepend(desktopSwitcher);
  }

  const mobileMenu = document.querySelector(".mobile-menu-content");
  if (mobileMenu && !mobileMenu.querySelector(".lang-switcher--mobile")) {
    const mobileSwitcher = _createSwitcherGroup(true);
    const callBtn = mobileMenu.querySelector(".mobile-menu-call");
    if (callBtn) mobileMenu.insertBefore(mobileSwitcher, callBtn);
    else mobileMenu.appendChild(mobileSwitcher);
  }

  const sidebarAnchor = document.querySelector(".sidebar-lang-anchor");
  if (sidebarAnchor && !sidebarAnchor.querySelector(".lang-switcher")) {
    const sidebarSwitcher = _createSwitcherGroup(false);
    sidebarSwitcher.classList.add("lang-switcher--sidebar");
    sidebarAnchor.appendChild(sidebarSwitcher);
  }

  onLanguageChange(_syncActive);
}