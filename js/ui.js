// ui.js
// KPI Data Processor – Code V09 (LoginFirst UI helpers)

const THEME_KEY = "kpi-theme";

// ----- THEME INTERNAL -----
function updateThemeIcons(theme) {
  const mobileBtn = document.getElementById("btnThemeToggle");
  const desktopBtn = document.getElementById("btnThemeToggleDesktop");
  const icon = theme === "dark" ? "🌙" : "☀️";

  if (mobileBtn) {
    const span = mobileBtn.querySelector("span");
    if (span) span.textContent = icon;
  }
  if (desktopBtn) {
    const span = desktopBtn.querySelector("span");
    if (span) span.textContent = icon;
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // ignore
  }
  updateThemeIcons(theme);
}

// ----- EXPORTED: THEME -----
export function initTheme() {
  let saved = "light";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") saved = stored;
  } catch (e) {
    // ignore
  }
  applyTheme(saved);
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

// ----- EXPORTED: TABS (Inside view-app) -----
export function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  if (!buttons.length || !panels.length) return;

  function setActive(tabId) {
    panels.forEach((panel) => {
      if (panel.id === tabId) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    });
    buttons.forEach((btn) => {
      const target = btn.getAttribute("data-tab");
      if (target === tabId) {
        btn.classList.add("tab-btn-active");
        btn.classList.remove("tab-btn-inactive");
      } else {
        btn.classList.add("tab-btn-inactive");
        btn.classList.remove("tab-btn-active");
      }
    });
  }

  // เริ่มต้นให้ Tab Input Data ทำงานก่อน
  setActive("tab-input");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (target) setActive(target);
    });
  });
}

// ----- EXPORTED: VIEW SWITCH (Login <-> App) -----
export function initView() {
  const loginView = document.getElementById("view-login");
  const appView = document.getElementById("view-app");
  if (loginView && appView) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
  }
}

// ใช้ตอน Login สำเร็จ
export function toggleViewToApp(displayName) {
  const loginView = document.getElementById("view-login");
  const appView = document.getElementById("view-app");
  if (loginView && appView) {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
  }
  const headerUserDisplay = document.getElementById("headerUserDisplay");
  if (headerUserDisplay) {
    headerUserDisplay.textContent = displayName || "...";
  }
}

// ใช้ตอน Logout
export function toggleViewToLogin() {
  const loginView = document.getElementById("view-login");
  const appView = document.getElementById("view-app");
  if (loginView && appView) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
  }
  const headerUserDisplay = document.getElementById("headerUserDisplay");
  if (headerUserDisplay) {
    headerUserDisplay.textContent = "...";
  }
}
