import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { initTheme, toggleTheme } from "./ui.js";

// --- CONFIG & CONSTANTS ---
export const CODE_VERSION = "V08-RoleDB"; // Updated version name

// Config ที่ user กำหนด
export const firebaseConfig = {
  apiKey: "AIzaSyAHMYpNA5Kh4uPYogaBzmNZssoQ6p53ybM",
  authDomain: "studio-3431359559-3d25c.firebaseapp.com",
  projectId: "studio-3431359559-3d25c",
  storageBucket: "studio-3431359559-3d25c.firebasestorage.app",
  messagingSenderId: "355345619214",
  appId: "1:355345619214:web:6c23fcb229d42c13ff5f5f"
};

export const KPI_DEFAULT_PASSWORD = "NewBI#2020";
export const DAILY_KPI_RANGE = "A1:Z23";
export const DAILY_COLLECTION_ROOT = "stores";
export const USERS_COLLECTION_ROOT = "users"; // NEW: Users collection
export const PUBLIC_COLLECTION_PATH = `/artifacts/default-app-id/public/data/kpi_reports`;

// --- SHARED STATE ---
export const appState = {
  role: null,
  displayName: null,
  username: null, // NEW: Keep track of username
  firebaseReady: false,
  uid: null,
  collections: {
    dailySub: "daily_kpi",
    weeklySub: "weekly_kpi",
    recapSub: "recap_kpi",
  },
  files: {
    daily: [],
    weekly: [],
    recap: [],
  },
};

// --- FIREBASE INSTANCES ---
export let app;
export let auth;
export let db;
export let storage;

// --- LOGGING ---
export function pushLog(message) {
  const logEl = document.getElementById("consoleLog");
  if (!logEl) return;
  const ts = new Date().toLocaleTimeString();
  const line = "[" + ts + "] " + message;
  if (logEl.textContent) {
    logEl.textContent += "\n" + line;
  } else {
    logEl.textContent = line;
  }
  const lines = logEl.textContent.split("\n");
  const maxLines = 400;
  if (lines.length > maxLines) {
    logEl.textContent = lines.slice(lines.length - maxLines).join("\n");
  }
  logEl.scrollTop = logEl.scrollHeight;
}

// --- TABS ---
export function setActiveTab(tabId) {
  const panels = document.querySelectorAll(".tab-panel");
  const buttons = document.querySelectorAll(".tab-btn");
  panels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== tabId);
  });
  buttons.forEach((btn) => {
    const target = btn.getAttribute("data-tab");
    if (target === tabId) {
      btn.classList.remove("tab-btn-inactive");
      btn.classList.add("tab-btn-active");
    } else {
      btn.classList.add("tab-btn-inactive");
      btn.classList.remove("tab-btn-active");
    }
  });
}

export function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (!target) return;
      setActiveTab(target);
    });
  });
  setActiveTab("tab-login");
}

// --- UI HELPERS ---
export function updateFirebaseStatus(text, colorClass) {
  const el = document.getElementById("firebaseStatus");
  if (!el) return;
  el.innerHTML =
    'Firebase: <span class="' + (colorClass || "") + '">' + text + "</span>";
}

export function updateAuthStatus(text, colorClass) {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.innerHTML =
    'Auth: <span class="' + (colorClass || "") + '">' + text + "</span>";
}

export function updateUidStatus(uid) {
  const el = document.getElementById("uidStatus");
  if (!el) return;
  if (uid) {
    el.textContent = "UID: " + uid;
  } else {
    el.textContent = "";
  }
}

// --- FIREBASE INIT ---
export function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    appState.firebaseReady = true;

    updateFirebaseStatus("initialized (v9 modular)", "text-emerald-400");
    pushLog("[INFO] Firebase v9 modular initialized");

    updateAuthStatus("signing in anonymously…", "text-amber-400");
    signInAnonymously(auth).catch((error) => {
      console.error(error);
      updateAuthStatus("error", "text-red-400");
      pushLog("[AUTH ERROR] " + (error.message || error.toString()));
    });

    onAuthStateChanged(auth, (user) => {
      if (user) {
        appState.uid = user.uid;
        updateAuthStatus("ready", "text-emerald-400");
        updateUidStatus(user.uid);
        pushLog("[AUTH] Auth ready, uid: " + user.uid);
      } else {
        appState.uid = null;
        updateAuthStatus("signed out", "text-amber-400");
        updateUidStatus(null);
        pushLog("[AUTH] No user");
      }
    });
  } catch (error) {
    console.error(error);
    appState.firebaseReady = false;
    updateFirebaseStatus("failed", "text-red-400");
    updateAuthStatus("error", "text-red-400");
    pushLog("[ERROR] Firebase init failed: " + (error.message || error.toString()));
  }
}

// --- APP BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
  pushLog("KPI Data Processor loaded – Code " + CODE_VERSION);
  
  // Theme Init
  initTheme();

  // UI Init
  initTabs();
  
  // Theme Toggles
  const toggleMobile = document.getElementById('btnThemeToggle');
  if (toggleMobile) toggleMobile.addEventListener('click', toggleTheme);
  
  const toggleDesktop = document.getElementById('btnThemeToggleDesktop');
  if (toggleDesktop) toggleDesktop.addEventListener('click', toggleTheme);

  // Config UI logic
  document.getElementById("btnApplyConfig")?.addEventListener("click", () => {
      const dailyCol = document.getElementById("cfgDailyCollection")?.value || "";
      const weeklyCol = document.getElementById("cfgWeeklyCollection")?.value || "";
      const recapCol = document.getElementById("cfgRecapCollection")?.value || "";

      if (dailyCol) appState.collections.dailySub = dailyCol;
      if (weeklyCol) appState.collections.weeklySub = weeklyCol;
      if (recapCol) appState.collections.recapSub = recapCol;

      pushLog(
        "[CONFIG] Collections updated: " +
          DAILY_COLLECTION_ROOT + "/{storeId}/" + appState.collections.dailySub +
          " | " + appState.collections.weeklySub +
          " | " + appState.collections.recapSub
      );
  });
  
  document.getElementById("btnClearLog")?.addEventListener("click", () => {
      const logEl = document.getElementById("consoleLog");
      if (logEl) logEl.textContent = "";
  });

  // Start Firebase
  updateFirebaseStatus("initializing…", "text-amber-400");
  initFirebase();
});