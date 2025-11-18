// kpi-core-v08.js – Code V08
// Core state, Firebase v9 modular, shared helpers, tabs, config, report

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

// -------------------------------
// Code / Config / Constants
// -------------------------------
const CODE_VERSION = "V08";

const firebaseConfig = {
  apiKey: "AIzaSyAHMYpNA5Kh4uPYogaBzmNZssoQ6p53ybM",
  authDomain: "studio-3431359559-3d25c.firebaseapp.com",
  projectId: "studio-3431359559-3d25c",
  storageBucket: "studio-3431359559-3d25c.firebasestorage.app",
  messagingSenderId: "355345619214",
  appId: "1:355345619214:web:6c23fcb229d42c13ff5f5f",
};

const KPI_DEFAULT_PASSWORD = "NewBI#2020";
const DAILY_KPI_RANGE = "A1:Z23";
const DAILY_COLLECTION_ROOT = "stores";
const PUBLIC_COLLECTION_PATH =
  `/artifacts/default-app-id/public/data/kpi_reports`;

// -------------------------------
// App state
// -------------------------------
const appState = {
  role: null,
  displayName: null,
  firebaseReady: false,
  uid: null,
  collections: {
    dailySub: "daily_kpi",
    weeklySub: "weekly_kpi",
    recapSub: "recap_kpi",
  },
  filesByGroup: {
    daily: [],
    weekly: [],
    recap: [],
  },
};

let app;
let auth;
let db;
let storage;

// -------------------------------
// Log helper
// -------------------------------
function pushLog(message) {
  const logEl = document.getElementById("consoleLog");
  if (!logEl) return;
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${message}`;
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

// -------------------------------
// Tabs
// -------------------------------
function setActiveTab(tabId) {
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

function initTabs() {
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

// -------------------------------
// User display (header)
// -------------------------------
function updateUserDisplay() {
  const nameEl = document.getElementById("currentUserDisplay");
  const roleEl = document.getElementById("currentRoleDisplay");
  if (nameEl) {
    nameEl.textContent = appState.displayName || "-";
  }
  if (roleEl) {
    roleEl.textContent = appState.role || "-";
  }
}

// -------------------------------
// Helper: filename classification
// -------------------------------
function classifyFileByName(filename, baseGroup) {
  const lower = filename.toLowerCase();
  let fileType = "unknown";
  let group = baseGroup || "daily";

  if (lower.startsWith("daily sales kpi by")) {
    fileType = "daily_kpi";
    group = "daily";
  } else if (lower.startsWith("salebydeptuk")) {
    fileType = "salebydeptUK";
    group = "daily";
  } else if (lower.startsWith("soldmovement")) {
    fileType = "soldmovement";
    group = "daily";
  } else if (lower.startsWith("storerecap")) {
    fileType = "storerecap";
    group = "recap";
  } else if (lower.startsWith("weekly sales kpi by")) {
    fileType = "weekly_kpi";
    group = "weekly";
  }

  return { fileType, group };
}

// -------------------------------
// Helper: extract storeId / dateKey
// -------------------------------
function extractStoreId(filename) {
  // เช่น Daily Sales KPI by Store-en-us-4340_20251102_170024.xlsx
  const groups = filename.match(/\d+/g) || [];
  let candidate = null;
  for (const g of groups) {
    if (g.length === 4 && !g.startsWith("20")) {
      candidate = g;
      break;
    }
  }
  if (!candidate) {
    candidate = groups.find((g) => g.length === 4) || "0000";
  }
  return candidate;
}

function extractDateKeyFromFilename(filename) {
  // หา 8 digits เช่น 20251108 จากชื่อไฟล์
  const m = filename.match(/(\d{8})/);
  if (m) return m[1];
  return null;
}

// -------------------------------
// Firestore persistence
// -------------------------------
async function persistToFirestore(group, fileType, meta, rows) {
  if (!db || !appState.firebaseReady) {
    pushLog("[FS] Firebase not ready – skip Firestore write");
    return;
  }

  const filename = meta.filename || "unknown";
  const storeId = extractStoreId(filename);
  const rawDateKey = extractDateKeyFromFilename(filename);
  const dateKey =
    rawDateKey || new Date().toISOString().slice(0, 10).replace(/-/g, "");

  let subCollectionName;
  if (group === "weekly") {
    subCollectionName = appState.collections.weeklySub;
  } else if (group === "recap") {
    subCollectionName = appState.collections.recapSub;
  } else {
    subCollectionName = appState.collections.dailySub;
  }

  const kpiDocId = `${dateKey}_${fileType}`;

  try {
    const storeDocRef = doc(collection(db, DAILY_COLLECTION_ROOT), storeId);
    const kpiCollRef = collection(storeDocRef, subCollectionName);
    const kpiDocRef = doc(kpiCollRef, kpiDocId);

    const payload = {
      storeId,
      dateKey,
      group,
      fileType,
      filename: meta.filename,
      sheetName: meta.sheetName,
      rowCount: meta.rowCount,
      processedAt: meta.processedAt,
      data: rows,
      version: CODE_VERSION,
      uid: appState.uid || null,
      role: appState.role || null,
      displayName: appState.displayName || null,
    };

    await setDoc(kpiDocRef, payload, { merge: true });
    pushLog(
      `[FS] Saved ${group.toUpperCase()} (${fileType}) -> ${DAILY_COLLECTION_ROOT}/${storeId}/${subCollectionName}/${kpiDocId}`
    );
  } catch (err) {
    console.error(err);
    pushLog(
      "[FS ERROR] Failed to write " +
        group.toUpperCase() +
        " doc: " +
        (err.message || err.toString())
    );
  }

  // Summary ลง PUBLIC_COLLECTION_PATH
  try {
    const pathClean = PUBLIC_COLLECTION_PATH.replace(/^\/+/, "");
    const segments = pathClean.split("/").filter(Boolean);
    const publicCollRef = collection(db, ...segments);

    await addDoc(publicCollRef, {
      storeId,
      dateKey,
      group,
      fileType,
      filename: meta.filename,
      sheetName: meta.sheetName,
      rowCount: meta.rowCount,
      processedAt: meta.processedAt,
      version: CODE_VERSION,
    });

    pushLog("[FS] Appended summary -> " + PUBLIC_COLLECTION_PATH);
  } catch (err) {
    console.error(err);
    pushLog(
      "[FS WARN] Public collection push failed: " +
        (err.message || err.toString())
    );
  }
}

// -------------------------------
// Report rendering (from state)
// -------------------------------
function renderReport() {
  const reportEl = document.getElementById("reportOutput");
  if (!reportEl) return;

  const lines = [];
  lines.push("KPI Data Processor – Code " + CODE_VERSION);
  lines.push("");

  function block(title, items) {
    lines.push("== " + title + " ==");
    if (!items || !items.length) {
      lines.push("  (no files processed)");
      lines.push("");
      return;
    }
    items.forEach((f, idx) => {
      const time = f.processedAt
        ? f.processedAt.replace("T", " ").split(".")[0]
        : "";
      lines.push(
        (idx + 1) +
          ". [" +
          time +
          "] (" +
          f.fileType +
          ") " +
          f.filename +
          " | sheet: " +
          f.sheetName +
          " | rows: " +
          f.rowCount
      );
    });
    lines.push("");
  }

  block("DAILY GROUP", appState.filesByGroup.daily);
  block("WEEKLY GROUP", appState.filesByGroup.weekly);
  block("RECAP GROUP", appState.filesByGroup.recap);

  reportEl.textContent = lines.join("\n");
}

// -------------------------------
// Firebase status helpers
// -------------------------------
function updateFirebaseStatus(text, colorClass) {
  const el = document.getElementById("firebaseStatus");
  if (!el) return;
  el.innerHTML =
    'Firebase: <span class="' + (colorClass || "") + '">' + text + "</span>";
}

function updateAuthStatus(text, colorClass) {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.innerHTML =
    'Auth: <span class="' + (colorClass || "") + '">' + text + "</span>";
}

function updateUidStatus(uid) {
  const el = document.getElementById("uidStatus");
  if (!el) return;
  if (uid) {
    el.textContent = "UID: " + uid;
  } else {
    el.textContent = "";
  }
}

// -------------------------------
// Firebase init
// -------------------------------
function initFirebase() {
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
    pushLog(
      "[ERROR] Firebase init failed: " + (error.message || error.toString())
    );
  }
}

// -------------------------------
// Config UI
// -------------------------------
function applyConfigFromUI() {
  const dailyCol =
    document.getElementById("cfgDailyCollection")?.value || "";
  const weeklyCol =
    document.getElementById("cfgWeeklyCollection")?.value || "";
  const recapCol =
    document.getElementById("cfgRecapCollection")?.value || "";

  if (dailyCol) appState.collections.dailySub = dailyCol;
  if (weeklyCol) appState.collections.weeklySub = weeklyCol;
  if (recapCol) appState.collections.recapSub = recapCol;

  pushLog(
    `[CONFIG] Collections updated: ${DAILY_COLLECTION_ROOT}/{storeId}/{${appState.collections.dailySub}|${appState.collections.weeklySub}|${appState.collections.recapSub}}`
  );
}

// -------------------------------
// DOM ready (core init)
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  pushLog("KPI Data Processor loaded – Code " + CODE_VERSION);

  // Tabs
  initTabs();

  // Config
  document
    .getElementById("btnApplyConfig")
    ?.addEventListener("click", applyConfigFromUI);

  // Console clear
  document.getElementById("btnClearLog")?.addEventListener("click", () => {
    const logEl = document.getElementById("consoleLog");
    if (logEl) logEl.textContent = "";
  });

  // Firebase
  updateFirebaseStatus("initializing…", "text-amber-400");
  initFirebase();
});

// -------------------------------
// Exports (shared for other modules)
// -------------------------------
export {
  CODE_VERSION,
  KPI_DEFAULT_PASSWORD,
  DAILY_KPI_RANGE,
  DAILY_COLLECTION_ROOT,
  PUBLIC_COLLECTION_PATH,
  appState,
  pushLog,
  setActiveTab,
  initTabs,
  updateUserDisplay,
  classifyFileByName,
  extractStoreId,
  extractDateKeyFromFilename,
  persistToFirestore,
  renderReport,
  updateFirebaseStatus,
  updateAuthStatus,
  updateUidStatus,
  initFirebase,
  applyConfigFromUI,
  db,
  auth,
  storage,
};
