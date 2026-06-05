// ── Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { initI18n, t, translatePage, onLanguageChange } from "../js/i18n.js";
import { initLangSwitcher } from "../js/langSwitcher.js";


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


// ── i18n init
await initI18n();
translatePage();
initLangSwitcher();

document.title = t("meta.login_title");
onLanguageChange(() => { translatePage(); document.title = t("meta.login_title"); });


// ── DOM refs
const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("errorMsg");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");


// ── Rate limiting
const RATE_KEY    = "reverie_login_attempts";
const RATE_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_MAX    = 5;

// ── Rate limit helpers
function getRateData() {
  try {
    const raw = sessionStorage.getItem(RATE_KEY);
    if (!raw) return { count: 0, since: Date.now() };
    const d = JSON.parse(raw);
    if (Date.now() - d.since > RATE_WINDOW) return { count: 0, since: Date.now() };
    return d;
  } catch { return { count: 0, since: Date.now() }; }
}

function recordAttempt() {
  try {
    const d = getRateData();
    d.count += 1;
    sessionStorage.setItem(RATE_KEY, JSON.stringify(d));
    return d.count;
  } catch { return 0; }
}

function resetRateLimit() {
  try { sessionStorage.removeItem(RATE_KEY); } catch {}
}

function isRateLimited() {
  return getRateData().count >= RATE_MAX;
}


// ── UI helpers
function showError(text) {
  errorMsg.textContent = text;
  errorMsg.style.display = "block";
  errorMsg.style.animation = "none";
  requestAnimationFrame(() => { errorMsg.style.animation = "shake 0.3s ease"; });
}

function hideError() { errorMsg.textContent = ""; errorMsg.style.display = "none"; }

function setLoading(v) {
  loginBtn.disabled = v;
  loginBtn.textContent = v ? t("login.btn_loading") : t("login.btn");
}


// ── Auth redirect by role
async function redirectByRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) { showError(t("login.err_no_profile")); return; }
  sessionStorage.setItem("reverie_role", (snap.data().role || "").toLowerCase());
  sessionStorage.setItem("reverie_uid", uid);
  window.location.href = "../pages/dashboard.html#rv17";
}

// ── Login handler
async function doLogin() {
  hideError();

  if (isRateLimited()) {
    showError(t("login.err_rate_limit"));
    return;
  }

  const email = (emailEl.value || "").trim();
  const pass = passEl.value || "";
  if (!email || !pass) { showError(t("login.err_empty")); return; }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(t("login.err_empty")); return; }

  try {
    setLoading(true);
    const c = await signInWithEmailAndPassword(auth, email, pass);
    resetRateLimit();
    await redirectByRole(c.user.uid);
  } catch {
    recordAttempt();
    showError(t("login.err_wrong"));
  }
  finally { setLoading(false); }
}

// ── Event listeners
loginBtn.addEventListener("click", doLogin);
document.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
onAuthStateChanged(auth, async u => { if (u) try { await redirectByRole(u.uid); } catch { } });