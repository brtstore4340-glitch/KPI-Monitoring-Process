// kpi-login.js
// KPI Data Processor – Code V10
// - Login ด้วย defaultUsers (admin / 4340 / 4340s)
// - จำ session ไว้ใน localStorage (ไม่ต้อง login ซ้ำ)
// - ถ้า idle เกิน 10 นาที -> หมด session และเด้งกลับหน้า Login

import {
  appState,
  pushLog,
  updateAuthStatus,
  updateFirebaseStatus
} from "./kpi-core.js";

import {
  toggleViewToApp,
  toggleViewToLogin,
  updateHeaderUserDisplay
} from "./ui.js";

// ---------------- CONFIG SESSION ----------------

const SESSION_KEY = "kpi-session-v10";
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 นาที

// user เริ่มต้น (ตามที่พี่ให้มา)
const defaultUsers = [
  { username: "admin", password: "Admin230049", role: "Admin",        displayName: "Administrator" },
  { username: "4340",  password: "SGM4340s**",  role: "Store Manager", displayName: "Manager 4340" },
  { username: "4340s", password: "Store4340s",  role: "Store",         displayName: "Staff 4340" }
];

let idleTimer = null;
let activityListenersBound = false;

// ---------------- SESSION STORAGE HELPERS ----------------

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.username || !obj.role) return null;
    return obj;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function saveSession(user) {
  const payload = {
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.username,
    loginAt: Date.now(),
    lastActive: Date.now()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  pushLog(`[SESSION] Saved session for ${payload.username}`);
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error(e);
  }
  pushLog("[SESSION] Cleared session");
}

function handleSessionExpired() {
  clearTimeout(idleTimer);
  idleTimer = null;
  clearSession();

  appState.role = null;
  appState.username = null;
  appState.displayName = null;

  toggleViewToLogin();
  updateHeaderUserDisplay("...", null, null);
  updateAuthStatus("session expired", "text-amber-400");

  pushLog("[SESSION] Session expired (idle > 10 minutes)");

  if (window.Swal) {
    Swal.fire(
      "Session expired",
      "ระบบไม่ได้ใช้งานเกิน 10 นาที กรุณาเข้าสู่ระบบอีกครั้ง",
      "info"
    );
  } else {
    alert("Session expired, please log in again.");
  }
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(handleSessionExpired, SESSION_TIMEOUT_MS);
}

function markActivity() {
  const session = loadSession();
  if (!session) return;
  session.lastActive = Date.now();
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error(e);
  }
  resetIdleTimer();
}

function bindActivityListeners() {
  if (activityListenersBound) return;
  const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
  events.forEach((ev) => {
    window.addEventListener(ev, markActivity, true);
  });
  activityListenersBound = true;
  pushLog("[SESSION] Activity listeners bound");
}

// ---------------- APPLY USER TO APP ----------------

function applyUserToAppState(user) {
  appState.role = user.role;
  appState.username = user.username;
  appState.displayName = user.displayName || user.username;

  updateHeaderUserDisplay(appState.displayName, appState.role, appState.username);
}

// ---------------- RESTORE SESSION ON LOAD ----------------

function restoreSessionIfAvailable() {
  const sess = loadSession();
  if (!sess) {
    pushLog("[SESSION] No stored session");
    return false;
  }

  const now = Date.now();
  const diff = now - (sess.lastActive || sess.loginAt || 0);

  if (diff > SESSION_TIMEOUT_MS) {
    pushLog("[SESSION] Stored session found but already expired");
    clearSession();
    return false;
  }

  applyUserToAppState(sess);
  toggleViewToApp();
  bindActivityListeners();
  resetIdleTimer();

  updateAuthStatus("session resumed", "text-emerald-400");
  updateFirebaseStatus("initialized", "text-emerald-400");

  pushLog(`[SESSION] Resumed session for ${sess.username}`);
  return true;
}

// ---------------- FORM / VALIDATION ----------------

function setFieldError(fieldWrapper, errorEl, message) {
  if (!fieldWrapper || !errorEl) return;
  if (message) {
    fieldWrapper.classList.add("login-field--error");
    errorEl.textContent = message;
  } else {
    fieldWrapper.classList.remove("login-field--error");
    errorEl.textContent = "";
  }
}

function validateUsername(value) {
  if (!value || !value.trim()) {
    return "กรุณาใส่ Username";
  }
  if (value.trim().length < 3) {
    return "Username ต้องยาวอย่างน้อย 3 ตัวอักษร";
  }
  return "";
}

function validatePassword(value) {
  if (!value || !value.trim()) {
    return "กรุณาใส่ Password";
  }
  if (value.trim().length < 4) {
    return "Password สั้นเกินไป";
  }
  return "";
}

function findUser(username, password) {
  const u = username.trim();
  const p = password;
  return defaultUsers.find(
    (user) => user.username === u && user.password === p
  );
}

function setLoginButtonLoading(isLoading) {
  const btn = document.getElementById("loginSubmitButton");
  if (!btn) return;
  const labelSpan = btn.querySelector(".login-btn__label");

  if (isLoading) {
    btn.disabled = true;
    if (!btn.querySelector(".login-btn__spinner")) {
      const spinner = document.createElement("span");
      spinner.className = "login-btn__spinner";
      btn.insertBefore(spinner, labelSpan);
    }
    if (labelSpan) labelSpan.textContent = "Signing in...";
  } else {
    btn.disabled = false;
    const spinner = btn.querySelector(".login-btn__spinner");
    if (spinner) spinner.remove();
    if (labelSpan) labelSpan.textContent = "Sign In";
  }
}

function showSuccessOverlay() {
  const overlay = document.getElementById("loginSuccessOverlay");
  if (!overlay) return;
  overlay.classList.add("login-success--visible");
  setTimeout(() => {
    overlay.classList.remove("login-success--visible");
  }, 900);
}

// ---------------- PASSWORD TOGGLE ----------------

function attachPasswordToggle() {
  const toggleBtn = document.getElementById("passwordToggle");
  const passwordInput = document.getElementById("loginPassword");
  if (!toggleBtn || !passwordInput) return;

  toggleBtn.addEventListener("click", () => {
    const current = passwordInput.getAttribute("type");
    passwordInput.setAttribute("type", current === "password" ? "text" : "password");
  });
}

// ---------------- LOGOUT HANDLER ----------------

function attachLogoutHandler() {
  const btnLogout = document.getElementById("btnLogout");
  if (!btnLogout) return;
  btnLogout.addEventListener("click", () => {
    clearSession();
    appState.role = null;
    appState.username = null;
    appState.displayName = null;

    toggleViewToLogin();
    updateHeaderUserDisplay("...", null, null);
    updateAuthStatus("signed out", "text-amber-400");

    pushLog("[LOGIN] User logged out");
  });
}

// ---------------- FORM HANDLER ----------------

function attachFormHandler() {
  const form = document.getElementById("loginForm");
  const inputUser = document.getElementById("loginName");
  const inputPass = document.getElementById("loginPassword");
  const fieldUser = document.getElementById("loginNameField");
  const fieldPass = document.getElementById("loginPasswordField");
  const errUser = document.getElementById("loginNameError");
  const errPass = document.getElementById("loginPasswordError");

  if (!form || !inputUser || !inputPass) {
    pushLog("[LOGIN] Form elements not found");
    return;
  }

  // realtime validation
  inputUser.addEventListener("blur", () => {
    const msg = validateUsername(inputUser.value);
    setFieldError(fieldUser, errUser, msg);
  });

  inputPass.addEventListener("blur", () => {
    const msg = validatePassword(inputPass.value);
    setFieldError(fieldPass, errPass, msg);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = inputUser.value || "";
    const password = inputPass.value || "";

    const userErr = validateUsername(username);
    const passErr = validatePassword(password);

    setFieldError(fieldUser, errUser, userErr);
    setFieldError(fieldPass, errPass, passErr);

    if (userErr || passErr) {
      return;
    }

    const matchedUser = findUser(username, password);
    if (!matchedUser) {
      setFieldError(fieldPass, errPass, "Username หรือ Password ไม่ถูกต้อง");
      pushLog("[LOGIN] Failed login attempt for username=" + username);
      return;
    }

    setLoginButtonLoading(true);

    // จำ user ลง appState + localStorage
    applyUserToAppState(matchedUser);
    saveSession(matchedUser);
    bindActivityListeners();
    resetIdleTimer();

    // สถานะ auth
    updateAuthStatus("logged in", "text-emerald-400");
    updateFirebaseStatus("initialized", "text-emerald-400");

    pushLog(`[LOGIN] Success: ${matchedUser.username} (${matchedUser.role})`);

    showSuccessOverlay();

    setTimeout(() => {
      setLoginButtonLoading(false);
      toggleViewToApp();
    }, 600);
  });
}

// ---------------- BOOTSTRAP ----------------

document.addEventListener("DOMContentLoaded", () => {
  pushLog("[LOGIN] kpi-login.js loaded (V10)");

  attachPasswordToggle();
  attachFormHandler();
  attachLogoutHandler();

  // พยายาม restore session ถ้ามี และยังไม่หมดอายุ
  restoreSessionIfAvailable();

  // ถ้าไม่มี session ก็ยังอยู่หน้า login ตามปกติ
});
