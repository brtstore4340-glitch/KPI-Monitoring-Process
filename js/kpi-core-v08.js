// kpi-core-v08.js
// KPI Data Processor – Code V09-LoginFirst (FULL FILE)

// --- IMPORTS (Firebase v9 Modular) ---
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
  addDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// NOTE: XLSX & JSZip are loaded globally from CDN in index.html
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

import { initTheme, toggleTheme, initTabs, initView } from "./ui.js";

// --- VERSION ---
export const CODE_VERSION = "V09-LoginFirst";

// --- CONFIG & CONSTANTS (ห้ามแก้) ---
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

// --- LOGGING (Console Area) ---
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
        "Firebase: <span class=\"" +
        (colorClass || "") +
        "\">" +
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

// --- SMALL HELPERS ---
function getTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return "" + y + m + day;
}

function ensureLibsReady() {
  if (typeof XLSX === "undefined") {
    pushLog("[ERROR] XLSX library not loaded");
    return false;
  }
  if (typeof JSZip === "undefined") {
    pushLog("[ERROR] JSZip library not loaded");
    return false;
  }
  return true;
}

function ensureFirebaseReady() {
  if (!appState.firebaseReady || !db) {
    pushLog("[ERROR] Firebase is not ready yet. Please wait…");
    return false;
  }
  return true;
}

// --- FILE META PARSER ---
function detectFileMeta(fileName, forcedGroup) {
  const lower = fileName.toLowerCase();
  let fileType = "unknown";
  let group = forcedGroup || "unknown";
  let storeId = null;
  let dateKey = null;

  // Daily KPI
  if (lower.includes("daily sales kpi")) {
    fileType = "daily_kpi";
    if (!group || group === "unknown") group = "daily";
  }

  // Weekly KPI
  if (lower.includes("weekly sales kpi")) {
    fileType = "weekly_kpi";
    group = "weekly";
  }

  // salebydeptUK4340
  if (lower.startsWith("salebydeptuk")) {
    fileType = "salebydeptUK";
    if (!group || group === "unknown") group = "daily";
    const m = lower.match(/salebydeptuk(\d{4})/);
    if (m) storeId = m[1];
  }

  // soldmovement43401511
  if (lower.startsWith("soldmovement")) {
    fileType = "soldmovement";
    if (!group || group === "unknown") group = "daily";
    const m = lower.match(/soldmovement(\d{4})(\d{4})?/);
    if (m) {
      storeId = m[1];
      // m[2] = 4 หลักท้าย (เช่น 1511) ยังไม่ใช้เป็น dateKey
    }
  }

  // storerecap4340
  if (lower.startsWith("storerecap")) {
    fileType = "storerecap";
    group = "recap";
    const m = lower.match(/storerecap(\d{4})/);
    if (m) storeId = m[1];
  }

  // หา storeId แบบทั่วไป (4 digits)
  if (!storeId) {
    const mStore = lower.match(/(\d{4})/);
    if (mStore) storeId = mStore[1];
  }

  // หา dateKey YYYYMMDD
  const mDate = lower.match(/(20\d{6})/);
  if (mDate) {
    dateKey = mDate[1];
  }
  if (!dateKey) {
    dateKey = getTodayYmd();
  }

  if (!group || group === "unknown") {
    group = "daily";
  }

  return {
    rawFileName: fileName,
    fileType,
    group,
    storeId: storeId || "0000",
    dateKey
  };
}

// --- SHEET HELPERS ---
function sheetTo2DArray(worksheet, range) {
  const opts = { header: 1, blankrows: false };
  if (range) opts.range = range;
  const rows = XLSX.utils.sheet_to_json(worksheet, opts);
  const cleaned = rows.filter((row) =>
    Array.isArray(row) ? row.some((cell) => cell !== null && cell !== "") : true
  );
  return cleaned;
}

// --- FIRESTORE HELPERS ---
function getPublicCollectionRef() {
  if (!db) return null;
  const clean = PUBLIC_COLLECTION_PATH.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return null;
  const segments = clean.split("/");
  return collection(db, ...segments);
}

async function persistToFirestore(meta, rows, sheetName) {
  if (!ensureFirebaseReady()) return;

  const storeId = meta.storeId || "0000";
  const dateKey = meta.dateKey || getTodayYmd();

  let subCollection = appState.collections.dailySub;
  if (meta.group === "weekly") {
    subCollection = appState.collections.weeklySub;
  } else if (meta.group === "recap") {
    subCollection = appState.collections.recapSub;
  }

  const headers = rows.length ? rows[0] : [];
  const dataRows = rows.length > 1 ? rows.slice(1) : [];

  const docId = dateKey + "_" + meta.fileType;
  const dataRef = doc(
    collection(db, DAILY_COLLECTION_ROOT, storeId, subCollection),
    docId
  );

  const payload = {
    storeId,
    fileType: meta.fileType,
    group: meta.group,
    dateKey,
    filename: meta.rawFileName,
    sheetName: sheetName || null,
    processedAt: new Date().toISOString(),
    uid: appState.uid || null,
    role: appState.role || null,
    displayName: appState.displayName || null,
    headers,
    rows: dataRows
  };

  await setDoc(dataRef, payload, { merge: true });

  const pubCol = getPublicCollectionRef();
  if (pubCol) {
    const summary = {
      storeId,
      dateKey,
      fileType: meta.fileType,
      group: meta.group,
      filename: meta.rawFileName,
      sheetName: sheetName || null,
      rowCount: dataRows.length,
      processedAt: payload.processedAt,
      version: CODE_VERSION
    };
    await addDoc(pubCol, summary);
  }

  pushLog(
    "[FIRESTORE] Saved " +
      meta.fileType +
      " for store " +
      storeId +
      " at " +
      dateKey +
      " (" +
      (dataRows.length || 0) +
      " rows)"
  );
}

// --- CORE PROCESSORS (Daily / Weekly / Recap) ---
async function processWorkbookBuffer(fileName, arrayBuffer, forcedGroup) {
  if (!ensureLibsReady()) return;
  if (!ensureFirebaseReady()) return;

  const meta = detectFileMeta(fileName, forcedGroup);
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  let rows;
  if (meta.fileType === "daily_kpi") {
    rows = sheetTo2DArray(ws, DAILY_KPI_RANGE);
  } else {
    rows = sheetTo2DArray(ws);
  }

  await persistToFirestore(meta, rows, sheetName);
}

// --- DAILY PACK ---
export async function processDailyPack(file) {
  if (!file) {
    pushLog("[DAILY] No file selected");
    return;
  }
  if (!ensureLibsReady()) return;

  const name = file.name || "daily-file";

  try {
    if (name.toLowerCase().endsWith(".zip")) {
      pushLog("[DAILY] Processing ZIP: " + name);
      const zip = new JSZip();
      const loaded = await zip.loadAsync(file);
      const entries = Object.values(loaded.files).filter(
        (f) => !f.dir && f.name.toLowerCase().endsWith(".xlsx")
      );

      if (!entries.length) {
        pushLog("[DAILY] No .xlsx files found inside zip");
        return;
      }

      for (const entry of entries) {
        const entryName = entry.name.split("/").pop();
        pushLog("[DAILY] -> " + entryName);
        const buf = await entry.async("arraybuffer");
        await processWorkbookBuffer(entryName, buf, "daily");
      }
    } else {
      pushLog("[DAILY] Processing file: " + name);
      const buf = await file.arrayBuffer();
      await processWorkbookBuffer(name, buf, "daily");
    }
  } catch (err) {
    const msg = err && (err.message || err.toString());
    pushLog("[DAILY ERROR] " + msg);
  }
}

// --- WEEKLY FILE ---
export async function processWeeklyFile(file) {
  if (!file) {
    pushLog("[WEEKLY] No file selected");
    return;
  }
  if (!ensureLibsReady()) return;

  const name = file.name || "weekly-file";

  try {
    if (name.toLowerCase().endsWith(".zip")) {
      pushLog("[WEEKLY] Processing ZIP: " + name);
      const zip = new JSZip();
      const loaded = await zip.loadAsync(file);
      const entries = Object.values(loaded.files).filter(
        (f) => !f.dir && f.name.toLowerCase().endsWith(".xlsx")
      );

      if (!entries.length) {
        pushLog("[WEEKLY] No .xlsx files found inside zip");
        return;
      }

      for (const entry of entries) {
        const entryName = entry.name.split("/").pop();
        pushLog("[WEEKLY] -> " + entryName);
        const buf = await entry.async("arraybuffer");
        await processWorkbookBuffer(entryName, buf, "weekly");
      }
    } else {
      pushLog("[WEEKLY] Processing file: " + name);
      const buf = await file.arrayBuffer();
      await processWorkbookBuffer(name, buf, "weekly");
    }
  } catch (err) {
    const msg = err && (err.message || err.toString());
    pushLog("[WEEKLY ERROR] " + msg);
  }
}

// --- RECAP FILE ---
export async function processRecapFile(file) {
  if (!file) {
    pushLog("[RECAP] No file selected");
    return;
  }
  if (!ensureLibsReady()) return;

  const name = file.name || "recap-file";

  try {
    if (name.toLowerCase().endsWith(".zip")) {
      pushLog("[RECAP] Processing ZIP: " + name);
      const zip = new JSZip();
      const loaded = await zip.loadAsync(file);
      const entries = Object.values(loaded.files).filter(
        (f) => !f.dir && f.name.toLowerCase().endsWith(".xlsx")
      );

      if (!entries.length) {
        pushLog("[RECAP] No .xlsx files found inside zip");
        return;
      }

      for (const entry of entries) {
        const entryName = entry.name.split("/").pop();
        pushLog("[RECAP] -> " + entryName);
        const buf = await entry.async("arraybuffer");
        await processWorkbookBuffer(entryName, buf, "recap");
      }
    } else {
      pushLog("[RECAP] Processing file: " + name);
      const buf = await file.arrayBuffer();
      await processWorkbookBuffer(name, buf, "recap");
    }
  } catch (err) {
    const msg = err && (err.message || err.toString());
    pushLog("[RECAP ERROR] " + msg);
  }
}

// --- OPTIONAL: setActiveTab (ให้ไฟล์อื่นเรียกได้) ---
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

  // 1) เริ่มที่หน้า Login ก่อน
  initView();
