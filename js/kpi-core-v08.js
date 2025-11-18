// kpi-core.js
// KPI Data Processor – Code V10 (Login First + Firebase Core)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

import { initTheme, toggleTheme, initTabs, initView } from "./ui.js";

export const CODE_VERSION = "V10-LoginFirst";

// --- CONFIG & CONSTANTS ---
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
export const USERS_COLLECTION_ROOT = "users";
export const PUBLIC_COLLECTION_PATH =
  `/artifacts/default-app-id/public/data/kpi_reports`;

// --- APP STATE ---
export const appState = {
  role: null,
  displayName: null,
  username: null,
  firebaseReady: false,
  uid: null,
  collections: {
    dailySub: "daily_kpi",
    weeklySub: "weekly_kpi",
    recapSub: "recap_kpi"
  },
  files: {
    daily: [],
    weekly: [],
    recap: []
  }
};

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
  if (lines.length > 400) {
    logEl.textContent = lines.slice(lines.length - 400).join("\n");
  }
  logEl.scrollTop = logEl.scrollHeight;
}

// --- STATUS HELPERS ---
export function updateFirebaseStatus(text, colorClass) {
  const ids = ["firebaseStatus", "firebaseStatusLogin"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "firebaseStatusLogin") {
      el.innerHTML =
        'System Status: <span class="' +
        (colorClass || "") +
        '">' +
        text +
        "</span>";
    } else {
      el.innerHTML =
        'Firebase: <span class="' +
        (colorClass || "") +
        '">' +
        text +
        "</span>";
    }
  });
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
  el.textContent = uid ? "UID: " + uid : "";
}

// --- GENERIC FIRESTORE SAVE (ใช้โดย input.js) ---
export async function saveKpiDocument(meta, rows) {
  if (!db) throw new Error("Firestore is not initialized");

  const { group, type, storeId, dateKey, fileName } = meta;

  let subName = appState.collections.dailySub;
  if (group === "weekly") subName = appState.collections.weeklySub;
  if (group === "recap") subName = appState.collections.recapSub;

  const rootCol = collection(db, DAILY_COLLECTION_ROOT);
  const storeDocRef = doc(rootCol, String(storeId || "UNKNOWN"));
  const subCol = collection(storeDocRef, subName);

  const docId =
    (type || "kpi") +
    "_" +
    (dateKey || new Date().toISOString().slice(0, 10).replace(/-/g, ""));

  const docRef = doc(subCol, docId);

  const payload = {
    meta: {
      group,
      type,
      storeId: String(storeId || "UNKNOWN"),
      dateKey: dateKey || null,
      fileName: fileName || null,
      uploadedBy: appState.username || "anonymous",
      uploadedAt: serverTimestamp()
    },
    rows
  };

  await setDoc(docRef, payload, { merge: true });
  return docRef.id;
}

// --- FIREBASE INIT ---
export function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    appState.firebaseReady = true;

    updateFirebaseStatus("initialized", "text-emerald-400");
    pushLog("[INFO] Firebase initialized – " + CODE_VERSION);

    updateAuthStatus("signing in anonymously…", "text-amber-400");
    signInAnonymously(auth).catch((error) => {
      const msg = error && (error.message || error.toString());
      updateAuthStatus("error", "text-red-400");
      pushLog("[AUTH ERROR] " + msg);
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
        updateUidStatus("");
        pushLog("[AUTH] No user");
      }
    });
  } catch (error) {
    const msg = error && (error.message || error.toString());
    appState.firebaseReady = false;
    updateFirebaseStatus("failed", "text-red-400");
    updateAuthStatus("error", "text-red-400");
    pushLog("[ERROR] Firebase init failed: " + msg);
  }
}

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
  pushLog("KPI Data Processor loaded – " + CODE_VERSION);

  // 1) เริ่มที่หน้า Login
  initView();

  // 2) Theme
  initTheme();
  const mobileToggle = document.getElementById("btnThemeToggle");
  if (mobileToggle) mobileToggle.addEventListener("click", toggleTheme);
  const desktopToggle = document.getElementById("btnThemeToggleDesktop");
  if (desktopToggle) desktopToggle.addEventListener("click", toggleTheme);

  // 3) Tabs ใน view-app
  initTabs();

  // 4) ปุ่ม Clear Log
  const btnClearLog = document.getElementById("btnClearLog");
  if (btnClearLog) {
    btnClearLog.addEventListener("click", () => {
      const logEl = document.getElementById("consoleLog");
      if (logEl) logEl.textContent = "";
    });
  }

  // 5) ปุ่ม Apply Config
  const btnApplyConfig = document.getElementById("btnApplyConfig");
  if (btnApplyConfig) {
    btnApplyConfig.addEventListener("click", () => {
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
  }

  // 6) Firebase
  updateFirebaseStatus("initializing…", "text-amber-400");
  initFirebase();
});
