// kpi-login.js
// KPI Data Processor – Code V10 (Login UI + Validation + Users)

import {
  appState,
  db,
  USERS_COLLECTION_ROOT,
  pushLog
} from "./kpi-core.js";

import {
  toggleViewToApp,
  toggleViewToLogin,
  updateHeaderUserDisplay
} from "./ui.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/* ---------- HELPERS ---------- */

function validateUsername(value) {
  const v = (value || "").trim();
  if (!v) return { valid: false, message: "Username is required." };

  // ตัวอย่าง format ง่ายๆ: ตัวอักษร/ตัวเลข/._-  อย่างน้อย 3 ตัว
  const re = /^[A-Za-z0-9._-]{3,}$/;
  if (!re.test(v)) {
    return {
      valid: false,
      message: "Use at least 3 letters or numbers (A–Z, 0–9, . _ -)."
    };
  }
  return { valid: true, message: "" };
}

function validatePassword(value) {
  const v = value || "";
  if (!v) return { valid: false, message: "Password is required." };
  if (v.length < 6)
    return { valid: false, message: "Must be at least 6 characters." };

  if (!/[a-z]/.test(v) || !/[A-Z]/.test(v) || !/[0-9]/.test(v)) {
    return {
      valid: false,
      message: "Include uppercase, lowercase and a number."
    };
  }
  return { valid: true, message: "" };
}

function setFieldState(fieldId, result) {
  const field = document.getElementById(fieldId);
  const input = field?.querySelector("input");
  const errorEl = field?.querySelector(".login-error");
  if (!field || !input || !errorEl) return;

  if (result.valid) {
    field.classList.remove("login-field--error");
    input.setAttribute("aria-invalid", "false");
    errorEl.textContent = "";
  } else {
    field.classList.add("login-field--error");
    input.setAttribute("aria-invalid", "true");
    errorEl.textContent = result.message;
  }
}

function setButtonLoading(isLoading) {
  const btn = document.getElementById("loginSubmitButton");
  if (!btn) return;
  const labelSpan = btn.querySelector(".login-btn__label");
  if (isLoading) {
    btn.disabled = true;
    if (!btn.querySelector(".login-btn__spinner")) {
      const sp = document.createElement("span");
      sp.className = "login-btn__spinner";
      btn.insertBefore(sp, labelSpan);
    }
    if (labelSpan) labelSpan.textContent = "Signing in…";
  } else {
    btn.disabled = false;
    const sp = btn.querySelector(".login-btn__spinner");
    if (sp) sp.remove();
    if (labelSpan) labelSpan.textContent = "Sign In";
  }
}

function showSuccessOverlay() {
  const overlay = document.getElementById("loginSuccessOverlay");
  if (!overlay) return;
  overlay.classList.add("login-success--visible");
}

function hideSuccessOverlay() {
  const overlay = document.getElementById("loginSuccessOverlay");
  if (!overlay) return;
  overlay.classList.remove("login-success--visible");
}

/* ---------- SEED DEFAULT USERS ---------- */

async function seedUsers() {
  try {
    if (!db) {
      pushLog("[SEED] Firestore not ready yet, skip");
      return;
    }

    const defaultUsers = [
      { username: "admin", password: "admin230049", role: "Admin",        displayName: "Administrator" },
      { username: "4340",  password: "SGM4340**",  role: "Store Manager", displayName: "Manager 4340" },
      { username: "4340s", password: "4340s",      role: "Store",         displayName: "Staff 4340" }
    ];

    for (const user of defaultUsers) {
      const ref = doc(db, USERS_COLLECTION_ROOT, user.username);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, user);
        pushLog("[SEED] Created user: " + user.username);
      }
    }
  } catch (err) {
    console.error(err);
    pushLog("[SEED ERROR] " + (err.message || err.toString()));
  }
}

/* ---------- LOGIN HANDLER ---------- */

async function handleLoginSubmit(event) {
  event.preventDefault();

  const nameInput = document.getElementById("loginName");
  const passInput = document.getElementById("loginPassword");
  const rememberChk = document.getElementById("loginRemember");

  const usernameRaw = nameInput?.value || "";
  const passwordRaw = passInput?.value || "";

  const userResult = validateUsername(usernameRaw);
  const passResult = validatePassword(passwordRaw);

  setFieldState("loginNameField", userResult);
  setFieldState("loginPasswordField", passResult);

  if (!userResult.valid || !passResult.valid) {
    return;
  }

  if (!appState.firebaseReady || !db) {
    Swal.fire("System Error", "ยังไม่ได้เชื่อมต่อ Database กรุณารอสักครู่", "error");
    return;
  }

  try {
    setButtonLoading(true);

    const username = usernameRaw.trim();
    const userRef = doc(db, USERS_COLLECTION_ROOT, username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("ไม่พบผู้ใช้งานนี้ในระบบ");
    }

    const userData = userSnap.data();
    if (userData.password !== passwordRaw) {
      throw new Error("รหัสผ่านไม่ถูกต้อง");
    }

    // Save remember-me
    if (rememberChk && rememberChk.checked) {
      localStorage.setItem("kpi-login-remember-username", username);
    } else {
      localStorage.removeItem("kpi-login-remember-username");
    }

    // Success -> update appState
    appState.username = userData.username;
    appState.displayName = userData.displayName || userData.username;
    appState.role = userData.role;

    pushLog(`[LOGIN] Success: ${appState.username} (${appState.role})`);

    if (passInput) passInput.value = "";

    updateHeaderUserDisplay(appState.displayName, appState.role, appState.username);

    // Success animation then go to app
    showSuccessOverlay();
    setTimeout(() => {
      toggleViewToApp();
      hideSuccessOverlay();
    }, 750);
  } catch (error) {
    console.error(error);
    pushLog("[LOGIN FAILED] " + (error.message || error.toString()));
    Swal.fire("เข้าสู่ระบบไม่สำเร็จ", error.message || "Unknown error", "error");
  } finally {
    setButtonLoading(false);
  }
}

/* ---------- LOGOUT ---------- */

function handleLogout() {
  appState.displayName = null;
  appState.username = null;
  appState.role = null;

  const nameInput = document.getElementById("loginName");
  const passInput = document.getElementById("loginPassword");
  if (nameInput) nameInput.value = "";
  if (passInput) passInput.value = "";

  localStorage.removeItem("kpi-login-remember-username");

  pushLog("[LOGIN] Logged out");
  toggleViewToLogin();
}

/* ---------- REAL-TIME VALIDATION & UI WIRING ---------- */

function attachRealtimeValidation() {
  const nameInput = document.getElementById("loginName");
  const passInput = document.getElementById("loginPassword");

  if (nameInput) {
    nameInput.addEventListener("input", () => {
      const res = validateUsername(nameInput.value);
      setFieldState("loginNameField", res);
    });
  }

  if (passInput) {
    passInput.addEventListener("input", () => {
      const res = validatePassword(passInput.value);
      setFieldState("loginPasswordField", res);
    });
  }
}

function attachPasswordToggle() {
  const toggle = document.getElementById("passwordToggle");
  const passInput = document.getElementById("loginPassword");
  if (!toggle || !passInput) return;

  toggle.addEventListener("click", () => {
    const isPassword = passInput.type === "password";
    passInput.type = isPassword ? "text" : "password";
    toggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    const icon = toggle.querySelector(".password-toggle-icon");
    if (icon) {
      icon.textContent = isPassword ? "🙈" : "👁";
    }
  });
}

function restoreRememberedUsername() {
  const stored = localStorage.getItem("kpi-login-remember-username");
  const nameInput = document.getElementById("loginName");
  const rememberChk = document.getElementById("loginRemember");

  if (stored && nameInput) {
    nameInput.value = stored;
    if (rememberChk) rememberChk.checked = true;
    const res = validateUsername(stored);
    setFieldState("loginNameField", res);
  }
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", handleLogout);
  }

  attachRealtimeValidation();
  attachPasswordToggle();
  restoreRememberedUsername();

  // seed users หลัง Firebase init ไปแล้วเล็กน้อย
  setTimeout(seedUsers, 2500);
});
