// kpi-login-v08.js – Code V08
// Login form, role selection, header display

import {
  CODE_VERSION,
  KPI_DEFAULT_PASSWORD,
  appState,
  pushLog,
  setActiveTab,
  updateUserDisplay,
} from "./kpi-core-v08.js";

// -------------------------------
// Login / Role handlers
// -------------------------------
function handleLoginSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById("loginName");
  const roleSelect = document.getElementById("loginRole");
  const passInput = document.getElementById("loginPassword");

  const displayName = (nameInput?.value || "").trim() || "Guest";
  const role = roleSelect?.value || "Normal";
  const password = (passInput?.value || "").trim();

  if (role === "Admin" || role === "Management") {
    if (password !== KPI_DEFAULT_PASSWORD) {
      pushLog("[LOGIN] Invalid KPI password for role " + role);
      alert("Invalid KPI password for " + role);
      return;
    }
  }

  appState.displayName = displayName;
  appState.role = role;
  if (passInput) passInput.value = "";

  updateUserDisplay();
  pushLog(
    "[LOGIN] " + displayName + " as " + role + " (Code " + CODE_VERSION + ")"
  );
  setActiveTab("tab-input");
}

function handleLogout() {
  appState.displayName = null;
  appState.role = null;
  const passInput = document.getElementById("loginPassword");
  if (passInput) passInput.value = "";
  updateUserDisplay();
  pushLog("[LOGIN] Cleared local role / display name");
  setActiveTab("tab-login");
}

// -------------------------------
// DOM ready – bind login UI
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", handleLogout);
  }
});
