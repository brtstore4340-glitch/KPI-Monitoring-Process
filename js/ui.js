// ui.js
// KPI Data Processor – Code V10 (UI & View Control)

/**
 * Initial view: show Login, hide App
 */
export function initView() {
  const loginView = document.getElementById("view-login");
  const appView = document.getElementById("view-app");
  if (loginView) loginView.classList.remove("hidden");
  if (appView) appView.classList.add("hidden");
}

/**
 * Switch to App view after login
 */
export function toggleViewToApp() {
  const loginView = document.getElementById("view-login");
  const appView = document.getElementById("view-app");
  if (loginView) loginView.classList.add("hidden");
  if (appView) appView.classList.remove("hidden");
}

/**
 * Switch back to Login view after logout
 */
export function toggleViewToLogin() {
  const loginView = document.getElementById("view-login");
  const appView = document.getElementById("view-app");
  if (loginView) loginView.classList.remove("hidden");
  if (appView) appView.classList.add("hidden");

  // Reset header display
  updateHeaderUserDisplay("...", null, null);
}

/**
 * Update header user display text (top-right)
 */
export function updateHeaderUserDisplay(displayName, role, username) {
  const el = document.getElementById("headerUserDisplay");
  if (!el) return;
  const name = displayName || username || "-";
  el.textContent = name;
}

/**
 * Theme helpers
 */
function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === "dark";
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const mobileToggle = document.getElementById("btnThemeToggle");
  const desktopToggle = document.getElementById("btnThemeToggleDesktop");
  const icon = isDark ? "☀️" : "🌙";
  if (mobileToggle) mobileToggle.innerText = icon;
  if (desktopToggle) desktopToggle.innerText = icon;
}

export function initTheme() {
  let theme = localStorage.getItem("kpi-theme");
  if (!theme) {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }
  applyTheme(theme);
}

export function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const nextTheme = isDark ? "light" : "dark";
  localStorage.setItem("kpi-theme", nextTheme);
  applyTheme(nextTheme);
}

/**
 * Tabs inside view-app
 */
export function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  if (!buttons || !buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      if (!targetId) return;
      setActiveTab(targetId);
    });
  });

  // default: first tab active
  const firstActive = document.querySelector(".tab-btn-active");
  if (!firstActive && buttons[0]) {
    const t = buttons[0].getAttribute("data-tab");
    if (t) setActiveTab(t);
  }
}

/**
 * Show active tab panel, hide others
 */
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
