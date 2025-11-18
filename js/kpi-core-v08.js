// kpi-core-v08.js
// KPI Data Processor – Code V09 (LoginFirst + Calendar)

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
import { initTheme, toggleTheme, initTabs, initView } from "./ui.js";

export const CODE_VERSION = "V09-LoginFirst";

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
  const maxLines = 400;
  if (lines.length > maxLines) {
    logEl.textContent = lines.slice(lines.length - maxLines).join("\n");
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

// --- FILENAME HELPERS ---
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

function extractStoreId(filename) {
  const groups = filename.match(/\d+/g) || [];
  let candidate = null;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.length === 4 && !g.startsWith("20")) {
      candidate = g;
      break;
    }
  }
  if (!candidate) {
    for (let j = 0; j < groups.length; j++) {
      if (groups[j].length === 4) {
        candidate = groups[j];
        break;
      }
    }
  }
  return candidate || "0000";
}

function extractDateKeyFromFilename(filename) {
  const m = filename.match(/(\d{8})/);
  if (m) return m[1];
  return null;
}

// --- FIRESTORE PERSISTENCE ---
async function persistToFirestore(entry, rows) {
  if (!db || !appState.firebaseReady) {
    pushLog("[FS] Firebase not ready – skip Firestore write");
    return;
  }

  const {
    storeId,
    dateKey,
    group,
    fileType,
    filename,
    sheetName,
    rowCount,
    processedAt
  } = entry;

  let subCollectionName;
  if (group === "weekly") {
    subCollectionName = appState.collections.weeklySub;
  } else if (group === "recap") {
    subCollectionName = appState.collections.recapSub;
  } else {
    subCollectionName = appState.collections.dailySub;
  }

  const docId = dateKey + "_" + fileType;

  try {
    const storeDocRef = doc(collection(db, DAILY_COLLECTION_ROOT), storeId);
    const kpiCollRef = collection(storeDocRef, subCollectionName);
    const kpiDocRef = doc(kpiCollRef, docId);

    const payload = {
      storeId,
      dateKey,
      group,
      fileType,
      filename,
      sheetName,
      rowCount,
      processedAt,
      data: rows,
      version: CODE_VERSION,
      uid: appState.uid || null,
      role: appState.role || null,
      displayName: appState.displayName || null
    };

    await setDoc(kpiDocRef, payload, { merge: true });

    pushLog(
      "[FS] Saved " +
        group.toUpperCase() +
        " (" +
        fileType +
        ") -> " +
        DAILY_COLLECTION_ROOT +
        "/" +
        storeId +
        "/" +
        subCollectionName +
        "/" +
        docId
    );
  } catch (err) {
    const msg = err && (err.message || err.toString());
    pushLog("[FS ERROR] " + msg);
  }

  // summary ลง PUBLIC_COLLECTION_PATH
  try {
    let pathClean = PUBLIC_COLLECTION_PATH;
    while (pathClean.startsWith("/")) {
      pathClean = pathClean.slice(1);
    }
    const segments = pathClean.split("/").filter((s) => s);

    const publicCollRef = collection(
      db,
      segments[0],
      segments[1],
      segments[2],
      segments[3],
      segments[4]
    );

    await addDoc(publicCollRef, {
      storeId,
      dateKey,
      group,
      fileType,
      filename,
      sheetName,
      rowCount,
      processedAt,
      version: CODE_VERSION
    });

    pushLog("[FS] Appended summary -> " + PUBLIC_COLLECTION_PATH);
  } catch (err2) {
    const msg2 = err2 && (err2.message || err2.toString());
    pushLog("[FS WARN] Public summary failed: " + msg2);
  }
}

// --- XLSX PROCESSING ---
async function handleXlsx(u8Array, filename, group, fileType) {
  if (typeof XLSX === "undefined") {
    pushLog("[ERROR] XLSX library not loaded");
    return;
  }

  const workbook = XLSX.read(u8Array, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  let rows;
  if (fileType === "daily_kpi") {
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      range: DAILY_KPI_RANGE
    });
  } else {
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }
  const rowCount = rows.length;

  const storeId = extractStoreId(filename);
  const rawDateKey = extractDateKeyFromFilename(filename);
  const dateKey =
    rawDateKey ||
    new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const processedAt = new Date().toISOString();

  const entry = {
    storeId,
    dateKey,
    group,
    fileType,
    filename,
    sheetName,
    rowCount,
    processedAt
  };

  await persistToFirestore(entry, rows);

  if (!appState.files[group]) {
    appState.files[group] = [];
  }
  appState.files[group].push(entry);

  pushLog(
    "  • [" +
      group.toUpperCase() +
      " | " +
      fileType +
      "] " +
      filename +
      " | sheet: " +
      sheetName +
      " | rows: " +
      rowCount
  );
}

async function processZipOrXlsx(baseGroup, inputElementId) {
  const input = document.getElementById(inputElementId);
  if (!input || !input.files || !input.files.length) {
    pushLog("[" + baseGroup.toUpperCase() + "] No file selected");
    return;
  }
  const file = input.files[0];
  const nameLower = file.name.toLowerCase();

  pushLog("[" + baseGroup.toUpperCase() + "] Reading file: " + file.name);

  try {
    if (nameLower.endsWith(".zip")) {
      if (typeof JSZip === "undefined") {
        pushLog("[ERROR] JSZip library not loaded");
        return;
      }
      const zip = await JSZip.loadAsync(file);
      let count = 0;
      const jobs = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        if (!relativePath.toLowerCase().endsWith(".xlsx")) return;

        const info = classifyFileByName(relativePath, baseGroup);
        const { fileType, group } = info;

        const job = zipEntry.async("uint8array").then((u8) => {
          count++;
          return handleXlsx(u8, relativePath, group, fileType);
        });
        jobs.push(job);
      });

      await Promise.all(jobs);
      pushLog(
        "[" +
          baseGroup.toUpperCase() +
          "] Processed " +
          count +
          " workbook(s) from zip"
      );
    } else if (nameLower.endsWith(".xlsx")) {
      const info = classifyFileByName(file.name, baseGroup);
      const { fileType, group } = info;

      const buffer = await file.arrayBuffer();
      const u8 = new Uint8Array(buffer);
      await handleXlsx(u8, file.name, group, fileType);

      pushLog(
        "[" +
          baseGroup.toUpperCase() +
          "] Processed 1 workbook as " +
          fileType
      );
    } else {
      pushLog(
        "[" +
          baseGroup.toUpperCase() +
          "] Unsupported file type. Please upload .zip or .xlsx"
      );
    }
  } catch (err) {
    const msg = err && (err.message || err.toString());
    if (msg.indexOf("Encrypted zip") !== -1) {
      pushLog("[ERROR] Encrypted zip are not supported");
    } else {
      pushLog("[ERROR] " + msg);
    }
  }
}

// --- PUBLIC INPUT APIS (เหมือน V06 Logic) ---
export function processDailyPack() {
  processZipOrXlsx("daily", "dailyFile");
}

export function processWeeklyFiles() {
  processZipOrXlsx("weekly", "weeklyFile");
}

export function processRecapFiles() {
  processZipOrXlsx("recap", "recapFile");
}

// --- CONFIG UI ---
export function applyConfigFromUI() {
  const dailyColInput = document.getElementById("cfgDailyCollection");
  const weeklyColInput = document.getElementById("cfgWeeklyCollection");
  const recapColInput = document.getElementById("cfgRecapCollection");

  if (dailyColInput && dailyColInput.value) {
    appState.collections.dailySub = dailyColInput.value;
  }
  if (weeklyColInput && weeklyColInput.value) {
    appState.collections.weeklySub = weeklyColInput.value;
  }
  if (recapColInput && recapColInput.value) {
    appState.collections.recapSub = recapColInput.value;
  }

  pushLog(
    "[CONFIG] Collections updated: " +
      DAILY_COLLECTION_ROOT +
      "/{storeId}/" +
      appState.collections.dailySub +
      " | " +
      appState.collections.weeklySub +
      " | " +
      appState.collections.recapSub
  );
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
    pushLog("[INFO] Firebase v9 modular initialized – Code " + CODE_VERSION);

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
  pushLog("KPI Data Processor loaded – Code " + CODE_VERSION);

  // Initial view = Login
  initView();

  // Theme
  initTheme();
  const mobileToggle = document.getElementById("btnThemeToggle");
  if (mobileToggle) {
    mobileToggle.addEventListener("click", toggleTheme);
  }
  const desktopToggle = document.getElementById("btnThemeToggleDesktop");
  if (desktopToggle) {
    desktopToggle.addEventListener("click", toggleTheme);
  }

  // Tabs (เฉพาะใน view-app)
  initTabs();

  // Config button
  const btnApplyConfig = document.getElementById("btnApplyConfig");
  if (btnApplyConfig) {
    btnApplyConfig.addEventListener("click", applyConfigFromUI);
  }

  // Clear console button
  const btnClearLog = document.getElementById("btnClearLog");
  if (btnClearLog) {
    btnClearLog.addEventListener("click", () => {
      const logEl = document.getElementById("consoleLog");
      if (logEl) logEl.textContent = "";
    });
  }

  // Firebase
  updateFirebaseStatus("initializing…", "text-amber-400");
  initFirebase();
});
