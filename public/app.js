// ═══════════════════════════════════════════════════════════════
//  EPA Database System — Frontend Application v4.0
//  Permissions · Backup · Attachments · Activity Tracking
// ═══════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────
const state = {
  token: null,
  user: null,
  currentView: "dashboard",
  tables: [],
  tableCounts: {},
  currentTable: null,
  currentPage: 1,
  searchTerm: "",
  sortCol: "id",
  sortDir: "desc",
  totalPages: 1,
  totalRows: 0,
  forms: [],
  queries: [],
  reports: [],
  selectedQuery: null,
  selectedReport: null,
  selectedForm: null,
  autoRunQuery: null,
  autoRunTable: null,
  editMode: false,
  editData: {},
  selectedRecords: new Set(),
  selectMode: false,
  permissions: null,
  featurePerms: null, // { role, features }
  activityUserFilter: null,
  // Records module
  recCategory: null,
  recYear: null,
  recQuarter: null,
  recExpandedNodes: {},
  recSelectedEntryId: null,
  recInspectorMode: 'detail', // 'detail' | 'add' | 'edit'
  recSearchTerm: '',
};
const FORM_SECTIONS = {};
const REC_CATEGORIES = [
  { key: 'applications_received', label: 'Applications Received', icon: '📥' },
  { key: 'permitted_applications', label: 'Permitted Applications', icon: '✅' },
  { key: 'monitoring_records', label: 'Monitoring Records', icon: '📊' },
];
const REC_CATEGORY_LABELS = { applications_received: 'Applications Received', permitted_applications: 'Permitted Applications', monitoring_records: 'Monitoring Records' };
const REC_QUARTER_LABELS = { 1: '1st Quarter', 2: '2nd Quarter', 3: '3rd Quarter', 4: '4th Quarter' };
let searchTimer = null;
let sidebarSearchTimer = null;
let activitySearchTimer = null;

// ── Mobile sidebar helpers ───────────────────────────────────
function openMobileSidebar() {
  document.querySelector(".sidebar")?.classList.add("mobile-open");
  document.querySelector(".mobile-sidebar-overlay")?.classList.add("active");
}
function closeMobileSidebar() {
  document.querySelector(".sidebar")?.classList.remove("mobile-open");
  document.querySelector(".mobile-sidebar-overlay")?.classList.remove("active");
}
// Close sidebar when a sidebar item is clicked on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768 && e.target.closest(".sidebar-item")) {
    closeMobileSidebar();
  }
});

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Load theme preference
  const savedTheme = localStorage.getItem("epa_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  // Check access gate first, then proceed to login/app
  checkAccessGate().then((gateOk) => {
    if (!gateOk) return; // gate screen shown
    const token = localStorage.getItem("epa_token");
    if (token) {
      state.token = token;
      try {
        state.user = JSON.parse(localStorage.getItem("epa_user"));
      } catch (e) {}
      if (state.user) showApp();
      else showLogin();
    } else showLogin();
  });
});

async function checkAccessGate() {
  try {
    const res = await fetch("/api/access-gate");
    const data = await res.json();
    if (!data.required) return true; // no gate, proceed

    // Gate is required — check if we already have a valid token
    const gateToken = sessionStorage.getItem("epa_gate_token");
    if (gateToken) {
      const validateRes = await fetch("/api/access-gate/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateToken }),
      });
      const vData = await validateRes.json();
      if (vData.valid) return true; // gate token valid, proceed
      sessionStorage.removeItem("epa_gate_token");
    }

    // Show the access gate screen
    showAccessGateScreen();
    return false;
  } catch (e) {
    // If gate check fails, let them through (don't lock out on errors)
    return true;
  }
}

function showAccessGateScreen() {
  document.getElementById("login-screen").style.display = "";
  document.getElementById("app").style.display = "none";
  const loginBox = document.querySelector(".login-box");
  if (!loginBox) return;

  loginBox.querySelector("h1").textContent = "EPA Database System";
  loginBox.querySelector(".login-subtitle").textContent =
    "Authorized Access Only";

  const form = document.getElementById("login-form");
  form.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:48px;margin-bottom:8px">🔐</div>
      <p style="color:var(--text-dim);font-size:13px">Enter the access code to continue.<br>Contact your system administrator for the code.</p>
    </div>
    <div class="form-group" style="text-align:center">
      <div id="gate-code-inputs" style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
        <input type="text" maxlength="1" class="gate-digit" data-idx="0" inputmode="numeric" pattern="[0-9]" style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">
        <input type="text" maxlength="1" class="gate-digit" data-idx="1" inputmode="numeric" pattern="[0-9]" style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">
        <input type="text" maxlength="1" class="gate-digit" data-idx="2" inputmode="numeric" pattern="[0-9]" style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">
        <span style="color:var(--text-muted);font-size:24px;align-self:center">–</span>
        <input type="text" maxlength="1" class="gate-digit" data-idx="3" inputmode="numeric" pattern="[0-9]" style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">
        <input type="text" maxlength="1" class="gate-digit" data-idx="4" inputmode="numeric" pattern="[0-9]" style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">
        <input type="text" maxlength="1" class="gate-digit" data-idx="5" inputmode="numeric" pattern="[0-9]" style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border-radius:10px;border:2px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-block" id="gate-submit-btn">Verify Code</button>
    <div id="login-error" class="error-msg" style="display:none"></div>
  `;

  // Wire up digit inputs for nice UX — auto-advance, paste support
  const digits = form.querySelectorAll(".gate-digit");
  digits.forEach((input, i) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      e.target.value = val;
      if (val && i < 5) digits[i + 1].focus();
      // Auto-submit when all 6 filled
      const code = Array.from(digits)
        .map((d) => d.value)
        .join("");
      if (code.length === 6)
        setTimeout(() => form.dispatchEvent(new Event("submit")), 100);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value && i > 0) {
        digits[i - 1].focus();
        digits[i - 1].value = "";
      }
    });
    // Paste support
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData("text") || "")
        .replace(/[^0-9]/g, "")
        .slice(0, 6);
      pasted.split("").forEach((ch, idx) => {
        if (digits[idx]) digits[idx].value = ch;
      });
      if (pasted.length === 6)
        setTimeout(() => form.dispatchEvent(new Event("submit")), 100);
      else if (pasted.length > 0) digits[Math.min(pasted.length, 5)].focus();
    });
  });
  digits[0].focus();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    const code = Array.from(digits)
      .map((d) => d.value)
      .join("");
    if (code.length !== 6) {
      errEl.textContent = "Enter all 6 digits";
      errEl.style.display = "";
      return;
    }
    try {
      const res = await fetch("/api/access-gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      sessionStorage.setItem("epa_gate_token", data.gateToken);
      // Gate passed — proceed to login
      showLogin();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "";
      // Shake animation on error
      digits.forEach((d) => {
        d.style.borderColor = "var(--red)";
        d.value = "";
      });
      digits[0].focus();
      setTimeout(
        () =>
          digits.forEach((d) => {
            d.style.borderColor = "var(--border)";
          }),
        1500,
      );
    }
  };
}

// ══════════════════════════════════════════════════════════════
//  THEME TOGGLE
// ══════════════════════════════════════════════════════════════
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("epa_theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
function showLogin() {
  document.getElementById("login-screen").style.display = "";
  document.getElementById("app").style.display = "none";

  // Check if this is a first-run (no users exist) — show setup wizard
  fetch("/api/setup/check")
    .then((r) => r.json())
    .then((data) => {
      if (data.needsSetup) {
        showSetupWizard();
      } else {
        initLoginForm();
      }
    })
    .catch(() => initLoginForm());
}

function showSetupWizard() {
  const loginBox = document.querySelector(".login-box");
  if (!loginBox) return;
  loginBox.querySelector("h1").textContent = "Welcome to EPA Database";
  loginBox.querySelector(".login-subtitle").textContent =
    "First-time setup — Create your administrator account";
  const form = document.getElementById("login-form");
  form.innerHTML = `
    <div style="background:rgba(56,139,253,0.1);border:1px solid rgba(56,139,253,0.3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-bright)">
      🛡️ This account will have full administrator access to the system.
    </div>
    <div class="form-group">
      <label for="setup-fullname">Full Name</label>
      <input type="text" id="setup-fullname" placeholder="e.g. John Doe" required />
    </div>
    <div class="form-group">
      <label for="setup-user">Username</label>
      <input type="text" id="setup-user" placeholder="Choose a username (min 3 chars)" autocomplete="username" required />
    </div>
    <div class="form-group">
      <label for="setup-pass">Password</label>
      <div class="password-wrapper">
        <input type="password" id="setup-pass" placeholder="Choose a password (min 4 chars)" autocomplete="new-password" required />
        <button type="button" class="password-toggle" onclick="togglePasswordVisibility(this)" tabindex="-1" title="Show password">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="setup-pass2">Confirm Password</label>
      <div class="password-wrapper">
        <input type="password" id="setup-pass2" placeholder="Re-enter password" autocomplete="new-password" required />
        <button type="button" class="password-toggle" onclick="togglePasswordVisibility(this)" tabindex="-1" title="Show password">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Create Admin Account</button>
    <div id="login-error" class="error-msg" style="display:none"></div>
  `;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    const fullName = document.getElementById("setup-fullname").value.trim();
    const username = document.getElementById("setup-user").value.trim();
    const password = document.getElementById("setup-pass").value;
    const password2 = document.getElementById("setup-pass2").value;

    if (password !== password2) {
      errEl.textContent = "Passwords do not match";
      errEl.style.display = "";
      return;
    }
    try {
      const res = await fetch("/api/setup/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");

      // Setup done — now auto-login
      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok)
        throw new Error(loginData.error || "Login failed after setup");

      state.token = loginData.token;
      state.user = loginData.user;
      localStorage.setItem("epa_token", loginData.token);
      localStorage.setItem("epa_user", JSON.stringify(loginData.user));
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "";
    }
  };
}

function initLoginForm() {
  // Restore normal login form (in case setup wizard modified it)
  const loginBox = document.querySelector(".login-box");
  if (loginBox) {
    loginBox.querySelector("h1").textContent = "EPA Database System";
    loginBox.querySelector(".login-subtitle").textContent =
      "Environmental Protection Agency";
  }
  const form = document.getElementById("login-form");
  // Restore the standard login form HTML if it was replaced by setup wizard
  if (!document.getElementById("login-user")) {
    form.innerHTML = `
      <div class="form-group">
        <label for="login-user">Username</label>
        <input type="text" id="login-user" placeholder="Enter username" autocomplete="username" required />
      </div>
      <div class="form-group">
        <label for="login-pass">Password</label>
        <div class="password-wrapper">
          <input type="password" id="login-pass" placeholder="Enter password" autocomplete="current-password" required />
          <button type="button" class="password-toggle" onclick="togglePasswordVisibility(this)" tabindex="-1" title="Show password">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="login-submit-btn">
        <span class="btn-label">Sign In</span>
      </button>
      <div id="login-error" class="error-msg" style="display:none"></div>
    `;
  }
  // Also upgrade existing login form password field if it lacks the toggle
  upgradePasswordFields();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    errEl.classList.remove("shake");
    const username = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value;
    const submitBtn = document.getElementById("login-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="spinner spinner-sm"></span> Signing in...';
    }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("epa_token", data.token);
      localStorage.setItem("epa_user", JSON.stringify(data.user));
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "";
      // Shake animation on error
      errEl.classList.add("shake");
      setTimeout(() => errEl.classList.remove("shake"), 500);
      // Also shake the password input
      const passInput = document.getElementById("login-pass");
      if (passInput) {
        passInput.style.borderColor = "var(--red)";
        passInput.focus();
        setTimeout(() => {
          passInput.style.borderColor = "";
        }, 2000);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-label">Sign In</span>';
      }
    }
  };
}

// ══════════════════════════════════════════════════════════════
//  PASSWORD VISIBILITY TOGGLE
// ══════════════════════════════════════════════════════════════
function togglePasswordVisibility(btn) {
  const input = btn.parentElement.querySelector("input");
  if (!input) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  btn.innerHTML = isPassword
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  btn.title = isPassword ? "Hide password" : "Show password";
}

/** Upgrade plain password inputs to include visibility toggle */
function upgradePasswordFields() {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.closest(".password-wrapper")) return; // Already wrapped
    const wrapper = document.createElement("div");
    wrapper.className = "password-wrapper";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "password-toggle";
    btn.tabIndex = -1;
    btn.title = "Show password";
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.onclick = function () {
      togglePasswordVisibility(this);
    };
    wrapper.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════════════
//  LOADING HELPERS — Spinners and progress indicators
// ══════════════════════════════════════════════════════════════
/** Show a top progress bar */
function showProgressBar() {
  removeProgressBar();
  const bar = document.createElement("div");
  bar.className = "progress-bar-top";
  bar.id = "global-progress-bar";
  document.body.appendChild(bar);
}
function removeProgressBar() {
  const bar = document.getElementById("global-progress-bar");
  if (bar) bar.remove();
}

/** Set a button to loading state, returns a restore function */
function setButtonLoading(btn, loadingText) {
  if (!btn) return () => {};
  const original = btn.innerHTML;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm"></span>${loadingText ? " " + loadingText : ""}`;
  return () => {
    btn.innerHTML = original;
    btn.disabled = wasDisabled;
  };
}

/** Add ripple effect to buttons on click */
function addRipple(e) {
  const btn = e.currentTarget;
  const ripple = document.createElement("span");
  ripple.className = "ripple-effect";
  const rect = btn.getBoundingClientRect();
  ripple.style.left = e.clientX - rect.left - 10 + "px";
  ripple.style.top = e.clientY - rect.top - 10 + "px";
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
}

// Add ripple to all buttons (delegated)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn");
  if (btn && !btn.classList.contains("loading-btn")) {
    addRipple(e);
  }
});

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "";
  document.getElementById("status-user").textContent =
    state.user.fullName || state.user.username;
  document.getElementById("status-role").textContent = state.user.role;
  // Reset admin-only button visibility
  const actBtn = document.getElementById("activity-nav-btn");
  const usrBtn = document.getElementById("users-nav-btn");
  if (state.user.role === "admin") {
    if (actBtn) actBtn.style.display = "";
    if (usrBtn) usrBtn.style.display = "";
  } else {
    if (actBtn) actBtn.style.display = "none";
    if (usrBtn) usrBtn.style.display = "none";
  }
  // Load user permissions then apply page visibility, then render dashboard
  Promise.all([loadUserPermissions(), loadFeaturePermissions()]).then(() => {
    applyPageVisibility();
    switchView("dashboard");
  });
  // Nav buttons
  document.querySelectorAll(".activity-btn[data-view]").forEach((btn) => {
    btn.onclick = () => {
      const view = btn.dataset.view;
      // Settings always allowed, admin-only pages handled by switchView
      if (view === "settings" || view === "activity" || view === "users") {
        switchView(view);
      } else if (featureCan("page", view)) {
        switchView(view);
      } else {
        showAccessRestricted();
      }
    };
  });
  document.getElementById("logout-btn").onclick = logout;
}

async function loadFeaturePermissions() {
  try {
    state.featurePerms = await api("/api/feature-permissions/me");
  } catch (e) {
    state.featurePerms = { role: "user", features: {} };
  }
}

function featureCan(category, key) {
  if (state.user?.role === "admin") return true;
  if (!state.featurePerms || state.featurePerms.features === "all") return true;
  const feats = state.featurePerms.features;
  if (!feats || !feats[category]) return false;
  return !!feats[category][key];
}

/** Show a styled "Access Restricted" modal when a user clicks something they can't access */
function showAccessRestricted() {
  // Remove any existing modal
  const existing = document.getElementById("access-restricted-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "access-restricted-modal";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeIn .15s ease";
  overlay.innerHTML = `
    <div style="background:var(--bg-card,#1e1e2e);border:1px solid var(--border-subtle,#333);border-radius:12px;padding:32px 36px;max-width:360px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.4)">
      <div style="font-size:40px;margin-bottom:12px">🔒</div>
      <h3 style="color:var(--text-white,#fff);font-size:16px;margin:0 0 8px">Access Restricted</h3>
      <p style="color:var(--text-muted,#888);font-size:13px;margin:0 0 20px;line-height:1.5">You do not have permission to access this content.<br>Contact your Administrator for access.</p>
      <button onclick="this.closest('#access-restricted-modal').remove()" style="background:var(--accent,#007acc);color:#fff;border:none;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:13px">OK</button>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

/** Show a styled confirm modal that replaces browser confirm() dialogs. Returns a Promise<boolean>. */
function showConfirmModal(
  message,
  {
    title = "Confirm Action",
    icon = "⚠️",
    confirmText = "Yes, Proceed",
    cancelText = "Cancel",
    danger = false,
  } = {},
) {
  return new Promise((resolve) => {
    const existing = document.querySelector(".confirm-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal-box">
        <div class="confirm-modal-icon">${icon}</div>
        <h3 class="confirm-modal-title">${title}</h3>
        <p class="confirm-modal-msg">${message}</p>
        <div class="confirm-modal-actions">
          <button class="btn btn-sm confirm-modal-cancel">${cancelText}</button>
          <button class="btn btn-sm ${danger ? "btn-danger" : "btn-primary"} confirm-modal-ok">${confirmText}</button>
        </div>
      </div>
    `;
    const close = (val) => {
      overlay.remove();
      resolve(val);
    };
    overlay.querySelector(".confirm-modal-ok").onclick = () => close(true);
    overlay.querySelector(".confirm-modal-cancel").onclick = () => close(false);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    // Allow Escape to cancel
    const escHandler = (e) => {
      if (e.key === "Escape") {
        close(false);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
    document.body.appendChild(overlay);
    overlay.querySelector(".confirm-modal-ok").focus();
  });
}

/**
 * Show a form modal with labeled input fields. Returns a Promise that resolves with field values object or null if cancelled.
 * @param {Object} opts - { title, icon, fields: [{ key, label, type?, value?, placeholder?, options?:[{value,label}] }], confirmText, cancelText }
 */
function showFormModal({
  title = "Enter Details",
  icon = "📝",
  fields = [],
  confirmText = "Save",
  cancelText = "Cancel",
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector(".form-modal-overlay");
    if (existing) existing.remove();

    let fieldsHtml = fields
      .map((f) => {
        let inputHtml;
        if (f.type === "select") {
          const opts = (f.options || [])
            .map((o) =>
              typeof o === "string"
                ? `<option value="${escHtml(o)}"${o === f.value ? " selected" : ""}>${escHtml(o)}</option>`
                : `<option value="${escHtml(o.value)}"${o.value === f.value ? " selected" : ""}>${escHtml(o.label)}</option>`,
            )
            .join("");
          inputHtml = `<select data-field="${f.key}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-white);font-size:13px">${opts}</select>`;
        } else if (f.type === "textarea") {
          inputHtml = `<textarea data-field="${f.key}" rows="3" placeholder="${escHtml(f.placeholder || "")}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-white);font-size:13px;resize:vertical">${escHtml(f.value || "")}</textarea>`;
        } else if (f.type === "checkbox") {
          inputHtml = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-field="${f.key}" ${f.value ? "checked" : ""} style="width:16px;height:16px"><span style="color:var(--text-dim);font-size:13px">${escHtml(f.checkLabel || "Yes")}</span></label>`;
        } else {
          inputHtml = `<input type="${f.type || "text"}" data-field="${f.key}" value="${escHtml(String(f.value ?? ""))}" placeholder="${escHtml(f.placeholder || "")}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-white);font-size:13px" ${f.required ? "required" : ""}>`;
        }
        return `<div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:4px">${escHtml(f.label)}</label>
        ${inputHtml}
      </div>`;
      })
      .join("");

    const overlay = document.createElement("div");
    overlay.className = "form-modal-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeIn .15s ease";
    overlay.innerHTML = `
      <div class="confirm-modal-box" style="max-width:420px;width:90%">
        <div class="confirm-modal-icon">${icon}</div>
        <h3 class="confirm-modal-title">${title}</h3>
        <div style="text-align:left;width:100%;margin:12px 0">${fieldsHtml}</div>
        <div class="confirm-modal-actions">
          <button class="btn btn-sm confirm-modal-cancel">${cancelText}</button>
          <button class="btn btn-sm btn-primary confirm-modal-ok">${confirmText}</button>
        </div>
      </div>
    `;

    const close = (val) => {
      overlay.remove();
      resolve(val);
    };

    overlay.querySelector(".confirm-modal-ok").onclick = () => {
      const result = {};
      fields.forEach((f) => {
        const el = overlay.querySelector(`[data-field="${f.key}"]`);
        if (!el) return;
        if (f.type === "checkbox") {
          result[f.key] = el.checked;
        } else {
          result[f.key] = el.value;
        }
      });
      // Check required fields
      const missingRequired = fields.filter(
        (f) => f.required && !result[f.key]?.trim?.(),
      );
      if (missingRequired.length > 0) {
        const firstMissing = overlay.querySelector(
          `[data-field="${missingRequired[0].key}"]`,
        );
        if (firstMissing) {
          firstMissing.style.borderColor = "var(--red)";
          firstMissing.focus();
        }
        return;
      }
      close(result);
    };
    overlay.querySelector(".confirm-modal-cancel").onclick = () => close(null);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });
    const escHandler = (e) => {
      if (e.key === "Escape") {
        close(null);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
    document.body.appendChild(overlay);
    // Focus first input
    const firstInput = overlay.querySelector("input, select, textarea");
    if (firstInput) firstInput.focus();
  });
}

function applyPageVisibility() {
  if (state.user?.role === "admin") return; // Admin sees everything
  // Hide nav buttons for pages user doesn't have access to
  document.querySelectorAll(".activity-btn[data-view]").forEach((btn) => {
    const view = btn.dataset.view;
    if (view === "settings") return; // Settings always visible
    // Users and Activity are admin-only — always hide for non-admin
    if (view === "activity" || view === "users") {
      btn.style.display = "none";
      return;
    }
    btn.style.display = featureCan("page", view) ? "" : "none";
  });
}

async function loadUserPermissions() {
  try {
    const perms = await api("/api/permissions/me");
    state.permissions = perms;
  } catch (e) {
    state.permissions = [];
  }
}

function userCan(action, table) {
  if (state.user?.role === "admin") return true;
  if (!state.permissions || state.permissions.length === 0) return false;
  // Check table-specific first, then wildcard
  let perm = state.permissions.find(
    (p) => p.table_name === table && !p.record_id,
  );
  if (!perm)
    perm = state.permissions.find((p) => p.table_name === "*" && !p.record_id);
  if (!perm) return false;
  return !!perm[action];
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("epa_token");
  localStorage.removeItem("epa_user");
  showLogin();
}

// ── API Helper ───────────────────────────────────────────────
async function api(url, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ══════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════
function switchView(view, context) {
  loadFieldRenames(); // preload field rename cache
  // Check page permission (admin always passes, settings always allowed)
  if (view !== "settings" && view !== "activity" && view !== "users") {
    if (!featureCan("page", view)) {
      // Find the first allowed page and go there instead
      const firstAllowed = [
        "dashboard",
        "tables",
        "queries",
        "forms",
        "reports",
        "scanlog",
        "permitfilter",
        "records",
        "recordsAnalytics",
      ].find((p) => featureCan("page", p));
      if (firstAllowed && firstAllowed !== view) {
        switchView(firstAllowed);
        return;
      }
      // No pages allowed — show empty state
      document.getElementById("content").innerHTML = renderEmptyState(
        "No Access",
        "You do not have permission to access any pages. Contact your administrator.",
      );
      return;
    }
  }
  // Admin-only views
  if (
    (view === "activity" || view === "users") &&
    state.user?.role !== "admin"
  ) {
    return;
  }
  state.currentView = view;
  // Update activity bar
  document
    .querySelectorAll(".activity-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  // Update sidebar title
  const titles = {
    dashboard: "DASHBOARD",
    tables: "DATA TABLES",
    queries: "QUERIES",
    forms: "FORMS",
    reports: "REPORTS",
    scanlog: "SCAN LOG",
    permitfilter: "PERMIT FILTER",
    enrichment: "DATA ENRICHMENT",
    records: "RECORDS EXPLORER",
    recordsAnalytics: "RECORDS ANALYTICS",
    activity: "ACTIVITY LOG",
    users: "USERS",
    settings: "SETTINGS",
  };
  document.getElementById("sidebar-title").textContent =
    titles[view] || view.toUpperCase();
  // Store context for auto-navigation
  if (context) {
    if (context.autoQuery) state.autoRunQuery = context.autoQuery;
    if (context.autoTable) state.autoRunTable = context.autoTable;
  }
  // Render with transition
  const content = document.getElementById("content");
  if (content) {
    content.classList.remove("view-transition");
    // Force reflow to restart animation
    void content.offsetWidth;
    content.classList.add("view-transition");
  }
  const renderers = {
    dashboard: renderDashboard,
    tables: renderTablesView,
    queries: renderQueriesView,
    forms: renderFormView,
    reports: renderReportsView,
    scanlog: renderScanLogView,
    permitfilter: renderPermitFilterView,
    enrichment: renderEnrichmentView,
    records: renderRecordsView,
    recordsAnalytics: renderRecordsAnalyticsView,
    activity: renderActivityView,
    users: renderUsersView,
    settings: renderSettingsView,
  };
  if (renderers[view]) renderers[view]();
}

// ── Dashboard navigation helpers ─────────────────────────────
/** Navigate from a dashboard stat card — shows restricted modal if user lacks page access */
function dashCardNav(view, context) {
  if (featureCan("page", view)) {
    switchView(view, context);
  } else {
    showAccessRestricted();
  }
}

/** Navigate from a dashboard list item — shows restricted modal if user lacks table access */
function dashListItemClick(tableKey, recordId) {
  if (featureCan("page", "tables")) {
    switchView("tables", { autoTable: tableKey });
    setTimeout(() => showRecordModal(tableKey, recordId), 600);
  } else {
    showAccessRestricted();
  }
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
async function renderDashboard() {
  const sidebar = document.getElementById("sidebar-content");
  let sidebarHtml = `<div class="sidebar-item active" onclick="switchView('dashboard')"><span class="icon">📊</span><span class="label">Overview</span></div>`;
  if (featureCan("page", "tables"))
    sidebarHtml += `<div class="sidebar-item" onclick="switchView('tables')"><span class="icon">📋</span><span class="label">Data Tables</span></div>`;
  if (featureCan("page", "queries"))
    sidebarHtml += `<div class="sidebar-item" onclick="switchView('queries')"><span class="icon">🔍</span><span class="label">Queries</span></div>`;
  if (featureCan("page", "reports"))
    sidebarHtml += `<div class="sidebar-item" onclick="switchView('reports')"><span class="icon">📈</span><span class="label">Reports</span></div>`;
  sidebar.innerHTML = sidebarHtml;
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = `<div class="tab-item active">📊 Dashboard</div>`;
  content.innerHTML =
    '<div class="loading">Loading dashboard analytics...</div>';
  try {
    const d = await api("/api/dashboard");
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let dashHtml = `
      <!-- Welcome Banner -->
      <div class="dash-welcome">
        <div class="dash-welcome-left">
          <img src="/epa%20logo.png" alt="EPA" class="dash-welcome-logo" onerror="this.style.display='none'">
          <div>
            <h2 class="dash-welcome-title">Welcome back, ${escHtml(state.user.fullName || state.user.username)}</h2>
            <p class="dash-welcome-sub">EPA Database Management System</p>
            <div class="dash-welcome-date">${dateStr} &middot; ${timeStr}</div>
          </div>
        </div>
        <div class="dash-welcome-stats">
          <div class="dash-mini-stat"><span class="dash-mini-val">${(d.users || 0).toLocaleString()}</span><span class="dash-mini-lbl">Users</span></div>
          <div class="dash-mini-stat"><span class="dash-mini-val">${(d.recentActivity || 0).toLocaleString()}</span><span class="dash-mini-lbl">Actions (24h)</span></div>
        </div>
      </div>`;

    // ── Key Metrics ─────────────────────────────────────────
    if (featureCan("dashboard_widget", "metrics")) {
      const metrics = [
        {
          icon: "📋",
          value: d.PERMIT || 0,
          label: "Total Permits",
          color: "blue",
          click: "dashCardNav('tables',{autoTable:'PERMIT'})",
        },
        {
          icon: "✅",
          value: d.activePermits || 0,
          label: "Active Permits",
          color: "green",
          click: "dashCardNav('queries',{autoQuery:'ACTIVE_PERMITS'})",
        },
        {
          icon: "⚠️",
          value: d.expiredPermits || 0,
          label: "Expired Permits",
          color: "red",
          click: "dashCardNav('queries',{autoQuery:'EXPIRED_PERMITS'})",
        },
        {
          icon: "⏰",
          value: d.expiringSoon || 0,
          label: "Expiring Soon",
          color: "yellow",
          click: "dashCardNav('queries',{autoQuery:'PERMIT_EXPIRE_DAYS'})",
        },
        {
          icon: "📝",
          value: d.permitsIssued || 0,
          label: "Permits Issued",
          color: "orange",
          click: "dashCardNav('queries',{autoQuery:'PERMITS_ISSUED'})",
        },
        {
          icon: "🆕",
          value: d.newApplications || 0,
          label: "New Applications",
          color: "purple",
          click: "dashCardNav('queries',{autoQuery:'NEW_APPLICATIONS'})",
        },
        {
          icon: "🔄",
          value: d.renewals || 0,
          label: "Renewals",
          color: "teal",
          click: "dashCardNav('queries',{autoQuery:'RENEWALS'})",
        },
        {
          icon: "⚖️",
          value: d.complianceEnforcement || 0,
          label: "Compliance",
          color: "red",
          click:
            "dashCardNav('queries',{autoQuery:'ALL_COMPLIANCE_ENFORCEMENT'})",
        },
      ];

      dashHtml += `<div class="dash-section"><div class="dash-section-hdr"><span class="dash-section-title">Key Metrics</span></div><div class="dash-metrics-grid">`;
      metrics.forEach((m) => {
        dashHtml += `
          <div class="dash-metric dash-metric--${m.color}" onclick="${m.click}">
            <div class="dash-metric-top">
              <span class="dash-metric-icon">${m.icon}</span>
              <span class="dash-metric-value" data-count="${m.value}">${m.value.toLocaleString()}</span>
            </div>
            <div class="dash-metric-label">${m.label}</div>
            <div class="dash-metric-bar"><div class="dash-metric-bar-fill"></div></div>
          </div>`;
      });
      dashHtml += `</div></div>`;

      // Secondary stats row
      const secondary = [
        {
          icon: "🚗",
          value: d.MOVEMENT || 0,
          label: "Vehicle Records",
          click: "dashCardNav('tables',{autoTable:'MOVEMENT'})",
        },
        {
          icon: "♻️",
          value: d.WASTE || 0,
          label: "Waste Records",
          click: "dashCardNav('tables',{autoTable:'WASTE'})",
        },
        {
          icon: "📄",
          value: d.tbl_keyword || 0,
          label: "Documents",
          click: "dashCardNav('tables',{autoTable:'tbl_keyword'})",
        },
        {
          icon: "📦",
          value: d.Stores || 0,
          label: "Store Items",
          click: "dashCardNav('tables',{autoTable:'Stores'})",
        },
        {
          icon: "🏢",
          value: d.sekondiPermits || 0,
          label: "Sekondi Office",
          click: "dashCardNav('queries',{autoQuery:'SEKONDI_PERMITS'})",
        },
        {
          icon: "💰",
          value: d.paidProcessingFee || 0,
          label: "Paid Proc. Fee",
          click: "dashCardNav('queries',{autoQuery:'PAID_PROCESSING_FEE'})",
        },
        {
          icon: "💳",
          value: d.paidPermitFee || 0,
          label: "Paid Permit Fee",
          click: "dashCardNav('queries',{autoQuery:'PAID_PERMIT_FEE'})",
        },
      ];

      dashHtml += `<div class="dash-section"><div class="dash-section-hdr"><span class="dash-section-title">Secondary Stats</span></div><div class="dash-stats-row">`;
      secondary.forEach((s) => {
        dashHtml += `
          <div class="dash-stat-pill" onclick="${s.click}">
            <span class="dash-stat-pill-icon">${s.icon}</span>
            <span class="dash-stat-pill-val">${s.value.toLocaleString()}</span>
            <span class="dash-stat-pill-lbl">${s.label}</span>
          </div>`;
      });
      dashHtml += `</div></div>`;
    }

    // ── Charts Section ───────────────────────────────────────
    if (featureCan("dashboard_widget", "charts")) {
      dashHtml += `
      <div class="dash-section">
        <div class="dash-section-hdr"><span class="dash-section-title">Analytics</span></div>
        <div class="dash-charts-grid">
          <div class="dash-chart-card dash-chart-card--wide">
            <div class="dash-chart-hdr"><span>Monthly Permit Issuance</span></div>
            <canvas id="dash-trend-chart" height="200"></canvas>
          </div>
          <div class="dash-chart-card">
            <div class="dash-chart-hdr"><span>Permit Status</span></div>
            <canvas id="dash-donut-chart" height="220"></canvas>
            <div id="dash-donut-legend" class="dash-donut-legend"></div>
          </div>
          <div class="dash-chart-card">
            <div class="dash-chart-hdr"><span>Sectors / Classification</span></div>
            <div class="dash-hbar-list" id="dash-class-bars"></div>
          </div>
          <div class="dash-chart-card">
            <div class="dash-chart-hdr"><span>Top Districts</span></div>
            <div class="dash-hbar-list" id="dash-district-bars"></div>
          </div>
        </div>
      </div>`;
    }

    // ── Recent Activity ──────────────────────────────────────
    if (featureCan("dashboard_widget", "recent_activity")) {
      dashHtml += `
      <div class="dash-section">
        <div class="dash-section-hdr"><span class="dash-section-title">Recent Activity</span></div>
        <div class="dash-activity-card">
          <div class="dash-activity-list" id="dash-activity-list"></div>
        </div>
      </div>`;
    }

    // ── Attention Required ───────────────────────────────────
    const _showExpired = featureCan("dashboard_widget", "expired_permits");
    const _showExpiring = featureCan("dashboard_widget", "expiring_permits");
    if (_showExpired || _showExpiring) {
      dashHtml += `<div class="dash-section"><div class="dash-section-hdr"><span class="dash-section-title">Attention Required</span></div><div class="dash-attn-grid">`;
      if (_showExpired) {
        dashHtml += `
          <div class="dash-attn-card dash-attn-card--red">
            <div class="dash-attn-hdr"><span>⚠️ Expired Permits</span><span class="dash-attn-count">${(d.expiredPermitsList || []).length}</span></div>
            <input type="text" placeholder="Search expired..." oninput="filterQuickList('expired-list',this.value)" class="dash-attn-search">
            <div class="dash-attn-list" id="expired-list"></div>
          </div>`;
      }
      if (_showExpiring) {
        dashHtml += `
          <div class="dash-attn-card dash-attn-card--yellow">
            <div class="dash-attn-hdr"><span>⏰ Expiring Soon</span><span class="dash-attn-count">${(d.expiringSoonList || []).length}</span></div>
            <input type="text" placeholder="Search expiring..." oninput="filterQuickList('expiring-list',this.value)" class="dash-attn-search">
            <div class="dash-attn-list" id="expiring-list"></div>
          </div>`;
      }
      dashHtml += `</div></div>`;
    }

    content.innerHTML = dashHtml;

    // ── Populate Charts ──────────────────────────────────────
    if (featureCan("dashboard_widget", "charts")) {
      // Trend line chart
      drawTrendChart("dash-trend-chart", d.monthlyTrend || []);
      // Donut chart
      const validity = d.permitValidity || {};
      drawDonutChart("dash-donut-chart", "dash-donut-legend", [
        { label: "Active", value: validity.active || 0, color: "#4ade80" },
        { label: "Expired", value: validity.expired || 0, color: "#f87171" },
        {
          label: "Expiring Soon",
          value: validity.expiringSoon || 0,
          color: "#facc15",
        },
        { label: "No Date", value: validity.noDate || 0, color: "#64748b" },
      ]);
      // Classification horizontal bars
      renderHBars(
        "dash-class-bars",
        d.classificationBreakdown || [],
        (c) => c.classification,
        (c) => c.count,
      );
      // District horizontal bars
      renderHBars(
        "dash-district-bars",
        d.topDistricts || [],
        (c) => c.name,
        (c) => c.count,
      );
    }

    // ── Populate Activity ────────────────────────────────────
    if (featureCan("dashboard_widget", "recent_activity")) {
      const actEl = document.getElementById("dash-activity-list");
      if (actEl) {
        actEl.innerHTML =
          (d.recentActivityList || [])
            .map(
              (a) => `
            <div class="dash-act-row">
              <div class="dash-act-dot"></div>
              <div class="dash-act-body">
                <span class="dash-act-who">${escHtml(a.username)}</span>
                <span class="dash-act-what">${formatAction(a.action)}</span>
                ${a.target_name ? `<span class="dash-act-target">${escHtml(a.target_name)}</span>` : ""}
              </div>
              <span class="dash-act-time">${formatTimeAgo(a.created_at)}</span>
            </div>`,
            )
            .join("") || '<div class="dash-empty-msg">No recent activity</div>';
      }
    }

    // ── Populate Quick Lists ─────────────────────────────────
    if (featureCan("dashboard_widget", "expired_permits")) {
      const el = document.getElementById("expired-list");
      if (el) {
        el.innerHTML =
          (d.expiredPermitsList || [])
            .map(
              (p) => `
            <div class="quick-list-item" onclick="dashListItemClick('PERMIT',${p.id})">
              <span class="ql-name">${escHtml(p.RegisteredNameOfUndertaking || "N/A")}</span>
              <span class="ql-detail">${escHtml(p.PermitNumber || "")}</span>
              <span class="ql-badge expired">${formatDate(p.PermitExpirationDate)}</span>
            </div>`,
            )
            .join("") || '<div class="dash-empty-msg">No expired permits</div>';
      }
    }
    if (featureCan("dashboard_widget", "expiring_permits")) {
      const el = document.getElementById("expiring-list");
      if (el) {
        el.innerHTML =
          (d.expiringSoonList || [])
            .map(
              (p) => `
            <div class="quick-list-item" onclick="dashListItemClick('PERMIT',${p.id})">
              <span class="ql-name">${escHtml(p.RegisteredNameOfUndertaking || "N/A")}</span>
              <span class="ql-detail">${escHtml(p.PermitNumber || "")}</span>
              <span class="ql-badge warning">${formatDate(p.PermitExpirationDate)}</span>
            </div>`,
            )
            .join("") || '<div class="dash-empty-msg">None expiring soon</div>';
      }
    }

    // ── Animate metric counters ──────────────────────────────
    document
      .querySelectorAll(".dash-metric-value[data-count]")
      .forEach((el) => {
        animateCounter(el, parseInt(el.dataset.count) || 0);
      });

    // Real-time auto-refresh every 60 seconds
    if (window._dashRefreshTimer) clearInterval(window._dashRefreshTimer);
    window._dashRefreshTimer = setInterval(function () {
      if (document.querySelector(".dash-welcome")) refreshDashboardData();
      else clearInterval(window._dashRefreshTimer);
    }, 60000);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading dashboard</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

// ── Dashboard Canvas Drawing Helpers ────────────────────────

async function refreshDashboardData() {
  try {
    var d = await api("/api/dashboard");
    document.querySelectorAll(".dash-metric").forEach(function (el) {
      var lbl =
        (el.querySelector(".dash-metric-label") || {}).textContent || "";
      var valEl = el.querySelector(".dash-metric-value");
      if (!valEl) return;
      var map = {
        "Total Permits": d.PERMIT,
        "Active Permits": d.activePermits,
        "Expired Permits": d.expiredPermits,
        "Expiring Soon": d.expiringSoon,
        "Permits Issued": d.permitsIssued,
        "New Applications": d.newApplications,
        Renewals: d.renewals,
        Compliance: d.complianceEnforcement,
      };
      var val = map[lbl];
      if (val !== undefined && parseInt(valEl.dataset.count) !== val) {
        valEl.dataset.count = val;
        animateCounter(valEl, val);
      }
    });
    var pillMap = {
      "Vehicle Records": d.MOVEMENT,
      "Waste Records": d.WASTE,
      Documents: d.tbl_keyword,
      "Store Items": d.Stores,
      "Sekondi Office": d.sekondiPermits,
      "Paid Proc. Fee": d.paidProcessingFee,
      "Paid Permit Fee": d.paidPermitFee,
    };
    document.querySelectorAll(".dash-stat-pill").forEach(function (pill) {
      var lbl =
        (pill.querySelector(".dash-stat-pill-lbl") || {}).textContent || "";
      if (pillMap[lbl] !== undefined) {
        var valEl = pill.querySelector(".dash-stat-pill-val");
        if (valEl) valEl.textContent = (pillMap[lbl] || 0).toLocaleString();
      }
    });
    if (
      typeof drawTrendChart === "function" &&
      document.getElementById("dash-trend-chart")
    )
      drawTrendChart("dash-trend-chart", d.monthlyTrend || []);
    if (
      typeof drawDonutChart === "function" &&
      document.getElementById("dash-donut-chart")
    ) {
      var v = d.permitValidity || {};
      drawDonutChart("dash-donut-chart", "dash-donut-legend", [
        { label: "Active", value: v.active || 0, color: "#4ade80" },
        { label: "Expired", value: v.expired || 0, color: "#f87171" },
        {
          label: "Expiring Soon",
          value: v.expiringSoon || 0,
          color: "#facc15",
        },
        { label: "No Date", value: v.noDate || 0, color: "#64748b" },
      ]);
    }
    if (typeof renderHBars === "function") {
      if (document.getElementById("dash-class-bars"))
        renderHBars(
          "dash-class-bars",
          d.classificationBreakdown || [],
          function (r) {
            return r.classification;
          },
          function (r) {
            return r.count;
          },
        );
      if (document.getElementById("dash-district-bars"))
        renderHBars(
          "dash-district-bars",
          (d.topDistricts || d.districtBreakdown || []).slice(0, 10),
          function (r) {
            return r.name || r.district;
          },
          function (r) {
            return r.count;
          },
        );
    }
    document.querySelectorAll(".dash-mini-stat").forEach(function (el) {
      var lbl = (el.querySelector(".dash-mini-lbl") || {}).textContent || "";
      var valEl = el.querySelector(".dash-mini-val");
      if (lbl === "Users" && valEl)
        valEl.textContent = (d.users || 0).toLocaleString();
      if (lbl === "Actions (24h)" && valEl)
        valEl.textContent = (d.recentActivity || 0).toLocaleString();
    });
    var now = new Date();
    var dateEl = document.querySelector(".dash-welcome-date");
    if (dateEl)
      dateEl.textContent =
        now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }) +
        " \u00B7 " +
        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    console.log("Dashboard refresh error:", e.message);
  }
}

function animateCounter(el, target) {
  if (target === 0) return;
  const duration = 800;
  const start = performance.now();
  const fmt = (n) => n.toLocaleString();
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(Math.round(ease * target));
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function drawTrendChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width,
    H = rect.height;
  const pad = { top: 20, right: 20, bottom: 38, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const stepX = plotW / Math.max(data.length - 1, 1);

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = pad.top + (plotH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "10px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(
      Math.round(maxVal - (maxVal / gridSteps) * i).toLocaleString(),
      pad.left - 6,
      y + 3,
    );
  }

  // Area fill
  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  gradient.addColorStop(0, "rgba(59,130,246,0.30)");
  gradient.addColorStop(1, "rgba(59,130,246,0.02)");
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);
  data.forEach((d, i) => {
    const x = pad.left + i * stepX;
    const y = pad.top + plotH - (d.count / maxVal) * plotH;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + (data.length - 1) * stepX, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad.left + i * stepX;
    const y = pad.top + plotH - (d.count / maxVal) * plotH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Dots + labels
  data.forEach((d, i) => {
    const x = pad.left + i * stepX;
    const y = pad.top + plotH - (d.count / maxVal) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Month label
    const parts = d.month.split("-");
    const lbl =
      [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][parseInt(parts[1]) - 1] || parts[1];
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(lbl, x, H - pad.bottom + 16);
  });
}

function drawDonutChart(canvasId, legendId, segments) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const size = Math.min(rect.width, rect.height);
  const cx = rect.width / 2,
    cy = size / 2;
  const radius = size * 0.38;
  const lineW = size * 0.11;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No data", cx, cy);
    return;
  }
  let angle = -Math.PI / 2;
  segments.forEach((seg) => {
    const sweep = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + sweep);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = seg.color;
    ctx.lineCap = "butt";
    ctx.stroke();
    angle += sweep;
  });
  // Center text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(total.toLocaleString(), cx, cy - 6);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px system-ui";
  ctx.fillText("Total Permits", cx, cy + 14);

  // Legend
  const legendEl = document.getElementById(legendId);
  if (legendEl) {
    legendEl.innerHTML = segments
      .map(
        (s) =>
          `<div class="dash-donut-leg-item"><span class="dash-donut-leg-dot" style="background:${s.color}"></span>${s.label} <strong>${s.value.toLocaleString()}</strong></div>`,
      )
      .join("");
  }
}

function renderHBars(containerId, data, labelFn, valueFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const top = data.slice(0, 10);
  const maxVal = Math.max(...top.map(valueFn), 1);
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#ef4444",
    "#ec4899",
    "#14b8a6",
    "#6366f1",
    "#f97316",
  ];
  el.innerHTML =
    top
      .map(
        (item, i) => `
      <div class="dash-hbar-row">
        <span class="dash-hbar-label" title="${escHtml(String(labelFn(item)))}">${escHtml(truncate(String(labelFn(item)), 20))}</span>
        <div class="dash-hbar-track">
          <div class="dash-hbar-fill" style="width:${Math.max(3, (valueFn(item) / maxVal) * 100)}%;background:${colors[i % colors.length]}">
            <span>${valueFn(item).toLocaleString()}</span>
          </div>
        </div>
      </div>`,
      )
      .join("") || '<div class="dash-empty-msg">No data available</div>';
}

// Dashboard navigation helpers — permission-aware
function dashNavExpired() {
  dashCardNav("queries", { autoQuery: "EXPIRED_PERMITS" });
}
function dashNavExpiringSoon() {
  dashCardNav("queries", { autoQuery: "PERMIT_EXPIRE_DAYS" });
}

function filterQuickList(listId, term) {
  const list = document.getElementById(listId);
  if (!list) return;
  const items = list.querySelectorAll(".quick-list-item");
  const t = term.toLowerCase().trim();
  items.forEach((item) => {
    item.style.display =
      !t || item.textContent.toLowerCase().includes(t) ? "" : "none";
  });
}

// ══════════════════════════════════════════════════════════════
//  DATA TABLES VIEW
// ══════════════════════════════════════════════════════════════
async function renderTablesView() {
  const sidebar = document.getElementById("sidebar-content");
  sidebar.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const data = await api("/api/tables");
    state.tables = data.tables;
    state.tableCounts = data.counts;
    const tableLabels = {
      PERMIT: "📋 Permits",
      MOVEMENT: "🚗 Movements",
      WASTE: "♻️ Waste",
      Stores: "📦 Stores",
      tbl_keyword: "📄 Environmental Reports Submission",
    };
    sidebar.innerHTML = data.tables
      .map(
        (t) => `
      <div class="sidebar-item${state.currentTable === t ? " active" : ""}" onclick="selectTable('${t}')">
        <span class="icon">${(tableLabels[t] || t).split(" ")[0]}</span>
        <span class="label">${(tableLabels[t] || t).split(" ").slice(1).join(" ") || t}</span>
        <span class="badge-count">${(data.counts[t] || 0).toLocaleString()}</span>
      </div>
    `,
      )
      .join("");

    // Auto-select table if coming from dashboard
    if (state.autoRunTable) {
      const t = state.autoRunTable;
      state.autoRunTable = null;
      selectTable(t);
    } else if (data.tables.length > 0) {
      // Auto-select the first table
      selectTable(data.tables[0]);
    } else {
      // Show empty state — no tables
      const content = document.getElementById("content");
      const tabBar = document.getElementById("tab-bar");
      tabBar.innerHTML = '<div class="tab-item active">📋 Data Tables</div>';
      content.innerHTML = renderEmptyState(
        "No Tables",
        "No data tables found in the database",
      );
    }
  } catch (err) {
    sidebar.innerHTML = `<div style="padding:16px;color:var(--red)">${err.message}</div>`;
  }
}

function selectTable(table) {
  state.currentTable = table;
  state.currentPage = 1;
  state.searchTerm = "";
  // Update sidebar active
  document
    .querySelectorAll(".sidebar-content .sidebar-item")
    .forEach((el, i) => {
      el.classList.toggle("active", state.tables[i] === table);
    });
  loadTableData();
}

async function loadTableData() {
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  const table = state.currentTable;
  if (!table) {
    content.innerHTML = renderEmptyState(
      "Select a Table",
      "Choose a table from the sidebar to view its records",
    );
    return;
  }
  tabBar.innerHTML = `<div class="tab-item active">📋 ${table}</div>`;
  content.innerHTML = '<div class="loading">Loading records...</div>';
  try {
    const params = new URLSearchParams({
      page: state.currentPage,
      limit: 50,
      search: state.searchTerm,
      sort: state.sortCol,
      dir: state.sortDir,
    });
    const data = await api(`/api/data/${table}?${params}`);
    state.totalPages = data.pages;
    state.totalRows = data.total;
    const titleCol = getCardTitleCol(table);
    const fields = getCardFields(table);

    let html = `
      <div class="search-bar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="search" id="table-search" placeholder="Search ${table}..." value="${escHtml(state.searchTerm)}" oninput="handleTableSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();handleTableSearchServer(this.value)}">
        </div>
        <span class="search-info">${data.total.toLocaleString()} record${data.total !== 1 ? "s" : ""}</span>
        <button class="btn btn-sm" onclick="exportTable('${table}','csv')" title="Export CSV">📥 CSV</button>
        <button class="btn btn-sm" onclick="exportTable('${table}','xlsx')" title="Export Excel">📊 Excel</button>
        ${userCan("can_create", table) ? `<button class="btn btn-primary btn-sm" onclick="showNewRecordModal('${table}')">+ New Record</button>` : ""}
      </div>
    `;

    if (data.rows.length === 0) {
      html += renderEmptyState(
        "No Records Found",
        state.searchTerm
          ? "Try a different search term"
          : "This table has no records",
      );
    } else {
      html += '<div class="data-cards">';
      data.rows.forEach((row) => {
        const title = row[titleCol] || `Record #${row.id}`;
        const selClass = state.selectedRecords.has(row.id) ? " selected" : "";
        html += `<div class="data-card${selClass}" data-id="${row.id}" style="position:relative" onclick="showRecordModal('${table}',${row.id})" oncontextmenu="showContextMenu(event,'${table}',${row.id})">`;
        html += `<div class="select-check">✓</div>`;
        html += `<div class="data-card-header"><div class="data-card-title">${escHtml(String(title))}</div><div class="data-card-id">${row._attachmentCount ? `<span class="att-badge" title="${row._attachmentCount} attachment(s)">📎 ${row._attachmentCount}</span>` : ""}#${row.id}</div></div>`;
        html += '<div class="data-card-fields">';
        fields.forEach((f) => {
          if (row[f] !== null && row[f] !== undefined && row[f] !== "") {
            const fLabel =
              table === "PERMIT"
                ? getPermitLabel(f)
                : table === "tbl_keyword"
                  ? getKeywordLabel(f)
                  : humanize(f);
            html += `<div class="data-card-field"><span class="field-label">${fLabel}</span><span class="field-value">${formatCellValue(row[f], f)}</span></div>`;
          }
        });
        html += "</div>";
        // Status tags
        const tags = getStatusTags(row, table);
        if (tags.length) {
          html += '<div class="data-card-status">' + tags.join("") + "</div>";
        }
        html += "</div>";
      });
      html += "</div>";
    }
    // Pagination
    if (data.pages > 1) {
      html += renderPagination(data);
    }
    // Preserve search focus and cursor position across re-renders
    const activeEl = document.activeElement;
    const wasSearchFocused = activeEl && activeEl.id === "table-search";
    const cursorPos = wasSearchFocused ? activeEl.selectionStart : 0;

    content.innerHTML = html;

    // Restore focus to search input if it was focused before re-render
    if (wasSearchFocused) {
      const newInput = document.getElementById("table-search");
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(cursorPos, cursorPos);
      }
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function handleTableSearch(val) {
  state.searchTerm = val;
  const lowerTerm = val.toLowerCase();
  const cards = document.querySelectorAll(".data-card");
  let visibleCount = 0;
  cards.forEach((card) => {
    if (!val) {
      card.classList.remove("hidden");
      card.classList.remove("search-highlight");
      visibleCount++;
      return;
    }
    // Search across card title, field labels and field values
    const title =
      (card.querySelector(".data-card-title") || {}).textContent || "";
    const fieldsText =
      (card.querySelector(".data-card-fields") || {}).textContent || "";
    const statusText =
      (card.querySelector(".data-card-status") || {}).textContent || "";
    const allText = (title + " " + fieldsText + " " + statusText).toLowerCase();
    const match = allText.includes(lowerTerm);
    card.classList.toggle("hidden", !match);
    card.classList.toggle("search-highlight", match);
    if (match) visibleCount++;
  });
  // Update the search info count
  const info = document.querySelector(".search-info");
  if (info) {
    if (!val) {
      info.textContent = `${state.totalRows.toLocaleString()} record${state.totalRows !== 1 ? "s" : ""}`;
    } else {
      info.textContent = `${visibleCount} of ${cards.length} shown (type Enter to search all ${state.totalRows.toLocaleString()})`;
    }
  }
}

// Full server-side search on Enter key — searches across all pages
function handleTableSearchServer(val) {
  state.searchTerm = val;
  state.currentPage = 1;
  loadTableData();
}

function changePage(p) {
  state.currentPage = p;
  loadTableData();
}

// ══════════════════════════════════════════════════════════════
//  RECORD MODAL (Accordion + Search)
// ══════════════════════════════════════════════════════════════

// ── PERMIT field display labels ──────────────────────────────
const PERMIT_FIELD_LABELS = {
  FileNumber: "File Number",
  NameofFile: "Name of File",
  FileLocation: "File Storage Location",
  OfficerWorkingOnFile: "Officer Working on File",
  RegisteredNameOfUndertaking: "Name",
  ClassificationOfUndertaking: "Sector",
  CategoryOfFile: "Category of File",
  FacilityLocation: "Location",
  District: "District",
  Jurisdiction: "Jurisdiction",
  Latitude: "Latitude",
  Longitude: "Longitude",
  PermitHolder: "Permit Holder",
  ContactPerson: "Contact Person",
  TelephoneNumber: "Telephone Number",
  Email: "Email",
  DateOfReceiptOfApplication: "Date of Receipt of Application",
  Screening: "Screening",
  Screening_Date: "Date of Screening",
  DateOfReceiptOfDraft: "Date of Receipt of Draft",
  DateOfReceiptOfRevised: "Date of Receipt of Revised",
  DateReviewCommentWasSentToProponent: "Date Review Comment Sent",
  DateOfSubmissionOfEMP: "Date of Submission of EMP",
  DateOfTRC: "Date of TRC",
  DateSentToHeadOffice: "Date Sent to Head Office",
  DateReceivedFromHeadOffice: "Date Received from Head Office",
  PermitNumber: "Permit Number",
  DateOfIssueOfPermit: "Date of Issue",
  PermitExpirationDate: "Date of Expiry",
  PermitRenewalDate: "Permit Renewal Date",
  PermitIssued: "Permit Issued",
  PermittedBy: "Permitted By",
  Permitted_by_Sekondi_Office: "Permitted by Sekondi Office",
  ProcessingFee: "Processing Fee",
  DateOfIssueOfProcessingFee: "Date of Issue of Processing Fee",
  DateOfPaymentOfProcessingFee: "Date of Payment of Processing Fee",
  PermitFee: "Permit Fee",
  DateOfIssueOfPermitFee: "Date of Issue of Permit Fee",
  DateOfPaymentOfPermitFee: "Date of Payment of Permit Fee",
  InvoiceNumber: "Invoice Number",
  DateOfIssueOfInvioce: "Date of Issue of Invoice",
  AmountToPay: "Amount to Pay",
  FirstAmountPaid: "First Amount Paid",
  FirstBalanceToPay: "First Balance to Pay",
  DateOfFirstPayment: "Date of First Payment",
  SecondAmountPaid: "Second Amount Paid",
  SecondBalanceToPay: "Second Balance to Pay",
  DateOfSecondPayment: "Date of Second Payment",
  FinalAmountPaid: "Final Amount Paid",
  FinalBalance: "Final Balance",
  DateOfThirdPayment: "Date of Third Payment",
  TotalAmount: "Total Amount",
  DueDateForPayment: "Due Date for Payment",
  DateCompanyRequiresToPayPermitFee: "Date Company Requires to Pay",
  DuePaymentDays: "Due Payment Days",
  DaysAfterPayment: "Days After Payment",
  DaysAfterSecondPayment: "Days After Second Payment",
  DaysAfterFinalPayment: "Days After Final Payment",
  DaysSpentForPermitToBeProcessed: "Days for Permit Processing",
  ApplicationStatusII: "Application Info",
  ApplicationStatus: "Application Status",
  Compliance: "Compliance",
  ComplianceDate: "Compliance Date",
  SubmissionOfAnnualEnvironmentalReport: "Annual Environmental Report",
  SubmissionOfQuartelyEnvironmentalMonitoringReport:
    "Quarterly Monitoring Report",
  DueDateForReporting: "Due Date for Reporting",
  DateCompanyRequiresToSubmitReviceReport:
    "Date Company Requires to Submit Report",
  ReportingDays: "Reporting Days",
  DaysAfterReporting: "Days After Reporting",
  DateEnforcementLetterIssued: "Date Enforcement Letter Issued",
  ActualDateReported: "Actual Date Reported",
  DateReturned: "Date Returned",
  FileReturned: "File Returned",
  DateReceived: "Date Received",
  DateEmailSent: "Date Email Sent",
  Notification: "Notification",
  DocumentAttached: "Document Attached",
  StatusOrComments: "Status / Comments",
  Remarks: "Remarks",
};

function getPermitLabel(field) {
  return PERMIT_FIELD_LABELS[field] || humanize(field);
}

async function showRecordModal(table, id) {
  showProgressBar();
  try {
    const row = await api(`/api/data/${table}/${id}`);

    // Use special PERMIT modal layout
    if (table === "PERMIT") {
      showPermitRecordModal(row, id);
      return;
    }

    // Use modern modal for tbl_keyword (Environmental Reports)
    if (table === "tbl_keyword") {
      showKeywordRecordModal(row, id);
      return;
    }

    // Default modal for non-PERMIT tables
    const sections = await buildSections(
      Object.keys(row).filter((k) => k !== "id"),
      table,
    );
    let modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    let html = `<div class="modal">
    <div class="modal-header">
      <h3>${table} · Record #${id}</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <div class="modal-search-bar">
      <div class="modal-search-wrapper">
        <span class="modal-search-icon">🔍</span>
        <input type="search" id="modal-field-search" placeholder="Search fields..." oninput="filterModalFields(this.value)">
      </div>
    </div>
    <div class="modal-body">`;

    sections.forEach((sec, idx) => {
      const secFields = sec.fields.filter((f) => row.hasOwnProperty(f));
      if (secFields.length === 0) return;
      html += `<div class="record-section" data-section="${idx}">
      <div class="record-section-title" onclick="toggleSection(this)">
        <span class="section-icon">📁</span>
        <span class="section-label">${sec.title} <span style="color:var(--text-muted);font-weight:400">(${secFields.length})</span></span>
        <span class="section-chevron">▶</span>
      </div>
      <div class="record-section-fields">`;
      secFields.forEach((f) => {
        const val = row[f];
        html += `<div class="record-field" data-field="${f.toLowerCase()}">
        <span class="field-name">${humanize(f)}</span>
        <span class="field-val">${formatCellValue(val, f)}</span>
      </div>`;
      });
      html += "</div></div>";
    });

    // Documents & Files
    html += `<div id="record-documents" class="record-section" data-section="documents">
      <div class="record-section-title" onclick="toggleSection(this)">
        <span class="section-icon">📎</span>
        <span class="section-label">Documents &amp; Files <span id="docs-count" style="color:var(--text-muted);font-weight:400"></span></span>
        <span class="section-chevron">▶</span>
      </div>
      <div class="record-section-fields" id="documents-container">
        <div style="padding:12px;color:var(--text-muted)">Loading documents...</div>
      </div>
    </div>`;

    html += `</div>
    <div class="modal-footer">
      ${userCan("can_edit", table) ? `<button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove(); showEditRecordModal('${table}',${id})">✏️ Edit</button>` : ""}
      ${userCan("can_delete", table) ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('${table}',${id})">🗑️ Delete</button>` : ""}
      <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>
  </div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);
    loadUnifiedDocuments(table, id, row);
  } catch (err) {
    toast("Failed to load record: " + err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ── Modern PERMIT Record Modal ───────────────────────────────
function showPermitRecordModal(row, id) {
  const v = (f) => {
    const val = row[f];
    return val != null && val !== ""
      ? escHtml(String(val))
      : '<span class="pm-empty">—</span>';
  };
  const fv = (f) => {
    const val = row[f];
    return val != null && val !== ""
      ? formatCellValue(val, f)
      : '<span class="pm-empty">—</span>';
  };

  // Status badge
  const status = row.ApplicationStatus || "";
  const statusClass = status.toLowerCase().includes("issued")
    ? "pm-badge-green"
    : status.toLowerCase().includes("denied") ||
        status.toLowerCase().includes("closed")
      ? "pm-badge-red"
      : status.toLowerCase().includes("review") ||
          status.toLowerCase().includes("required")
        ? "pm-badge-amber"
        : "pm-badge-blue";

  const companyName =
    row.RegisteredNameOfUndertaking || "Unnamed Establishment";
  const sector = row.ClassificationOfUndertaking || "";
  const permitNo = row.PermitNumber || "";
  const screening = row.Screening || (row.Screening_Date ? "Done" : "Not Done");

  let modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  // Store row data on the modal for section editing
  modal._pmRow = row;
  modal._pmId = id;
  modal._pmTable = "PERMIT";

  let html = `<div class="modal pm-modal">
  <!-- Header Bar -->
  <div class="pm-header">
    <div class="pm-header-left">
      <div class="pm-header-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </div>
      <div>
        <h3 class="pm-title">${escHtml(companyName)}</h3>
        <div class="pm-subtitle">${permitNo ? escHtml(permitNo) + " · " : ""}Record #${id}${sector ? " · " + escHtml(sector) : ""}</div>
      </div>
    </div>
    <div class="pm-header-right">
      ${status ? `<span class="pm-badge ${statusClass}">${escHtml(status)}</span>` : ""}
      <!-- Three dots menu -->
      <div class="pm-dots-menu">
        <button class="pm-dots-btn" onclick="togglePmDotsMenu(this)" title="More actions">⋮</button>
        <div class="pm-dots-dropdown">
          ${userCan("can_delete", "PERMIT") ? `<div class="pm-dots-item pm-dots-danger" onclick="deleteRecord('PERMIT',${id})"><span>🗑️</span> Delete Record</div>` : ""}
          <div class="pm-dots-item" onclick="exportSinglePermit(${id})"><span>📥</span> Export Record</div>
        </div>
      </div>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
  </div>

  <div class="pm-body">
    <!-- LEFT COLUMN -->
    <div class="pm-col pm-col-left">

      <!-- File Information -->
      <div class="pm-card" data-pm-section="file-info" data-pm-fields="FileNumber,FileLocation,OfficerWorkingOnFile" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          File Information
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">File Number</span><span class="pm-value">${v("FileNumber")}</span></div>
            <div class="pm-field"><span class="pm-label">File Storage Location</span><span class="pm-value">${v("FileLocation")}</span></div>
            <div class="pm-field"><span class="pm-label">Officer Working on File</span><span class="pm-value">${v("OfficerWorkingOnFile")}</span></div>
          </div>
        </div>
      </div>

      <!-- Establishment Information -->
      <div class="pm-card" data-pm-section="establishment" data-pm-fields="RegisteredNameOfUndertaking,ClassificationOfUndertaking,FacilityLocation,District,Jurisdiction,Latitude,Longitude" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Establishment Information
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Name</span><span class="pm-value pm-value-prominent">${v("RegisteredNameOfUndertaking")}</span></div>
            <div class="pm-field"><span class="pm-label">Sector</span><span class="pm-value">${v("ClassificationOfUndertaking")}</span></div>
            <div class="pm-field"><span class="pm-label">Location</span><span class="pm-value">${v("FacilityLocation")}</span></div>
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">District</span><span class="pm-value">${v("District")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Jurisdiction</span><span class="pm-value">${v("Jurisdiction")}</span></div>
            </div>
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">Latitude</span><span class="pm-value pm-value-mono">${v("Latitude")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Longitude</span><span class="pm-value pm-value-mono">${v("Longitude")}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Information -->
      <div class="pm-card" data-pm-section="contact" data-pm-fields="PermitHolder,ContactPerson,TelephoneNumber,Email" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Contact Information
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Permit Holder</span><span class="pm-value">${v("PermitHolder")}</span></div>
            <div class="pm-field"><span class="pm-label">Contact Person</span><span class="pm-value">${v("ContactPerson")}</span></div>
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">Telephone</span><span class="pm-value">${v("TelephoneNumber")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Email</span><span class="pm-value">${v("Email")}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents (read-only, right-click to edit) -->
      <div class="pm-card" id="record-documents" data-pm-section="documents" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.49"/></svg>
          Documents &amp; Files <span id="docs-count" style="color:var(--text-muted);font-weight:400;font-size:12px"></span>
        </div>
        <div class="pm-card-content">
          <div id="documents-container">
            <div style="padding:8px 0;color:var(--text-muted);font-size:12px">Loading documents...</div>
          </div>
        </div>
      </div>

    </div>

    <!-- RIGHT COLUMN -->
    <div class="pm-col pm-col-right">

      <!-- Application Details -->
      <div class="pm-card" data-pm-section="application" data-pm-fields="DateOfReceiptOfApplication,Screening,Screening_Date" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Application Details
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Date of Receipt</span><span class="pm-value">${fv("DateOfReceiptOfApplication")}</span></div>
            <div class="pm-field"><span class="pm-label">Screening</span><span class="pm-value"><span class="pm-badge ${screening === "Done" ? "pm-badge-green" : "pm-badge-amber"}" style="font-size:11px">${escHtml(screening)}</span></span></div>
            ${screening === "Done" || row.Screening_Date ? `<div class="pm-field"><span class="pm-label">Date of Screening</span><span class="pm-value">${fv("Screening_Date")}</span></div>` : ""}
          </div>
        </div>
      </div>

      <!-- Permit Details -->
      <div class="pm-card" data-pm-section="permit" data-pm-fields="PermitNumber,DateOfIssueOfPermit,PermitExpirationDate,PermittedBy" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Permit Details
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Permit Number</span><span class="pm-value pm-value-prominent">${v("PermitNumber")}</span></div>
            <div class="pm-field"><span class="pm-label">Date of Issue</span><span class="pm-value">${fv("DateOfIssueOfPermit")}</span></div>
            <div class="pm-field"><span class="pm-label">Date of Expiry</span><span class="pm-value">${fv("PermitExpirationDate")}</span></div>
            <div class="pm-field"><span class="pm-label">Permitted By</span><span class="pm-value">${v("PermittedBy") !== '<span class="pm-empty">—</span>' ? v("PermittedBy") : v("Permitted_by_Sekondi_Office") !== '<span class="pm-empty">—</span>' ? (row.Permitted_by_Sekondi_Office === "Yes" ? "Sekondi Office" : "Head Office") : '<span class="pm-empty">—</span>'}</span></div>
          </div>
        </div>
      </div>

      <!-- Status -->
      <div class="pm-card" data-pm-section="status" data-pm-fields="ApplicationStatusII,ApplicationStatus" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Status
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Application Info</span><span class="pm-value">${v("ApplicationStatusII")}</span></div>
            <div class="pm-field"><span class="pm-label">Application Status</span><span class="pm-value">${status ? `<span class="pm-badge ${statusClass}" style="font-size:11px">${escHtml(status)}</span>` : '<span class="pm-empty">—</span>'}</span></div>
          </div>
        </div>
      </div>

      <!-- Fees -->
      <div class="pm-card" data-pm-section="fees" data-pm-fields="ProcessingFee,DateOfPaymentOfProcessingFee,PermitFee,DateOfPaymentOfPermitFee" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Fees
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">Processing Fee</span><span class="pm-value">${v("ProcessingFee")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Permit Fee</span><span class="pm-value">${v("PermitFee")}</span></div>
            </div>
            <div class="pm-field"><span class="pm-label">Payment (Processing)</span><span class="pm-value">${fv("DateOfPaymentOfProcessingFee")}</span></div>
            <div class="pm-field"><span class="pm-label">Payment (Permit)</span><span class="pm-value">${fv("DateOfPaymentOfPermitFee")}</span></div>
          </div>
        </div>
      </div>

      <!-- Compliance -->
      <div class="pm-card" data-pm-section="compliance" data-pm-fields="Compliance,ComplianceDate" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Compliance
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Compliance</span><span class="pm-value">${v("Compliance")}</span></div>
            <div class="pm-field"><span class="pm-label">Compliance Date</span><span class="pm-value">${fv("ComplianceDate")}</span></div>
          </div>
        </div>
      </div>

      <!-- File Movement -->
      <div class="pm-card" data-pm-section="movement" data-pm-fields="FileReturned,DateReturned,DateReceived" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          File Movement
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">File Returned</span><span class="pm-value">${v("FileReturned")}</span></div>
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">Date Returned</span><span class="pm-value">${fv("DateReturned")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Date Received</span><span class="pm-value">${fv("DateReceived")}</span></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Footer -->
  <div class="pm-footer">
    <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Close</button>
  </div>
</div>`;

  modal.innerHTML = html;
  document.body.appendChild(modal);
  // Load documents in read-only mode (no upload zone)
  loadUnifiedDocumentsReadOnly("PERMIT", id, row);
}

// ── Three-dots menu toggle ───────────────────────────────────
function togglePmDotsMenu(btn) {
  const dd = btn.nextElementSibling;
  const wasOpen = dd.classList.contains("open");
  // Close any open menus first
  document
    .querySelectorAll(".pm-dots-dropdown.open")
    .forEach((d) => d.classList.remove("open"));
  if (!wasOpen) dd.classList.add("open");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".pm-dots-menu")) {
    document
      .querySelectorAll(".pm-dots-dropdown.open")
      .forEach((d) => d.classList.remove("open"));
  }
});

// ── Export single permit record ──────────────────────────────
async function exportSinglePermit(id) {
  document
    .querySelectorAll(".pm-dots-dropdown.open")
    .forEach((d) => d.classList.remove("open"));
  showProgressBar();
  try {
    const res = await fetch("/api/permit-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.token,
      },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Permit_${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Record exported", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ── Right-click context menu for PM sections ─────────────────
function showPmSectionMenu(e, card) {
  e.preventDefault();
  e.stopPropagation();
  // Remove any existing context menus
  document.querySelectorAll(".pm-ctx-menu").forEach((m) => m.remove());

  if (!userCan("can_edit", "PERMIT")) return;
  // Don't show if already in edit mode
  if (card.classList.contains("pm-editing")) return;

  const menu = document.createElement("div");
  menu.className = "pm-ctx-menu";
  menu.innerHTML = `<div class="pm-ctx-item" onclick="startPmSectionEdit(this)">✏️ Edit</div>`;
  menu.style.left = e.clientX + "px";
  menu.style.top = e.clientY + "px";
  menu._pmCard = card;
  document.body.appendChild(menu);

  // Position adjustment if off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth)
    menu.style.left = e.clientX - rect.width + "px";
  if (rect.bottom > window.innerHeight)
    menu.style.top = e.clientY - rect.height + "px";

  // Close on click outside
  setTimeout(() => {
    document.addEventListener("click", function closePmCtx(ev) {
      if (!ev.target.closest(".pm-ctx-menu")) {
        menu.remove();
        document.removeEventListener("click", closePmCtx);
      }
    });
  }, 0);
}

// ── Start editing a PM section in-place ──────────────────────
async function startPmSectionEdit(menuItem) {
  const menu = menuItem.closest(".pm-ctx-menu");
  const card = menu._pmCard;
  menu.remove();
  if (!card) return;

  const section = card.dataset.pmSection;
  const modal = card.closest(".modal-overlay");
  const row = modal._pmRow;
  const id = modal._pmId;
  const table = modal._pmTable || "PERMIT";

  // Documents section — show upload zone
  if (section === "documents") {
    enableDocumentsEditMode(card, table, id, row);
    return;
  }

  // Get field list from data attribute
  const fieldNames = (card.dataset.pmFields || "").split(",").filter(Boolean);
  if (!fieldNames.length) return;

  // Load field options
  const fieldOptions = await getFieldOptions(table);

  // Mark as editing
  card.classList.add("pm-editing");

  // Build edit form in pm-card-content
  const contentEl = card.querySelector(".pm-card-content");
  const originalHTML = contentEl.innerHTML;

  let formHtml = '<div class="pm-edit-fields">';
  fieldNames.forEach((f) => {
    const val = row[f] ?? "";
    if (section === "application" && f === "Screening") {
      formHtml += renderPermitFormField(
        f,
        val || "Not Done",
        fieldOptions,
        null,
        'onchange="toggleScreeningDate(this)"',
        table,
      );
      const showDate = val === "Done" || row.Screening_Date;
      formHtml += `<div id="screening-date-group" style="${showDate ? "" : "display:none"}">${renderPermitFormField("Screening_Date", row.Screening_Date || "", fieldOptions, null, "", table)}</div>`;
    } else if (section === "application" && f === "Screening_Date") {
      // already rendered above
    } else {
      formHtml += renderPermitFormField(f, val, fieldOptions, null, "", table);
    }
  });
  formHtml += "</div>";
  formHtml += `<div class="pm-edit-actions">
    <button class="btn btn-primary btn-sm" onclick="savePmSectionEdit(this)">💾 Save</button>
    <button class="btn btn-sm" onclick="cancelPmSectionEdit(this)">Cancel</button>
  </div>`;

  contentEl.innerHTML = formHtml;
  contentEl._originalHTML = originalHTML;
}

// ── Save section edit ────────────────────────────────────────
async function savePmSectionEdit(btn) {
  const card = btn.closest(".pm-card");
  const modal = card.closest(".modal-overlay");
  const id = modal._pmId;
  const table = modal._pmTable || "PERMIT";
  const section = card.dataset.pmSection;
  const fieldNames = (card.dataset.pmFields || "").split(",").filter(Boolean);

  const data = {};
  card.querySelectorAll("[data-col]").forEach((el) => {
    data[el.dataset.col] = el.value;
  });

  const saveBtn = btn;
  const restoreBtn = setButtonLoading(saveBtn, "Saving...");

  try {
    await api(`/api/data/${table}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    toast("Section updated", "success");

    // Update the cached row data
    Object.assign(modal._pmRow, data);

    // Re-render the entire modal by closing and reopening
    modal.remove();
    showRecordModal(table, id);

    // Refresh table data if visible
    if (state.currentView === "tables" && state.currentTable === table) {
      loadTableData();
    }
  } catch (err) {
    toast(err.message, "error");
    restoreBtn();
  }
}

// ── Cancel section edit ──────────────────────────────────────
function cancelPmSectionEdit(btn) {
  const card = btn.closest(".pm-card");
  const contentEl = card.querySelector(".pm-card-content");
  if (contentEl._originalHTML) {
    contentEl.innerHTML = contentEl._originalHTML;
  }
  card.classList.remove("pm-editing");
}

// ── Enable documents edit mode (upload zone) ─────────────────
function enableDocumentsEditMode(card, table, id, row) {
  card.classList.add("pm-editing");
  // Show the upload zone by re-rendering with full documents
  const container = document.getElementById("documents-container");
  if (container) {
    loadUnifiedDocuments(table, id, row);
  }
  // Add a "Done" button
  const contentEl = card.querySelector(".pm-card-content");
  if (!contentEl.querySelector(".pm-docs-done-btn")) {
    const doneDiv = document.createElement("div");
    doneDiv.className = "pm-edit-actions pm-docs-done-btn";
    doneDiv.innerHTML =
      '<button class="btn btn-sm" onclick="disableDocumentsEditMode(this)">✅ Done</button>';
    contentEl.appendChild(doneDiv);
  }
}

// ── Disable documents edit mode ──────────────────────────────
function disableDocumentsEditMode(btn) {
  const card = btn.closest(".pm-card");
  card.classList.remove("pm-editing");
  const modal = card.closest(".modal-overlay");
  const id = modal._pmId;
  const row = modal._pmRow;
  // Reload in read-only mode
  loadUnifiedDocumentsReadOnly("PERMIT", id, row);
  // Remove done button
  const doneBtn = card.querySelector(".pm-docs-done-btn");
  if (doneBtn) doneBtn.remove();
}

// ── Load documents in read-only mode (no upload zone) ────────
async function loadUnifiedDocumentsReadOnly(table, id, row) {
  const container = document.getElementById("documents-container");
  const countEl = document.getElementById("docs-count");
  if (!container) return;

  try {
    const [attachments, digiResult] = await Promise.all([
      loadAttachments(table, id),
      loadDigitizedData(table, id, row),
    ]);

    const totalCount =
      attachments.length + (digiResult ? digiResult.links.length : 0);
    if (countEl) countEl.textContent = `(${totalCount})`;

    let html = "";

    // Attachments (read-only: preview + download via right-click)
    if (attachments.length > 0) {
      html +=
        '<div style="margin-bottom:10px"><div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:6px">📎 Uploaded Files</div>';
      html += '<div class="attachment-list">';
      attachments.forEach((a) => {
        html += renderAttachmentItemHTML(a, table, id, true);
      });
      html += "</div></div>";
    }

    // Linked digitized files (read-only)
    if (digiResult && digiResult.links.length > 0) {
      html +=
        '<div style="margin-bottom:10px"><div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:6px">🗂️ Linked Digitized Files</div>';
      html += '<div class="attachment-list">';
      digiResult.links.forEach((link) => {
        html += renderDigiLinkItemHTML(link, table, id, true);
      });
      html += "</div></div>";
    }

    if (totalCount === 0) {
      html =
        '<div style="padding:8px 0;color:var(--text-muted);font-size:12px;font-style:italic">No documents attached. Right-click to add files.</div>';
    }

    container.innerHTML = html;
    loadAttachmentThumbnails(container);
  } catch (err) {
    container.innerHTML = `<div style="padding:8px 0;color:var(--text-muted);font-size:12px">Error loading documents.</div>`;
  }
}

// ── Field labels for tbl_keyword ─────────────────────────────
const KEYWORD_FIELD_LABELS = {
  Number: "Number",
  Code: "Code",
  Project: "Project",
  NameOFDocument: "Document Name",
  ClassificationOfDocument: "Classification",
  DocumentYear: "Year",
  NumberOfCopies: "Number of Copies",
  DateOfReceiptFromCompany: "Date of Receipt from Company",
  ReviewingOfficer: "Reviewing Officer",
  DateOfficerReceived: "Date Officer Received",
  DateOfficerReturned: "Date Officer Returned",
  Attachment: "Attachment",
};

function getKeywordLabel(field) {
  return KEYWORD_FIELD_LABELS[field] || humanize(field);
}

// ── Environmental Reports Submission Modal ───────────────────
function showKeywordRecordModal(row, id) {
  const v = (f) => {
    const val = row[f];
    return val != null && val !== ""
      ? escHtml(String(val))
      : '<span class="pm-empty">—</span>';
  };
  const fv = (f) => {
    const val = row[f];
    return val != null && val !== ""
      ? formatCellValue(val, f)
      : '<span class="pm-empty">—</span>';
  };

  const docName = row.NameOFDocument || "Unnamed Document";
  const project = row.Project || "";
  const code = row.Code || "";

  let modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  modal._pmRow = row;
  modal._pmId = id;
  modal._pmTable = "tbl_keyword";

  let html = `<div class="modal pm-modal">
  <div class="pm-header">
    <div class="pm-header-left">
      <div class="pm-header-icon" style="background:#10b981">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div>
        <h3 class="pm-title">${escHtml(docName)}</h3>
        <div class="pm-subtitle">${code ? escHtml(code) + " · " : ""}Record #${id}${project ? " · " + escHtml(project) : ""}</div>
      </div>
    </div>
    <div class="pm-header-right">
      <div class="pm-dots-menu">
        <button class="pm-dots-btn" onclick="togglePmDotsMenu(this)" title="More actions">⋮</button>
        <div class="pm-dots-dropdown">
          ${userCan("can_delete", "tbl_keyword") ? `<div class="pm-dots-item pm-dots-danger" onclick="deleteRecord('tbl_keyword',${id})"><span>🗑️</span> Delete Record</div>` : ""}
        </div>
      </div>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
  </div>

  <div class="pm-body">
    <div class="pm-col pm-col-left">
      <!-- Document Details -->
      <div class="pm-card" data-pm-section="doc-details" data-pm-fields="Number,Code,Project,NameOFDocument,ClassificationOfDocument,DocumentYear,NumberOfCopies" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Document Details
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">Number</span><span class="pm-value">${v("Number")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Code</span><span class="pm-value pm-value-mono">${v("Code")}</span></div>
            </div>
            <div class="pm-field"><span class="pm-label">Project</span><span class="pm-value">${v("Project")}</span></div>
            <div class="pm-field"><span class="pm-label">Document Name</span><span class="pm-value pm-value-prominent">${v("NameOFDocument")}</span></div>
            <div class="pm-field"><span class="pm-label">Classification</span><span class="pm-value">${v("ClassificationOfDocument")}</span></div>
            <div class="pm-field-row">
              <div class="pm-field pm-field-half"><span class="pm-label">Year</span><span class="pm-value">${v("DocumentYear")}</span></div>
              <div class="pm-field pm-field-half"><span class="pm-label">Number of Copies</span><span class="pm-value">${v("NumberOfCopies")}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents & Files -->
      <div class="pm-card" id="record-documents" data-pm-section="documents" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.49"/></svg>
          Documents &amp; Files <span id="docs-count" style="color:var(--text-muted);font-weight:400;font-size:12px"></span>
        </div>
        <div class="pm-card-content">
          <div id="documents-container">
            <div style="padding:8px 0;color:var(--text-muted);font-size:12px">Loading documents...</div>
          </div>
        </div>
      </div>
    </div>

    <div class="pm-col pm-col-right">
      <!-- Review Tracking -->
      <div class="pm-card" data-pm-section="review" data-pm-fields="DateOfReceiptFromCompany,ReviewingOfficer,DateOfficerReceived,DateOfficerReturned,Attachment" oncontextmenu="showPmSectionMenu(event,this)">
        <div class="pm-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Review Tracking
        </div>
        <div class="pm-card-content">
          <div class="pm-fields">
            <div class="pm-field"><span class="pm-label">Date of Receipt from Company</span><span class="pm-value">${fv("DateOfReceiptFromCompany")}</span></div>
            <div class="pm-field"><span class="pm-label">Reviewing Officer</span><span class="pm-value">${v("ReviewingOfficer")}</span></div>
            <div class="pm-field"><span class="pm-label">Date Officer Received</span><span class="pm-value">${fv("DateOfficerReceived")}</span></div>
            <div class="pm-field"><span class="pm-label">Date Officer Returned</span><span class="pm-value">${fv("DateOfficerReturned")}</span></div>
            <div class="pm-field"><span class="pm-label">Attachment</span><span class="pm-value">${v("Attachment")}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="pm-footer">
    <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Close</button>
  </div>
</div>`;

  modal.innerHTML = html;
  document.body.appendChild(modal);
  loadUnifiedDocumentsReadOnly("tbl_keyword", id, row);
}

async function loadUnifiedDocuments(table, id, row) {
  const container = document.getElementById("documents-container");
  const countEl = document.getElementById("docs-count");
  if (!container) return;

  try {
    // Load attachments and digitized links in parallel
    const [attachments, digiResult] = await Promise.all([
      loadAttachments(table, id),
      loadDigitizedData(table, id, row),
    ]);

    const totalCount =
      attachments.length + (digiResult ? digiResult.links.length : 0);
    if (countEl) countEl.textContent = `(${totalCount})`;

    let html = "";

    // ── Uploaded Attachments ──
    if (attachments.length > 0) {
      html +=
        '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">📎 Uploaded Attachments</div>';
      html += '<div class="attachment-list">';
      attachments.forEach((a) => {
        html += renderAttachmentItemHTML(a, table, id, false);
      });
      html += "</div></div>";
    }

    // ── Linked Digitized Documents ──
    if (digiResult && digiResult.links.length > 0) {
      html +=
        '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">🗂️ Linked Digitized Files</div>';
      html += '<div class="attachment-list">';
      digiResult.links.forEach((link) => {
        html += renderDigiLinkItemHTML(link, table, id, false);
      });
      html += "</div></div>";
    }

    // ── Matched Company Folder ──
    if (
      digiResult &&
      digiResult.matchResult &&
      digiResult.matchResult.matched
    ) {
      const mr = digiResult.matchResult;
      html += `<div class="digi-match-box" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:var(--accent)">📂 Matched Company Folder</div>
          <span class="tag tag-green" style="font-size:10px">${mr.score}% match</span>
        </div>
        <div style="font-size:13px;color:var(--text-white);margin-bottom:8px;font-weight:500">${escHtml(mr.folderName)}</div>`;
      if (mr.files && mr.files.length > 0) {
        html += '<div class="attachment-list">';
        const existingLinks = digiResult.links || [];
        mr.files.forEach((f) => {
          if (f.isDirectory) {
            html += `<div class="shared-doc-item folder" onclick="browseDigitizedFolder('${escHtml(f.relativePath)}')">
              <span class="att-icon">📁</span><span class="att-name">${escHtml(f.name)}</span>
            </div>`;
          } else {
            const ext = f.name.split(".").pop().toLowerCase();
            const fIcon = ["pdf"].includes(ext)
              ? "📕"
              : ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff"].includes(
                    ext,
                  )
                ? "🖼️"
                : "📄";
            const sizeStr =
              f.size > 1048576
                ? (f.size / 1048576).toFixed(1) + " MB"
                : (f.size / 1024).toFixed(0) + " KB";
            const isLinked = existingLinks.some(
              (l) => l.relative_path === f.relativePath,
            );
            html += `<div class="shared-doc-item${isLinked ? " linked" : ""}" style="${isLinked ? "opacity:0.6" : "cursor:pointer"}"
              ${!isLinked ? `onclick="linkDigitizedFile(${escAttr(f.relativePath)},${escAttr(f.name)},'${table}',${id})"` : ""}>
              <span class="att-icon">${fIcon}</span>
              <span class="att-name">${escHtml(f.name)}</span>
              <span class="att-size">${sizeStr}</span>
              ${isLinked ? '<span class="tag tag-green" style="font-size:10px;margin-left:auto">linked</span>' : '<span style="color:var(--accent);font-size:11px;margin-left:auto">+ Link</span>'}
            </div>`;
          }
        });
        html += "</div>";
      }
      html += "</div>";
    }

    // ── Upload / Browse actions ──
    const canEdit = userCan("can_edit", table);
    if (state.user?.role === "admin" || canEdit) {
      html += `<div class="att-dropzone" id="att-dropzone"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="event.preventDefault();this.classList.remove('dragover');handleAttDrop(event,'${table}',${id})">
        <div class="att-dropzone-text">
          <span style="font-size:24px">📎</span>
          <span>Drag & drop files or</span>
          <button class="btn btn-sm" onclick="document.getElementById('att-upload-input').click()">Browse Files</button>
          <button class="btn btn-sm" onclick="showSharedDocsBrowser('${table}',${id})">📂 Shared Folder</button>
        </div>
        <input type="file" id="att-upload-input" multiple style="display:none" onchange="uploadAttachments('${table}',${id})">
      </div>`;
      html += `<div id="shared-docs-browser" style="display:none"></div>`;
    }

    // ── Browse Digitized + Create Folder buttons ──
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-sm" onclick="openDigitizedBrowser('${table}',${id})">📂 Browse Digitized Files</button>`;
    if (table === "PERMIT" && row.RegisteredNameOfUndertaking) {
      const suggestedName =
        (row.RegisteredNameOfUndertaking || "").trim() +
        (row.FacilityLocation ? " @ " + row.FacilityLocation.trim() : "");
      html += `<button class="btn btn-sm" onclick="createCompanyFolder(${escAttr(suggestedName)},${escAttr(row.ClassificationOfUndertaking || "")},'${table}',${id})">📁 Create Company Folder</button>`;
    }
    html += "</div>";
    html +=
      '<div id="digi-browser" style="display:none;margin-top:12px"></div>';

    container.innerHTML = html;
    loadAttachmentThumbnails(container);

    // Auto-expand if there are documents
    if (
      totalCount > 0 ||
      (digiResult && digiResult.matchResult && digiResult.matchResult.matched)
    ) {
      const section = document.getElementById("record-documents");
      if (section) section.classList.add("open");
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:12px">Error loading documents. ${err.message || ""}</div>`;
  }
}

/** Fetch digitized file data (links + folder match) without rendering */
async function loadDigitizedData(table, recordId, row) {
  _digiTable = table;
  _digiRecordId = recordId;
  try {
    const links = await api(`/api/digitized/links/${table}/${recordId}`);
    let matchResult = null;
    if (table === "PERMIT" && row.RegisteredNameOfUndertaking) {
      try {
        const params = new URLSearchParams({
          company: row.RegisteredNameOfUndertaking || "",
          location: row.FacilityLocation || "",
          classification: row.ClassificationOfUndertaking || "",
        });
        matchResult = await api(`/api/digitized/match?${params}`);
      } catch (e) {
        /* shared docs might not be configured */
      }
    }
    return { links, matchResult };
  } catch (e) {
    return { links: [], matchResult: null };
  }
}

/** Build HTML for a single attachment item with thumbnail + right-click */
function renderAttachmentItemHTML(a, table, recordId, readOnly) {
  const sizeStr =
    a.file_size > 1048576
      ? (a.file_size / 1048576).toFixed(1) + " MB"
      : (a.file_size / 1024).toFixed(0) + " KB";
  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(a.original_name);
  const isPdf = /\.pdf$/i.test(a.original_name);
  const dateStr = a.created_at ? formatDate(a.created_at) : "";
  const uploaderStr = a.uploaded_by ? escHtml(a.uploaded_by) : "";
  const meta = [uploaderStr, dateStr, sizeStr].filter(Boolean).join(" · ");
  const canDelete =
    !readOnly && (state.user?.role === "admin" || userCan("can_edit", table));

  return `<div class="att-item-card" oncontextmenu="showAttContextMenu(event,${a.id},'${escHtml(a.original_name)}','${table}',${recordId},${isImage || isPdf},${canDelete},'attachment')" ondblclick="previewAttachment(${a.id},'${escHtml(a.original_name)}')">
    <div class="att-thumb" data-att-id="${a.id}" data-filename="${escHtml(a.original_name)}" data-type="${isPdf ? "pdf" : isImage ? "image" : "other"}">
      <span class="att-thumb-icon">${isPdf ? "📕" : isImage ? "🖼️" : "📄"}</span>
    </div>
    <div class="att-item-info">
      <div class="att-item-name" title="${escHtml(a.original_name)}">${escHtml(a.original_name)}</div>
      <div class="att-item-meta">${meta}</div>
    </div>
  </div>`;
}

/** Build HTML for a single digitized link item with right-click */
function renderDigiLinkItemHTML(link, table, recordId, readOnly) {
  const ext = link.file_name.split(".").pop().toLowerCase();
  const isPdf = ext === "pdf";
  const isImage = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "tif",
    "tiff",
    "webp",
  ].includes(ext);
  const icon = isPdf
    ? "📕"
    : isImage
      ? "🖼️"
      : ["doc", "docx"].includes(ext)
        ? "📝"
        : ["xls", "xlsx"].includes(ext)
          ? "📊"
          : "📄";
  const canPreview =
    isPdf || ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext);
  const canUnlink =
    !readOnly && (state.user?.role === "admin" || userCan("can_edit", table));
  const meta = [escHtml(link.linked_by || ""), formatDate(link.created_at)]
    .filter(Boolean)
    .join(" · ");

  return `<div class="att-item-card" oncontextmenu="showAttContextMenu(event,${link.id},'${escHtml(link.file_name)}','${table}',${recordId},${canPreview},${canUnlink},'digi','${escHtml(link.relative_path)}')" ondblclick="${canPreview ? `previewDigitizedFile('${escHtml(link.relative_path)}','${escHtml(link.file_name)}')` : ""}">
    <div class="att-thumb" data-type="${isPdf ? "pdf" : isImage ? "image" : "other"}">
      <span class="att-thumb-icon">${icon}</span>
    </div>
    <div class="att-item-info">
      <div class="att-item-name" title="${escHtml(link.relative_path)}">${escHtml(link.file_name)}</div>
      <div class="att-item-meta">${meta}</div>
    </div>
  </div>`;
}

/** Load thumbnail previews for PDFs and images after DOM is ready */
function loadAttachmentThumbnails(container) {
  if (!container) return;
  container.querySelectorAll(".att-thumb[data-att-id]").forEach((el) => {
    const id = el.dataset.attId;
    const type = el.dataset.type;
    if (type === "image") {
      fetch(`/api/attachments/preview/${id}`, {
        headers: { Authorization: "Bearer " + state.token },
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          el.innerHTML = `<img src="${url}" class="att-thumb-img" alt="" onload="URL.revokeObjectURL(this.src)">`;
        })
        .catch(() => {});
    } else if (type === "pdf") {
      fetch(`/api/attachments/preview/${id}`, {
        headers: { Authorization: "Bearer " + state.token },
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          renderPdfThumbnail(url, el);
        })
        .catch(() => {});
    }
  });
}

/** Render a PDF first-page thumbnail into the given container element */
function renderPdfThumbnail(blobUrl, container) {
  const canvas = document.createElement("canvas");
  canvas.className = "att-thumb-canvas";
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:absolute;width:0;height:0;border:none;visibility:hidden";
  iframe.src = blobUrl;
  // Fall back to showing PDF icon if canvas rendering not available
  // Use a simple approach: just show the iframe thumbnail
  container.innerHTML = "";
  const img = document.createElement("div");
  img.className = "att-thumb-pdf-frame";
  img.innerHTML = `<iframe src="${blobUrl}#page=1&view=FitH" class="att-thumb-pdf-iframe" scrolling="no" tabindex="-1"></iframe>`;
  container.appendChild(img);
  // Clean up blob URL when the parent is removed
  const observer = new MutationObserver(() => {
    if (!document.contains(container)) {
      URL.revokeObjectURL(blobUrl);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Show right-click context menu for an attachment */
function showAttContextMenu(
  event,
  id,
  filename,
  table,
  recordId,
  canPreview,
  canModify,
  kind,
  relPath,
) {
  event.preventDefault();
  event.stopPropagation();
  // Remove any existing context menu
  document.querySelectorAll(".att-ctx-menu").forEach((m) => m.remove());

  const menu = document.createElement("div");
  menu.className = "att-ctx-menu";

  let items = "";
  if (canPreview) {
    if (kind === "digi") {
      items += `<div class="att-ctx-item" onclick="previewDigitizedFile('${escHtml(relPath || "")}','${escHtml(filename)}');this.closest('.att-ctx-menu').remove()">👁️ Preview</div>`;
    } else {
      items += `<div class="att-ctx-item" onclick="previewAttachment(${id},'${escHtml(filename)}');this.closest('.att-ctx-menu').remove()">👁️ Preview</div>`;
    }
  }
  if (kind === "digi") {
    items += `<div class="att-ctx-item" onclick="downloadDigitizedFile('${escHtml(relPath || "")}');this.closest('.att-ctx-menu').remove()">⬇️ Download</div>`;
  } else {
    items += `<div class="att-ctx-item" onclick="downloadAttachment(${id});this.closest('.att-ctx-menu').remove()">⬇️ Download</div>`;
  }
  if (canPreview && kind !== "digi") {
    items += `<div class="att-ctx-item" onclick="openAttachmentNewTab(${id});this.closest('.att-ctx-menu').remove()">🔗 Open in New Tab</div>`;
  }
  if (kind !== "digi") {
    items += `<div class="att-ctx-item" onclick="copyAttachmentInfo(${id},'${escHtml(filename)}');this.closest('.att-ctx-menu').remove()">📋 Copy File Name</div>`;
  }
  if (canModify) {
    items += '<div class="att-ctx-sep"></div>';
    if (kind === "digi") {
      items += `<div class="att-ctx-item att-ctx-danger" onclick="unlinkDigitizedFile(${id},'${table}',${recordId});this.closest('.att-ctx-menu').remove()">✕ Remove Link</div>`;
    } else {
      items += `<div class="att-ctx-item att-ctx-danger" onclick="deleteAttachment(${id},'${table}',${recordId});this.closest('.att-ctx-menu').remove()">🗑️ Delete File</div>`;
    }
  }

  menu.innerHTML = items;
  document.body.appendChild(menu);

  // Position near cursor
  const menuRect = menu.getBoundingClientRect();
  let x = event.clientX,
    y = event.clientY;
  if (x + menuRect.width > window.innerWidth)
    x = window.innerWidth - menuRect.width - 8;
  if (y + menuRect.height > window.innerHeight)
    y = window.innerHeight - menuRect.height - 8;
  menu.style.left = x + "px";
  menu.style.top = y + "px";

  // Close on click outside
  const closeHandler = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
}

/** Open attachment in a new browser tab */
function openAttachmentNewTab(id) {
  fetch(`/api/attachments/preview/${id}`, {
    headers: { Authorization: "Bearer " + state.token },
  })
    .then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    })
    .catch((err) => toast("Could not open file: " + err.message, "error"));
}

/** Copy attachment filename to clipboard */
function copyAttachmentInfo(id, filename) {
  navigator.clipboard
    .writeText(filename)
    .then(() => toast("File name copied", "success"))
    .catch(() => toast("Copy failed", "error"));
}

/** Render just the attachment list items (no dropzone) — legacy wrapper */
function renderAttachmentList(table, recordId, attachments) {
  let html = '<div class="attachment-list">';
  attachments.forEach((a) => {
    html += renderAttachmentItemHTML(a, table, recordId, false);
  });
  html += "</div>";
  return html;
}

function toggleSection(el) {
  el.closest(".record-section").classList.toggle("open");
}

function filterModalFields(term) {
  const lowerTerm = term.toLowerCase();
  document.querySelectorAll(".record-section").forEach((sec) => {
    let hasMatch = false;
    sec.querySelectorAll(".record-field").forEach((field) => {
      const fieldName = field.dataset.field || "";
      const fieldText = field.textContent.toLowerCase();
      const match =
        !term || fieldName.includes(lowerTerm) || fieldText.includes(lowerTerm);
      field.classList.toggle("hidden", !match);
      field.classList.toggle("highlight", match && term.length > 0);
      if (match) hasMatch = true;
    });
    // Auto-expand sections with matches
    if (term && hasMatch) sec.classList.add("open");
    else if (!term) sec.classList.remove("open");
  });
}

// ── New / Edit Record Modal ──────────────────────────────────
// Cache field options per table
const _fieldOptionsCache = {};
async function getFieldOptions(table) {
  if (_fieldOptionsCache[table]) return _fieldOptionsCache[table];
  try {
    const opts = await api(`/api/field-options/${table}`);
    _fieldOptionsCache[table] = opts;
    return opts;
  } catch (e) {
    return {};
  }
}

function isDateField(fieldName) {
  const lower = fieldName.toLowerCase();
  return (
    lower.includes("date") ||
    lower.includes("expiry") ||
    lower.includes("renewal") ||
    lower === "screening_date"
  );
}

function renderFormField(fieldName, value, table, fieldOptions, idPrefix) {
  const id = idPrefix ? `${idPrefix}-${fieldName}` : "";
  const label = getFieldLabel(table || "", fieldName);
  const options = fieldOptions[fieldName];
  const currentVal = value ?? "";

  // Autocomplete combo-box for OfficerWorkingOnFile (and similar officer fields)
  const autocompleteFields = [
    "OfficerWorkingOnFile",
    "ApprovedBy",
    "RequestedBy",
  ];
  if (autocompleteFields.includes(fieldName) && options && options.length > 0) {
    const acId = id || `ac-${fieldName}-${Date.now()}`;
    const optsJson = JSON.stringify(options)
      .replace(/'/g, "&#39;")
      .replace(/"/g, "&quot;");
    return `<div class="form-group"><label>${label}</label>
      <div class="autocomplete-wrapper">
        <input ${id ? `id="${acId}"` : ""} data-col="${fieldName}" value="${escHtml(String(currentVal))}" placeholder="Type to search ${label}…" autocomplete="off"
          onfocus="openAutocomplete(this)" oninput="filterAutocomplete(this)" onkeydown="acKeyDown(event,this)">
        <button type="button" class="ac-toggle" onclick="toggleAutocomplete(this.parentNode)" tabindex="-1">▼</button>
        <div class="autocomplete-dropdown" data-options="${optsJson}"></div>
      </div>
    </div>`;
  }

  if (options && options.length > 0) {
    // Render as a select dropdown
    let html = `<div class="form-group"><label>${label}</label><select ${id ? `id="${id}"` : ""} data-col="${fieldName}" class="form-select">`;
    html += `<option value="">— Select ${label} —</option>`;
    options.forEach((opt) => {
      const sel =
        String(currentVal).trim().toLowerCase() === opt.trim().toLowerCase()
          ? " selected"
          : "";
      html += `<option value="${escHtml(opt)}"${sel}>${escHtml(opt)}</option>`;
    });
    // If current value exists but isn't in the options list, add it as a custom option
    if (
      currentVal &&
      !options.some(
        (o) =>
          o.trim().toLowerCase() === String(currentVal).trim().toLowerCase(),
      )
    ) {
      html += `<option value="${escHtml(String(currentVal))}" selected>${escHtml(String(currentVal))} (custom)</option>`;
    }
    html += `</select></div>`;
    return html;
  } else if (isDateField(fieldName)) {
    // Render as date input
    return `<div class="form-group"><label>${label}</label><input type="date" ${id ? `id="${id}"` : ""} data-col="${fieldName}" value="${escHtml(String(currentVal))}"></div>`;
  } else {
    // Regular text input
    return `<div class="form-group"><label>${label}</label><input ${id ? `id="${id}"` : ""} data-col="${fieldName}" value="${escHtml(String(currentVal))}" placeholder="${label}"></div>`;
  }
}

// ── Autocomplete combo-box helpers ───────────────────────────
function openAutocomplete(input) {
  const dd = input.parentNode.querySelector(".autocomplete-dropdown");
  if (!dd) return;
  filterAutocomplete(input);
  dd.classList.add("open");
}
function toggleAutocomplete(wrapper) {
  const dd = wrapper.querySelector(".autocomplete-dropdown");
  const input = wrapper.querySelector("input");
  if (dd.classList.contains("open")) {
    dd.classList.remove("open");
  } else {
    input.focus();
    openAutocomplete(input);
  }
}
function filterAutocomplete(input) {
  const dd = input.parentNode.querySelector(".autocomplete-dropdown");
  if (!dd) return;
  let options;
  try {
    options = JSON.parse(
      dd.dataset.options.replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    );
  } catch (e) {
    return;
  }
  const query = input.value.toLowerCase().trim();
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options;
  if (filtered.length === 0) {
    dd.innerHTML = '<div class="ac-empty">No matches found</div>';
  } else {
    dd.innerHTML = filtered
      .map(
        (o) =>
          `<div class="ac-item" onmousedown="selectAutocomplete(this, ${escAttr(o)})">${escHtml(o)}</div>`,
      )
      .join("");
  }
  dd.classList.add("open");
}
function selectAutocomplete(el, value) {
  const wrapper = el.closest(".autocomplete-wrapper");
  const input = wrapper.querySelector("input");
  input.value = value;
  wrapper.querySelector(".autocomplete-dropdown").classList.remove("open");
  input.focus();
}
function acKeyDown(e, input) {
  const dd = input.parentNode.querySelector(".autocomplete-dropdown");
  if (!dd || !dd.classList.contains("open")) return;
  const items = dd.querySelectorAll(".ac-item");
  if (items.length === 0) return;
  let active = dd.querySelector(".ac-active");
  let idx = active ? [...items].indexOf(active) : -1;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (active) active.classList.remove("ac-active");
    idx = (idx + 1) % items.length;
    items[idx].classList.add("ac-active");
    items[idx].scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (active) active.classList.remove("ac-active");
    idx = idx <= 0 ? items.length - 1 : idx - 1;
    items[idx].classList.add("ac-active");
    items[idx].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (active) {
      active.click();
    } else if (items.length === 1) {
      items[0].click();
    }
  } else if (e.key === "Escape") {
    dd.classList.remove("open");
  }
}
// Close autocomplete when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrapper")) {
    document
      .querySelectorAll(".autocomplete-dropdown.open")
      .forEach((d) => d.classList.remove("open"));
  }
});

async function showNewRecordModal(table) {
  showProgressBar();
  try {
    const cols = await api(`/api/tables/${table}/columns`);
    const sections = await buildSections(
      cols.map((c) => c.name),
      table,
    );
    const fieldOptions = await getFieldOptions(table);
    let modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    if (table === "PERMIT") {
      // ── PERMIT-specific new record modal ──
      const rf = (f, defVal) =>
        renderPermitFormField(f, defVal || "", fieldOptions);
      let html = `<div class="modal pm-modal">
      <div class="pm-header">
        <div class="pm-header-left">
          <div class="pm-header-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
          <div><h3 class="pm-title">New PERMIT Record</h3><div class="pm-subtitle">Create a new permit entry</div></div>
        </div>
        <div class="pm-header-right"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      </div>
      <div class="pm-body pm-edit-body">
        <div class="pm-col pm-col-left">
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>File Information</div>
            <div class="pm-edit-fields">${rf("FileNumber")}${rf("FileLocation")}${rf("OfficerWorkingOnFile")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Establishment Information</div>
            <div class="pm-edit-fields">${rf("RegisteredNameOfUndertaking")}${rf("ClassificationOfUndertaking")}${rf("FacilityLocation")}${rf("District")}${rf("Jurisdiction")}${rf("Latitude")}${rf("Longitude")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Contact Information</div>
            <div class="pm-edit-fields">${rf("PermitHolder")}${rf("ContactPerson")}${rf("TelephoneNumber")}${rf("Email")}</div>
          </div>
        </div>
        <div class="pm-col pm-col-right">
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Application Details</div>
            <div class="pm-edit-fields">
              ${rf("DateOfReceiptOfApplication")}
              ${renderPermitFormField("Screening", "Not Done", fieldOptions, null, 'onchange="toggleScreeningDate(this)"')}
              <div id="screening-date-group" style="display:none">${rf("Screening_Date")}</div>
            </div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Permit Details</div>
            <div class="pm-edit-fields">${rf("PermitNumber")}${rf("DateOfIssueOfPermit")}${rf("PermitExpirationDate")}${rf("PermittedBy")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Status</div>
            <div class="pm-edit-fields">${rf("ApplicationStatusII")}${rf("ApplicationStatus")}</div>
          </div>
        </div>
      </div>
      <div class="pm-footer">
        <button class="btn btn-primary btn-sm" onclick="saveNewRecord('PERMIT')">💾 Save</button>
        <div style="flex:1"></div>
        <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      </div>
      </div>`;
      modal.innerHTML = html;
      document.body.appendChild(modal);
      return;
    }

    let html = `<div class="modal"><div class="modal-header"><h3>New ${table} Record</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div><div class="modal-body" style="padding:16px">`;
    sections.forEach((sec) => {
      const secCols = sec.fields.filter((f) => cols.some((c) => c.name === f));
      if (!secCols.length) return;
      html += `<div class="form-section"><div class="form-section-title">${sec.title}</div><div class="form-section-body">`;
      secCols.forEach((f) => {
        html += renderFormField(f, "", table, fieldOptions, "new");
      });
      html += "</div></div>";
    });
    html += `</div><div class="modal-footer"><button class="btn btn-primary btn-sm" onclick="saveNewRecord('${table}')">💾 Save</button><button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button></div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
  } catch (err) {
    toast("Failed to load form: " + err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function saveNewRecord(table) {
  const saveBtn = document.querySelector(".modal-footer .btn-primary");
  const restoreBtn = setButtonLoading(saveBtn, "Saving...");
  const data = {};
  document.querySelectorAll(".modal [data-col]").forEach((el) => {
    const val = el.value.trim();
    if (val) data[el.dataset.col] = val;
  });
  try {
    await api(`/api/data/${table}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    document.querySelector(".modal-overlay").remove();
    toast("Record created successfully", "success");
    loadTableData();
  } catch (err) {
    toast(err.message, "error");
    restoreBtn();
  }
}

async function showEditRecordModal(table, id) {
  showProgressBar();
  try {
    const row = await api(`/api/data/${table}/${id}`);
    const sections = await buildSections(
      Object.keys(row).filter((k) => k !== "id"),
      table,
    );
    const fieldOptions = await getFieldOptions(table);
    let modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    if (table === "PERMIT") {
      // ── PERMIT-specific edit modal ──
      const rf = (f) => renderPermitFormField(f, row[f], fieldOptions);
      const screening =
        row.Screening || (row.Screening_Date ? "Done" : "Not Done");
      const showScreenDate = screening === "Done" || !!row.Screening_Date;
      let html = `<div class="modal pm-modal">
      <div class="pm-header">
        <div class="pm-header-left">
          <div class="pm-header-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div><h3 class="pm-title">Edit Record #${id}</h3><div class="pm-subtitle">${escHtml(row.RegisteredNameOfUndertaking || "PERMIT")}</div></div>
        </div>
        <div class="pm-header-right"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      </div>
      <div class="pm-body pm-edit-body">
        <div class="pm-col pm-col-left">
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>File Information</div>
            <div class="pm-edit-fields">${rf("FileNumber")}${rf("FileLocation")}${rf("OfficerWorkingOnFile")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Establishment Information</div>
            <div class="pm-edit-fields">${rf("RegisteredNameOfUndertaking")}${rf("ClassificationOfUndertaking")}${rf("FacilityLocation")}${rf("District")}${rf("Jurisdiction")}${rf("Latitude")}${rf("Longitude")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Contact Information</div>
            <div class="pm-edit-fields">${rf("PermitHolder")}${rf("ContactPerson")}${rf("TelephoneNumber")}${rf("Email")}</div>
          </div>
        </div>
        <div class="pm-col pm-col-right">
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Application Details</div>
            <div class="pm-edit-fields">
              ${rf("DateOfReceiptOfApplication")}
              ${renderPermitFormField("Screening", screening, fieldOptions, null, 'onchange="toggleScreeningDate(this)"')}
              <div id="screening-date-group" style="${showScreenDate ? "" : "display:none"}">${rf("Screening_Date")}</div>
            </div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Permit Details</div>
            <div class="pm-edit-fields">${rf("PermitNumber")}${rf("DateOfIssueOfPermit")}${rf("PermitExpirationDate")}${rf("PermittedBy")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Status</div>
            <div class="pm-edit-fields">${rf("ApplicationStatusII")}${rf("ApplicationStatus")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Fees</div>
            <div class="pm-edit-fields">${rf("ProcessingFee")}${rf("DateOfPaymentOfProcessingFee")}${rf("PermitFee")}${rf("DateOfPaymentOfPermitFee")}</div>
          </div>
          <div class="pm-card"><div class="pm-card-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Compliance</div>
            <div class="pm-edit-fields">${rf("Compliance")}${rf("ComplianceDate")}</div>
          </div>
        </div>
      </div>
      <div class="pm-footer">
        <button class="btn btn-primary btn-sm" onclick="saveEditRecord('PERMIT',${id})">💾 Save Changes</button>
        <div style="flex:1"></div>
        <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      </div>
      </div>`;
      modal.innerHTML = html;
      document.body.appendChild(modal);
      return;
    }

    let html = `<div class="modal"><div class="modal-header"><h3>Edit ${table} #${id}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div><div class="modal-body" style="padding:16px">`;
    sections.forEach((sec) => {
      const secFields = sec.fields.filter((f) => row.hasOwnProperty(f));
      if (!secFields.length) return;
      html += `<div class="form-section"><div class="form-section-title">${sec.title}</div><div class="form-section-body">`;
      secFields.forEach((f) => {
        html += renderFormField(f, row[f], table, fieldOptions, "edit");
      });
      html += "</div></div>";
    });
    html += `</div><div class="modal-footer"><button class="btn btn-primary btn-sm" onclick="saveEditRecord('${table}',${id})">💾 Save Changes</button><button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button></div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
  } catch (err) {
    toast("Failed to load record: " + err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ── PERMIT edit form field renderer ──────────────────────────
function renderPermitFormField(
  fieldName,
  value,
  fieldOptions,
  forceId,
  extraAttrs,
  table,
) {
  const label =
    table === "tbl_keyword"
      ? getKeywordLabel(fieldName)
      : getPermitLabel(fieldName);
  const options = fieldOptions[fieldName];
  const currentVal = value ?? "";
  const id = forceId || `edit-${fieldName}`;
  const extra = extraAttrs || "";

  // Autocomplete combo-box for OfficerWorkingOnFile
  const autocompleteFields = [
    "OfficerWorkingOnFile",
    "ApprovedBy",
    "RequestedBy",
  ];
  if (autocompleteFields.includes(fieldName) && options && options.length > 0) {
    const optsJson = JSON.stringify(options)
      .replace(/'/g, "&#39;")
      .replace(/"/g, "&quot;");
    return `<div class="pm-form-group"><label class="pm-form-label">${label}</label>
      <div class="autocomplete-wrapper">
        <input id="${id}" data-col="${fieldName}" value="${escHtml(String(currentVal))}" placeholder="Type to search…" autocomplete="off"
          onfocus="openAutocomplete(this)" oninput="filterAutocomplete(this)" onkeydown="acKeyDown(event,this)" ${extra}>
        <button type="button" class="ac-toggle" onclick="toggleAutocomplete(this.parentNode)" tabindex="-1">▼</button>
        <div class="autocomplete-dropdown" data-options="${optsJson}"></div>
      </div></div>`;
  }

  if (options && options.length > 0) {
    let html = `<div class="pm-form-group"><label class="pm-form-label">${label}</label><select id="${id}" data-col="${fieldName}" class="form-select" ${extra}>`;
    html += `<option value="">— Select —</option>`;
    options.forEach((opt) => {
      const sel =
        String(currentVal).trim().toLowerCase() === opt.trim().toLowerCase()
          ? " selected"
          : "";
      html += `<option value="${escHtml(opt)}"${sel}>${escHtml(opt)}</option>`;
    });
    if (
      currentVal &&
      !options.some(
        (o) =>
          o.trim().toLowerCase() === String(currentVal).trim().toLowerCase(),
      )
    ) {
      html += `<option value="${escHtml(String(currentVal))}" selected>${escHtml(String(currentVal))} (custom)</option>`;
    }
    html += `</select></div>`;
    return html;
  } else if (isDateField(fieldName)) {
    return `<div class="pm-form-group"><label class="pm-form-label">${label}</label><input type="date" id="${id}" data-col="${fieldName}" value="${escHtml(String(currentVal))}" ${extra}></div>`;
  } else {
    return `<div class="pm-form-group"><label class="pm-form-label">${label}</label><input id="${id}" data-col="${fieldName}" value="${escHtml(String(currentVal))}" placeholder="${label}" ${extra}></div>`;
  }
}

// ── Screening conditional logic ──────────────────────────────
function toggleScreeningDate(selectEl) {
  const group = selectEl
    .closest(".pm-card")
    .querySelector("#screening-date-group");
  if (group) {
    group.style.display = selectEl.value === "Done" ? "" : "none";
    if (selectEl.value !== "Done") {
      const dateInput = group.querySelector("[data-col='Screening_Date']");
      if (dateInput) dateInput.value = "";
    }
  }
}

async function saveEditRecord(table, id) {
  const saveBtn = document.querySelector(".modal-footer .btn-primary");
  const restoreBtn = setButtonLoading(saveBtn, "Saving...");
  const data = {};
  document.querySelectorAll(".modal [data-col]").forEach((el) => {
    data[el.dataset.col] = el.value;
  });
  try {
    await api(`/api/data/${table}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    document.querySelector(".modal-overlay").remove();
    toast("Record updated successfully", "success");
    loadTableData();
  } catch (err) {
    toast(err.message, "error");
    restoreBtn();
  }
}

async function deleteRecord(table, id) {
  if (
    !(await showConfirmModal(
      "Are you sure you want to delete this record? This action cannot be undone.",
      {
        title: "Delete Record",
        icon: "🗑️",
        confirmText: "Delete",
        danger: true,
      },
    ))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/data/${table}/${id}`, { method: "DELETE" });
    document.querySelector(".modal-overlay")?.remove();
    toast("Record deleted", "success");
    loadTableData();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ══════════════════════════════════════════════════════════════
//  QUERIES VIEW
// ══════════════════════════════════════════════════════════════
async function renderQueriesView() {
  const sidebar = document.getElementById("sidebar-content");
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = '<div class="tab-item active">🔍 Queries</div>';
  sidebar.innerHTML = '<div class="loading">Loading...</div>';
  content.innerHTML = renderEmptyState(
    "Select a Query",
    "Choose a query from the sidebar to view results",
  );

  try {
    state.queries = await api("/api/queries");
    // Filter queries by feature permission
    if (state.user.role !== "admin") {
      state.queries = state.queries.filter((q) => featureCan("query", q.key));
    }
    // Group by category
    const groups = {};
    state.queries.forEach((q) => {
      const cat = q.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    });
    let sideHtml = `<div class="sidebar-search"><input type="search" placeholder="Filter queries..." oninput="debouncedFilterSidebar(this.value)"></div>`;
    Object.entries(groups).forEach(([cat, queries]) => {
      sideHtml += `<div class="sidebar-group-title">${cat}</div>`;
      queries.forEach((q) => {
        sideHtml += `<div class="sidebar-item query-sidebar-item" data-key="${q.key}" onclick="selectQuery('${q.key}')">
          <span class="icon">▸</span>
          <span class="label">${q.name}</span>
        </div>`;
      });
    });
    sidebar.innerHTML = sideHtml;

    // Auto-run query if coming from dashboard
    if (state.autoRunQuery) {
      const qKey = state.autoRunQuery;
      state.autoRunQuery = null;
      selectQuery(qKey);
      // Auto-run if no params needed
      const q = state.queries.find((x) => x.key === qKey);
      if (q && (!q.params || q.params.length === 0)) {
        setTimeout(() => runQuery(qKey, {}), 100);
      }
    } else if (state.queries.length > 0) {
      // Auto-select the first query
      selectQuery(state.queries[0].key);
    }
  } catch (err) {
    sidebar.innerHTML = `<div style="padding:16px;color:var(--red)">${err.message}</div>`;
  }
}

function filterSidebarItems(term) {
  const lower = term.toLowerCase();
  document.querySelectorAll(".sidebar-item").forEach((el) => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(lower) ? "" : "none";
  });
}
function debouncedFilterSidebar(val) {
  clearTimeout(sidebarSearchTimer);
  sidebarSearchTimer = setTimeout(() => filterSidebarItems(val), 300);
}

function selectQuery(key) {
  state.selectedQuery = key;
  // Update sidebar active state
  document
    .querySelectorAll(".query-sidebar-item")
    .forEach((el) => el.classList.toggle("active", el.dataset.key === key));
  const q = state.queries.find((x) => x.key === key);
  if (!q) return;
  const content = document.getElementById("content");
  if (q.params && q.params.length > 0) {
    let html = `<div class="query-form"><h3>${q.name}</h3><div class="query-desc">${q.description}</div><div class="query-params">`;
    q.params.forEach((p) => {
      html += `<div class="query-param-group"><label>${p.label}</label>`;
      if (p.type === "select") {
        html += `<select id="qp-${p.name}">${p.options.map((o) => `<option value="${o}">${o}</option>`).join("")}</select>`;
      } else {
        html += `<input type="${p.type === "date" ? "date" : p.type === "number" ? "number" : "text"}" id="qp-${p.name}" ${p.default ? `value="${p.default}"` : ""}>`;
      }
      html += "</div>";
    });
    html += `<button class="btn btn-primary btn-sm" onclick="runQueryFromForm('${key}')">▶ Run Query</button></div></div><div id="query-results"></div>`;
    content.innerHTML = html;
  } else {
    content.innerHTML = '<div class="loading">Running query...</div>';
    runQuery(key, {});
  }
}

function runQueryFromForm(key) {
  const q = state.queries.find((x) => x.key === key);
  const params = {};
  q.params.forEach((p) => {
    params[p.name] = document.getElementById(`qp-${p.name}`)?.value || "";
  });
  runQuery(key, params);
}

async function runQuery(key, params) {
  const resultsEl =
    document.getElementById("query-results") ||
    document.getElementById("content");
  try {
    const data = await api(`/api/queries/${key}/run`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    const q = state.queries.find((x) => x.key === key);
    if (data.rows.length === 0) {
      resultsEl.innerHTML = renderEmptyState(
        "No Results",
        "This query returned no matching records",
      );
      return;
    }
    // Show results as cards
    const table = q?.table || "PERMIT";
    const titleCol = getCardTitleCol(table);
    const fields = getCardFields(table);
    const cols = Object.keys(data.rows[0]);

    let html = `<div class="search-bar" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span class="search-info">${data.total.toLocaleString()} result${data.total !== 1 ? "s" : ""} · ${data.queryName || q?.name || key}</span>
      ${
        !q?.isAggregate
          ? `<input type="text" id="query-search-input" placeholder="🔍 Search results..." oninput="filterQueryCards(this.value)"
        style="flex:1;min-width:180px;max-width:350px;padding:6px 12px;font-size:13px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-white)">`
          : ""
      }
    </div>`;

    // For aggregate queries, show as summary cards
    if (q?.isAggregate) {
      html += '<div class="report-summary-grid">';
      data.rows.forEach((row) => {
        const vals = Object.entries(row);
        html += '<div class="report-summary-card">';
        vals.forEach(([k, v]) => {
          if (
            k.toLowerCase().includes("total") ||
            k.toLowerCase().includes("count")
          ) {
            html += `<div class="rsv">${typeof v === "number" ? v.toLocaleString() : v}</div>`;
          } else {
            html += `<div class="rsl">${escHtml(String(v || "N/A"))}</div>`;
          }
        });
        html += "</div>";
      });
      html += "</div>";
    } else {
      html += '<div class="data-cards">';
      data.rows.forEach((row) => {
        const title = row[titleCol] || row[cols[0]] || "Record";
        const id = row.id || "";
        html += `<div class="data-card"${id ? ` onclick="showRecordModal('${table}',${id})"` : ""}>`;
        html += `<div class="data-card-header"><div class="data-card-title">${escHtml(String(title))}</div>${id ? `<div class="data-card-id">#${id}</div>` : ""}</div>`;
        html += '<div class="data-card-fields">';
        const showFields = id ? fields : cols.slice(0, 6);
        showFields.forEach((f) => {
          if (
            row[f] !== null &&
            row[f] !== undefined &&
            row[f] !== "" &&
            f !== titleCol &&
            f !== "id"
          ) {
            html += `<div class="data-card-field"><span class="field-label">${humanize(f)}</span><span class="field-value">${formatCellValue(row[f], f)}</span></div>`;
          }
        });
        html += "</div>";
        const tags = getStatusTags(row, table);
        if (tags.length)
          html += '<div class="data-card-status">' + tags.join("") + "</div>";
        html += "</div>";
      });
      html += "</div>";
    }

    if (document.getElementById("query-results")) {
      document.getElementById("query-results").innerHTML = html;
    } else {
      resultsEl.innerHTML = html;
    }
  } catch (err) {
    const target = document.getElementById("query-results") || resultsEl;
    target.innerHTML = `<div class="empty-state"><div class="empty-title">Query Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function filterQueryCards(term) {
  const cards = document.querySelectorAll(".data-cards .data-card");
  const t = term.toLowerCase().trim();
  let visible = 0;
  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    const show = !t || text.includes(t);
    card.style.display = show ? "" : "none";
    if (show) visible++;
  });
  const info = document.querySelector(".search-info");
  if (info) {
    if (!info.dataset.original) info.dataset.original = info.textContent;
    const orig = info.dataset.original;
    const suffix = orig.includes("·")
      ? " · " + orig.split("·").slice(1).join("·").trim()
      : "";
    info.textContent = t
      ? `${visible} of ${cards.length} shown${suffix}`
      : orig;
  }
}

// ══════════════════════════════════════════════════════════════
//  FORMS VIEW
// ══════════════════════════════════════════════════════════════
async function renderFormView() {
  const sidebar = document.getElementById("sidebar-content");
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = '<div class="tab-item active">📝 Forms</div>';
  sidebar.innerHTML = '<div class="loading">Loading...</div>';

  try {
    state.forms = await api("/api/forms");
    // Filter forms by feature permission
    if (state.user.role !== "admin") {
      state.forms = state.forms.filter((f) => featureCan("form", f.key));
    }
    sidebar.innerHTML = state.forms
      .map(
        (f) => `
      <div class="sidebar-item" onclick="selectForm('${f.key}')">
        <span class="icon">${f.icon}</span>
        <span class="label">${f.name}</span>
      </div>
    `,
      )
      .join("");

    // Auto-select the first form
    if (state.forms.length > 0) {
      selectForm(state.forms[0].key);
    } else {
      content.innerHTML = renderEmptyState(
        "No Forms",
        "No data entry forms are available",
      );
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

async function selectForm(key) {
  const form = state.forms.find((f) => f.key === key);
  if (!form) return;
  state.selectedForm = key;
  // Highlight active sidebar item
  document
    .querySelectorAll("#sidebar-content .sidebar-item")
    .forEach((el) =>
      el.classList.toggle("active", el.getAttribute("onclick")?.includes(key)),
    );
  // Show recent records as cards
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading form records...</div>';
  try {
    const data = await api(`/api/data/${form.table}?limit=20&sort=id&dir=desc`);
    const titleCol = getCardTitleCol(form.table);
    const fields = getCardFields(form.table);

    let html = `<div class="query-form"><h3>${form.icon} ${form.name}</h3><div class="query-desc">${form.description} — Showing recent records from ${form.table}</div></div>`;

    if (state.user.role === "admin") {
      html += `<div style="margin-bottom:16px"><button class="btn btn-primary btn-sm" onclick="showNewRecordModal('${form.table}')">+ New ${form.name.split(" ")[0]} Record</button></div>`;
    }

    html += '<div class="data-cards">';
    data.rows.forEach((row) => {
      const title = row[titleCol] || `Record #${row.id}`;
      html += `<div class="data-card" onclick="showRecordModal('${form.table}',${row.id})">`;
      html += `<div class="data-card-header"><div class="data-card-title">${escHtml(String(title))}</div><div class="data-card-id">#${row.id}</div></div>`;
      html += '<div class="data-card-fields">';
      fields.forEach((f) => {
        if (row[f] !== null && row[f] !== undefined && row[f] !== "") {
          html += `<div class="data-card-field"><span class="field-label">${humanize(f)}</span><span class="field-value">${formatCellValue(row[f], f)}</span></div>`;
        }
      });
      html += "</div>";
      const tags = getStatusTags(row, form.table);
      if (tags.length)
        html += '<div class="data-card-status">' + tags.join("") + "</div>";
      html += "</div>";
    });
    html += "</div>";
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  REPORTS VIEW — No "All Reports", blank until clicked
// ══════════════════════════════════════════════════════════════
async function renderReportsView() {
  const sidebar = document.getElementById("sidebar-content");
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = '<div class="tab-item active">📈 Reports</div>';
  sidebar.innerHTML = '<div class="loading">Loading...</div>';

  // Show EPA watermark empty state — no "All Reports"
  content.innerHTML = renderEmptyState(
    "Select a Report",
    "Choose a report type from the sidebar to generate detailed insights",
  );

  try {
    state.reports = await api("/api/reports");
    // Filter reports by feature permission
    if (state.user.role !== "admin") {
      state.reports = state.reports.filter((r) => featureCan("report", r.key));
    }
    sidebar.innerHTML = state.reports
      .map(
        (r) => `
      <div class="sidebar-item report-sidebar-item" data-key="${r.key}" onclick="selectReport('${r.key}')">
        <span class="icon">${r.icon}</span>
        <span class="label">${r.name}</span>
      </div>
    `,
      )
      .join("");
    if (state.reports.length > 0) {
      selectReport(state.reports[0].key);
    }
  } catch (err) {
    sidebar.innerHTML = `<div style="padding:16px;color:var(--red)">${err.message}</div>`;
  }
}

function selectReport(key) {
  state.selectedReport = key;
  document
    .querySelectorAll(".report-sidebar-item")
    .forEach((el) => el.classList.toggle("active", el.dataset.key === key));
  const r = state.reports.find((x) => x.key === key);
  if (!r) return;
  const content = document.getElementById("content");
  if (r.params && r.params.length > 0) {
    let html = `<div class="query-form"><h3>${r.icon} ${r.name}</h3><div class="query-desc">${r.description}</div>`;
    if (r.briefing) {
      html += `<div class="report-briefing" style="margin:12px 0"><div class="report-briefing-title">📖 About This Report</div><div class="report-briefing-text">${r.briefing}</div></div>`;
    }
    html += `<div class="query-params">`;
    r.params.forEach((p) => {
      html += `<div class="query-param-group"><label>${p.label}</label><input type="${p.type === "number" ? "number" : "text"}" id="rp-${p.name}" ${p.default ? `value="${p.default}"` : ""}></div>`;
    });
    html += `<button class="btn btn-primary btn-sm" onclick="runReportFromForm('${key}')">▶ Generate Report</button></div></div><div id="report-results"></div>`;
    content.innerHTML = html;
  } else {
    content.innerHTML = '<div class="loading">Generating report...</div>';
    executeReport(key, {});
  }
}

function runReportFromForm(key) {
  const r = state.reports.find((x) => x.key === key);
  const params = {};
  r.params.forEach((p) => {
    params[p.name] = document.getElementById(`rp-${p.name}`)?.value || "";
  });
  executeReport(key, params);
}

async function executeReport(key, params) {
  const target =
    document.getElementById("report-results") ||
    document.getElementById("content");
  try {
    const data = await api(`/api/reports/${key}/run`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    const r = state.reports.find((x) => x.key === key);
    if (data.rows.length === 0) {
      target.innerHTML = renderEmptyState(
        "No Report Data",
        "This report returned no results",
      );
      return;
    }
    const cols = Object.keys(data.rows[0]);
    // Build comprehensive report output
    let html = `<div class="report-results">`;

    // Report header
    html += `<div class="query-form" style="margin-bottom:16px"><h3>${r?.icon || "📊"} ${data.reportName || r?.name || key}</h3><div class="query-desc">${r?.description || ""} · ${data.total} records generated</div></div>`;

    // Report briefing — detailed explanation
    if (r?.briefing) {
      html += `<div class="report-briefing">
        <div class="report-briefing-title">📖 About This Report</div>
        <div class="report-briefing-text">${r.briefing}</div>
      </div>`;
    }

    // Summary metrics — extract numeric totals
    const numericCols = cols.filter((c) =>
      data.rows.every((row) => !isNaN(row[c]) && row[c] !== null),
    );
    const textCols = cols.filter((c) => !numericCols.includes(c));

    if (data.rows.length <= 10 && numericCols.length > 0) {
      // Compact report — show as summary cards + bar chart
      html += '<div class="report-summary-grid">';
      data.rows.forEach((row) => {
        html += '<div class="report-summary-card">';
        textCols.forEach((c) => {
          html += `<div class="rsl" style="margin-bottom:4px;color:var(--text-bright);font-weight:500">${escHtml(String(row[c] || "N/A"))}</div>`;
        });
        numericCols.forEach((c) => {
          html += `<div class="rsv">${typeof row[c] === "number" ? row[c].toLocaleString() : row[c]}</div><div class="rsl">${humanize(c)}</div>`;
        });
        html += "</div>";
      });
      html += "</div>";

      // Bar chart visualization for numeric data
      if (textCols.length > 0 && numericCols.length > 0) {
        const labelCol = textCols[0];
        const valCol = numericCols[0];
        const maxVal = Math.max(...data.rows.map((r) => r[valCol] || 0), 1);
        const colors = [
          "blue",
          "green",
          "orange",
          "purple",
          "teal",
          "red",
          "yellow",
        ];
        html +=
          '<div class="chart-card" style="margin-top:16px"><div class="chart-card-title">Distribution</div><div class="bar-chart">';
        data.rows.forEach((row, i) => {
          html += `<div class="bar-row">
            <div class="bar-label" title="${row[labelCol]}">${truncate(String(row[labelCol] || ""), 20)}</div>
            <div class="bar-track"><div class="bar-fill ${colors[i % colors.length]}" style="width:${Math.max(5, (row[valCol] / maxVal) * 100)}%"><span>${row[valCol]}</span></div></div>
          </div>`;
        });
        html += "</div></div>";
      }
    } else {
      // Large result set — show as data cards
      html += '<div class="data-cards">';
      data.rows.forEach((row) => {
        const title = row[cols[0]] || "Record";
        html += '<div class="data-card">';
        html += `<div class="data-card-header"><div class="data-card-title">${escHtml(String(title))}</div></div>`;
        html += '<div class="data-card-fields">';
        cols.slice(1).forEach((c) => {
          if (row[c] !== null && row[c] !== undefined && row[c] !== "") {
            html += `<div class="data-card-field"><span class="field-label">${humanize(c)}</span><span class="field-value">${formatCellValue(row[c], c)}</span></div>`;
          }
        });
        html += "</div></div>";
      });
      html += "</div>";
    }

    // Grand totals if applicable
    if (numericCols.length > 0 && data.rows.length > 1) {
      html +=
        '<div class="chart-card" style="margin-top:16px"><div class="chart-card-title">Totals</div><div style="display:flex;gap:20px;flex-wrap:wrap">';
      numericCols.forEach((c) => {
        const total = data.rows.reduce((s, r) => s + (Number(r[c]) || 0), 0);
        html += `<div><span style="font-size:20px;font-weight:700;color:var(--text-white)">${total.toLocaleString()}</span><div style="font-size:11px;color:var(--text-dim);margin-top:2px">${humanize(c)}</div></div>`;
      });
      html += "</div></div>";
    }

    html += "</div>";
    target.innerHTML = html;
  } catch (err) {
    target.innerHTML = `<div class="empty-state"><div class="empty-title">Report Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  DATA ENRICHMENT — Upload Excel, enrich with DB data, export
// ══════════════════════════════════════════════════════════════

// Module-level state for enrichment
const enrichState = {
  uploadedData: null, // { headers, allRows, totalRows }
  dbColumns: null, // { PERMIT: [...], MOVEMENT: [...], ... }
  enrichedData: null, // processed result
  stats: null, // { total, matched, unmatched, columnsAdded }
  step: 1, // current wizard step (1-4)
  uploadCol: "", // selected upload column for matching
  dbTable: "", // selected database table
  dbCol: "", // selected DB column for matching
};

async function renderEnrichmentView() {
  const sidebar = document.getElementById("sidebar-content");
  sidebar.innerHTML = `<div class="nav-section">
    <div class="nav-section-title">DATA ENRICHMENT</div>
    <button class="nav-item active" onclick="renderEnrichmentView()">\u{1F4E4} Enrich Data</button>
  </div>
  <div class="nav-section">
    <div class="nav-section-title">HOW IT WORKS</div>
    <div style="padding:8px 14px;font-size:11px;color:var(--text-dim);line-height:1.7">
      <strong>1.</strong> Upload an Excel / CSV file<br>
      <strong>2.</strong> Pick the column to filter by<br>
      <strong>3.</strong> Select the database table<br>
      <strong>4.</strong> Choose columns to add &amp; export
    </div>
  </div>`;

  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = `<div class="tab-item active">\u{1F4E4} Data Enrichment</div>`;

  // Full reset
  enrichState.uploadedData = null;
  enrichState.enrichedData = null;
  enrichState.stats = null;
  enrichState.step = 1;
  enrichState.uploadCol = "";
  enrichState.dbTable = "";
  enrichState.dbCol = "";

  // Load DB columns once
  if (!enrichState.dbColumns) {
    try {
      enrichState.dbColumns = await api("/api/enrichment/db-columns");
    } catch (e) {
      content.innerHTML = renderEmptyState(
        "Error",
        "Failed to load database columns: " + e.message,
      );
      return;
    }
  }

  enrichRebuild();
}

/** Re-render the enrichment UI into #content based on current enrichState */
function enrichRebuild() {
  const content = document.getElementById("content");
  const scrollTop = content.scrollTop; // preserve scroll position
  content.innerHTML = buildEnrichmentUI();
  setupEnrichmentDropZone();
  content.scrollTop = scrollTop; // restore scroll position
}

function buildEnrichmentUI() {
  const { uploadedData, enrichedData, stats, step } = enrichState;
  const hasUpload = !!uploadedData;
  const hasResult = !!enrichedData;

  let html = '<div class="enrich-container">';

  // ────────── Step 1: Upload File ──────────
  const s1Done = hasUpload;
  html +=
    '<div class="enrich-step ' +
    (s1Done ? "enrich-step--done" : "enrich-step--active") +
    '">' +
    '<div class="enrich-step-hdr">' +
    '<span class="enrich-step-num">' +
    (s1Done ? "\u2705" : "1") +
    "</span>" +
    '<span class="enrich-step-title">Upload Excel / CSV File</span>' +
    (s1Done
      ? '<button class="enrich-btn-sm enrich-btn-outline" onclick="enrichResetUpload()">Change File</button>'
      : "") +
    "</div>";

  if (!hasUpload) {
    html +=
      '<div class="enrich-dropzone" id="enrich-dropzone">' +
      '<div class="enrich-dropzone-inner">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--accent);margin-bottom:8px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' +
      '<p style="color:var(--text-bright);font-size:14px;font-weight:600;margin:0">Drop your file here or click to browse</p>' +
      '<p style="color:var(--text-muted);font-size:12px;margin:4px 0 0">.xlsx, .xls, or .csv \u2014 up to 30 MB</p>' +
      '<input type="file" id="enrich-file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="enrichHandleFile(this.files[0])">' +
      "</div></div>";
  } else {
    const d = uploadedData;
    html +=
      '<div class="enrich-upload-info">' +
      '<span class="enrich-upload-badge">\u2705 ' +
      d.totalRows.toLocaleString() +
      " rows  \u00B7  " +
      d.headers.length +
      " columns</span>" +
      '<div class="enrich-preview-cols">Columns: <strong>' +
      d.headers.map((h) => escHtml(h)).join("</strong>, <strong>") +
      "</strong></div>" +
      "</div>";
  }
  html += "</div>";

  // ────────── Step 2: Select Upload Column for Filtering ──────────
  if (hasUpload && !hasResult) {
    const s2Done = !!enrichState.uploadCol;
    const headers = uploadedData.headers;

    html +=
      '<div class="enrich-step ' +
      (s2Done ? "enrich-step--done" : step >= 2 ? "enrich-step--active" : "") +
      '">' +
      '<div class="enrich-step-hdr">' +
      '<span class="enrich-step-num">' +
      (s2Done ? "\u2705" : "2") +
      "</span>" +
      '<span class="enrich-step-title">Select Column for Filtering</span>' +
      (s2Done
        ? '<button class="enrich-btn-sm enrich-btn-outline" onclick="enrichChangeStep(2)">Change</button>'
        : "") +
      "</div>";

    if (step === 2 || !s2Done) {
      html +=
        '<div class="enrich-hint" style="margin-bottom:10px">Choose the column from your uploaded file whose values will be used to find matching records in the database.</div>' +
        '<div class="enrich-col-picker" id="enrich-upload-col-picker">';

      for (const h of headers) {
        const sampleVals = uploadedData.allRows
          .slice(0, 3)
          .map((r) => r[h])
          .filter((v) => v !== "" && v != null)
          .map((v) => String(v));
        const preview = sampleVals.length
          ? sampleVals
              .map((v) => escHtml(v.length > 25 ? v.slice(0, 22) + "..." : v))
              .join(", ")
          : "<em>empty</em>";
        const isSelected = enrichState.uploadCol === h;
        html +=
          '<div class="enrich-col-card' +
          (isSelected ? " enrich-col-card--selected" : "") +
          '" onclick="enrichPickUploadCol(' +
          escAttr(h) +
          ')">' +
          '<div class="enrich-col-card-name">' +
          escHtml(h) +
          "</div>" +
          '<div class="enrich-col-card-sample">' +
          preview +
          "</div>" +
          "</div>";
      }
      html += "</div>";

      if (enrichState.uploadCol) {
        html +=
          '<div class="enrich-actions"><button class="enrich-btn enrich-btn-primary" onclick="enrichGoStep(3)">Continue \u2192</button></div>';
      }
    } else {
      // Collapsed summary
      html +=
        '<div class="enrich-summary-line"><strong>Column:</strong> <span class="enrich-col-tag">' +
        escHtml(enrichState.uploadCol) +
        "</span></div>";
    }
    html += "</div>";
  }

  // ────────── Step 3: Select Database Table ──────────
  if (hasUpload && !hasResult && enrichState.uploadCol && step >= 3) {
    const dbCols = enrichState.dbColumns || {};
    const tables = Object.keys(dbCols);
    const s3Done = !!enrichState.dbTable && !!enrichState.dbCol;

    html +=
      '<div class="enrich-step ' +
      (s3Done ? "enrich-step--done" : "enrich-step--active") +
      '">' +
      '<div class="enrich-step-hdr">' +
      '<span class="enrich-step-num">' +
      (s3Done ? "\u2705" : "3") +
      "</span>" +
      '<span class="enrich-step-title">Select Database Table</span>' +
      (s3Done && step > 3
        ? '<button class="enrich-btn-sm enrich-btn-outline" onclick="enrichChangeStep(3)">Change</button>'
        : "") +
      "</div>";

    if (step === 3) {
      html +=
        '<div class="enrich-config-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="enrich-config-group">' +
        '<label class="enrich-label">Database Table</label>' +
        '<select id="enrich-db-table" class="enrich-select" onchange="enrichTableSelected()">' +
        '<option value="">\u2014 Select table \u2014</option>' +
        tables
          .map(
            (t) =>
              '<option value="' +
              escHtml(t) +
              '"' +
              (t === enrichState.dbTable ? " selected" : "") +
              ">" +
              escHtml(t) +
              "</option>",
          )
          .join("") +
        "</select></div>" +
        '<div class="enrich-config-group">' +
        '<label class="enrich-label">Match Against Column</label>' +
        '<select id="enrich-db-col" class="enrich-select" onchange="enrichDbColSelected()">' +
        '<option value="">\u2014 Select column \u2014</option>';

      if (enrichState.dbTable) {
        const tCols = dbCols[enrichState.dbTable] || [];
        html += tCols
          .map(
            (c) =>
              '<option value="' +
              escHtml(c) +
              '"' +
              (c === enrichState.dbCol ? " selected" : "") +
              ">" +
              escHtml(c) +
              "</option>",
          )
          .join("");
      }
      html +=
        "</select>" +
        '<div class="enrich-hint">The database column whose values should match your file\u2019s <em>' +
        escHtml(enrichState.uploadCol) +
        "</em> column</div>" +
        "</div></div>";

      // Match preview
      if (enrichState.dbTable && enrichState.dbCol) {
        const sampleVals = uploadedData.allRows
          .slice(0, 5)
          .map((r) => r[enrichState.uploadCol])
          .filter(Boolean);
        html +=
          '<div class="enrich-preview-box" style="margin-top:14px">' +
          "<strong>Match preview:</strong> Your <em>" +
          escHtml(enrichState.uploadCol) +
          "</em> \u2192 DB <em>" +
          escHtml(enrichState.dbCol) +
          "</em> in " +
          escHtml(enrichState.dbTable) +
          "<br>" +
          "<strong>Sample values:</strong> " +
          sampleVals
            .slice(0, 5)
            .map((v) => "<code>" + escHtml(String(v)) + "</code>")
            .join(", ") +
          "</div>";
        html +=
          '<div class="enrich-actions"><button class="enrich-btn enrich-btn-primary" onclick="enrichGoStep(4)">Continue \u2192</button></div>';
      }
    } else {
      // Collapsed summary
      html +=
        '<div class="enrich-summary-line"><strong>Table:</strong> <span class="enrich-col-tag">' +
        escHtml(enrichState.dbTable) +
        "</span>" +
        ' &nbsp;\u2192&nbsp; <strong>Match:</strong> <span class="enrich-col-tag">' +
        escHtml(enrichState.uploadCol) +
        " = " +
        escHtml(enrichState.dbCol) +
        "</span></div>";
    }
    html += "</div>";
  }

  // ────────── Step 4: Select Columns to Add ──────────
  if (
    hasUpload &&
    !hasResult &&
    enrichState.dbTable &&
    enrichState.dbCol &&
    step >= 4
  ) {
    const tableCols = (enrichState.dbColumns || {})[enrichState.dbTable] || [];
    const uploadHeaders = uploadedData.headers.map((h) => h.toLowerCase());

    html +=
      '<div class="enrich-step enrich-step--active">' +
      '<div class="enrich-step-hdr">' +
      '<span class="enrich-step-num">4</span>' +
      '<span class="enrich-step-title">Select Columns to Add</span>' +
      "</div>" +
      '<div class="enrich-hint" style="margin-bottom:10px">Choose one or more database columns to append to your file as new columns.</div>' +
      '<div class="enrich-search-row">' +
      '<input type="text" id="enrich-col-search" class="enrich-search" placeholder="Search columns..." oninput="enrichFilterColumns()">' +
      '<button class="enrich-btn-sm enrich-btn-outline" onclick="enrichSelectAll()">Select All</button>' +
      '<button class="enrich-btn-sm enrich-btn-outline" onclick="enrichDeselectAll()">Deselect All</button>' +
      "</div>" +
      '<div class="enrich-cols-grid" id="enrich-cols-grid">';

    for (const c of tableCols) {
      const inFile = uploadHeaders.includes(c.toLowerCase());
      html +=
        '<label class="enrich-col-check' +
        (inFile ? " enrich-col-check--dim" : "") +
        '" data-col="' +
        escHtml(c.toLowerCase()) +
        '">' +
        '<input type="checkbox" value="' +
        escHtml(c) +
        '" onchange="enrichColsChanged()"> ' +
        "<span>" +
        escHtml(c) +
        "</span>" +
        (inFile ? '<em class="enrich-col-existing">(in file)</em>' : "") +
        "</label>";
    }

    html +=
      "</div>" +
      '<div class="enrich-selected-summary" id="enrich-selected-summary"></div>' +
      '<div class="enrich-actions">' +
      '<button class="enrich-btn enrich-btn-primary" onclick="enrichProcess()" id="enrich-process-btn" disabled>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
      " Enrich Data</button></div>" +
      "</div>";
  }

  // ────────── Results ──────────
  if (hasResult) {
    const s = stats;
    const matchPct = s.total > 0 ? Math.round((s.matched / s.total) * 100) : 0;

    html +=
      '<div class="enrich-step enrich-step--active">' +
      '<div class="enrich-step-hdr">' +
      '<span class="enrich-step-num">\u2705</span>' +
      '<span class="enrich-step-title">Enrichment Complete</span>' +
      "</div>" +
      '<div class="enrich-stats-bar">' +
      '<div class="enrich-stat-card enrich-stat--blue"><div class="enrich-stat-val">' +
      s.total.toLocaleString() +
      '</div><div class="enrich-stat-lbl">Total Rows</div></div>' +
      '<div class="enrich-stat-card enrich-stat--green"><div class="enrich-stat-val">' +
      s.matched.toLocaleString() +
      '</div><div class="enrich-stat-lbl">Matched (' +
      matchPct +
      "%)</div></div>" +
      '<div class="enrich-stat-card enrich-stat--red"><div class="enrich-stat-val">' +
      s.unmatched.toLocaleString() +
      '</div><div class="enrich-stat-lbl">Unmatched</div></div>' +
      '<div class="enrich-stat-card enrich-stat--purple"><div class="enrich-stat-val">' +
      s.columnsAdded.length +
      '</div><div class="enrich-stat-lbl">Columns Added</div></div>' +
      "</div>" +
      '<div class="enrich-added-cols"><strong>Added columns:</strong> ' +
      s.columnsAdded
        .map((c) => '<span class="enrich-col-tag">' + escHtml(c) + "</span>")
        .join(" ") +
      "</div>" +
      '<div class="enrich-result-preview"><div class="enrich-table-wrap"><table class="enrich-table" id="enrich-result-table"></table></div></div>' +
      '<div class="enrich-actions">' +
      '<button class="enrich-btn enrich-btn-primary" onclick="enrichExport()">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      " Download as Excel</button>" +
      '<button class="enrich-btn enrich-btn-outline" onclick="enrichResetAll()">Start Over</button>' +
      "</div></div>";
  }

  html += "</div>";
  return html;
}

// ── Step navigation ──────────────────────

function enrichPickUploadCol(col) {
  enrichState.uploadCol = col;
  enrichState.step = 2;
  // Reset downstream
  enrichState.dbTable = "";
  enrichState.dbCol = "";
  enrichRebuild();
}

function enrichGoStep(n) {
  enrichState.step = n;
  enrichRebuild();
}

function enrichChangeStep(n) {
  enrichState.step = n;
  // Reset downstream state
  if (n <= 2) {
    enrichState.dbTable = "";
    enrichState.dbCol = "";
  }
  if (n <= 3) {
    enrichState.enrichedData = null;
    enrichState.stats = null;
  }
  enrichRebuild();
}

function enrichTableSelected() {
  const sel = document.getElementById("enrich-db-table");
  enrichState.dbTable = sel ? sel.value : "";
  enrichState.dbCol = "";

  // auto-select DB column if name matches upload column
  if (enrichState.dbTable && enrichState.uploadCol) {
    const tCols = (enrichState.dbColumns || {})[enrichState.dbTable] || [];
    const upLower = enrichState.uploadCol.toLowerCase();
    const exact = tCols.find((c) => c.toLowerCase() === upLower);
    if (exact) enrichState.dbCol = exact;
    else {
      // Try common heuristics
      const likely = [
        "RegisteredNameOfUndertaking",
        "PermitNumber",
        "PermitHolder",
        "NameofFile",
        "FileNumber",
      ];
      for (const l of likely) {
        if (tCols.includes(l)) {
          enrichState.dbCol = l;
          break;
        }
      }
    }
  }

  enrichRebuild();
}

function enrichDbColSelected() {
  const sel = document.getElementById("enrich-db-col");
  enrichState.dbCol = sel ? sel.value : "";
  enrichRebuild();
}

// ── Drop zone / file upload ──────────────

function setupEnrichmentDropZone() {
  const dz = document.getElementById("enrich-dropzone");
  if (!dz) return;
  dz.addEventListener("click", () =>
    document.getElementById("enrich-file-input").click(),
  );
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("dragover");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("dragover");
    if (e.dataTransfer.files.length) enrichHandleFile(e.dataTransfer.files[0]);
  });
}

async function enrichHandleFile(file) {
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    toast("Please upload an .xlsx, .xls, or .csv file", "error");
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    toast("File too large (max 30 MB)", "error");
    return;
  }

  const content = document.getElementById("content");
  const origHtml = content.innerHTML;
  content.innerHTML =
    '<div class="loading">Uploading and parsing file...</div>';

  try {
    const formData = new FormData();
    formData.append("file", file);
    const resp = await fetch("/api/enrichment/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + state.token },
      body: formData,
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || "Upload failed");

    enrichState.uploadedData = result;
    enrichState.enrichedData = null;
    enrichState.stats = null;
    enrichState.step = 2;
    enrichState.uploadCol = "";
    enrichState.dbTable = "";
    enrichState.dbCol = "";
    enrichRebuild();
    toast(
      "File uploaded: " +
        result.totalRows +
        " rows, " +
        result.headers.length +
        " columns",
      "success",
    );
  } catch (e) {
    toast("Upload failed: " + e.message, "error");
    content.innerHTML = origHtml;
    setupEnrichmentDropZone();
  }
}

// ── Column selection helpers ─────────────

function enrichFilterColumns() {
  const search = (
    document.getElementById("enrich-col-search")?.value || ""
  ).toLowerCase();
  document
    .querySelectorAll("#enrich-cols-grid .enrich-col-check")
    .forEach((el) => {
      const col = el.dataset.col || "";
      el.style.display = !search || col.includes(search) ? "" : "none";
    });
}

function enrichSelectAll() {
  document
    .querySelectorAll("#enrich-cols-grid input[type=checkbox]")
    .forEach((cb) => {
      if (cb.closest(".enrich-col-check").style.display !== "none")
        cb.checked = true;
    });
  enrichColsChanged();
}

function enrichDeselectAll() {
  document
    .querySelectorAll("#enrich-cols-grid input[type=checkbox]")
    .forEach((cb) => (cb.checked = false));
  enrichColsChanged();
}

function enrichColsChanged() {
  const selected = [];
  document
    .querySelectorAll("#enrich-cols-grid input[type=checkbox]:checked")
    .forEach((cb) => selected.push(cb.value));

  const btn = document.getElementById("enrich-process-btn");
  if (btn) btn.disabled = selected.length === 0;

  const summary = document.getElementById("enrich-selected-summary");
  if (summary) {
    if (selected.length > 0) {
      summary.innerHTML =
        '<div class="enrich-preview-box" style="margin-top:12px"><strong>Columns to add (' +
        selected.length +
        "):</strong> " +
        selected
          .map((c) => '<span class="enrich-col-tag">' + escHtml(c) + "</span>")
          .join(" ") +
        "</div>";
    } else {
      summary.innerHTML = "";
    }
  }
}

// ── Processing ───────────────────────────

async function enrichProcess() {
  const selected = [];
  document
    .querySelectorAll("#enrich-cols-grid input[type=checkbox]:checked")
    .forEach((cb) => selected.push(cb.value));

  if (
    !enrichState.uploadCol ||
    !enrichState.dbTable ||
    !enrichState.dbCol ||
    selected.length === 0
  ) {
    toast("Please complete all steps before processing", "error");
    return;
  }

  const btn = document.getElementById("enrich-process-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  try {
    const result = await api("/api/enrichment/process", {
      method: "POST",
      body: JSON.stringify({
        uploadedRows: enrichState.uploadedData.allRows,
        matchConfig: {
          uploadColumn: enrichState.uploadCol,
          dbTable: enrichState.dbTable,
          dbColumn: enrichState.dbCol,
        },
        columnsToAdd: selected,
      }),
    });

    enrichState.enrichedData = result.enrichedRows;
    enrichState.stats = result.stats;
    enrichRebuild();
    enrichRenderResultTable();

    const pct =
      result.stats.total > 0
        ? Math.round((result.stats.matched / result.stats.total) * 100)
        : 0;
    toast(
      "Enrichment complete: " +
        result.stats.matched +
        "/" +
        result.stats.total +
        " matched (" +
        pct +
        "%)",
      "success",
    );
  } catch (e) {
    toast("Enrichment failed: " + e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enrich Data";
    }
  }
}

function enrichRenderResultTable() {
  const table = document.getElementById("enrich-result-table");
  if (!table || !enrichState.enrichedData?.length) return;

  const rows = enrichState.enrichedData;
  const allCols = Object.keys(rows[0]);
  const addedCols = enrichState.stats?.columnsAdded || [];
  const previewRows = rows.slice(0, 100);

  let thead =
    "<thead><tr>" +
    allCols
      .map((c) => {
        const isAdded = addedCols.includes(c);
        return (
          '<th class="' +
          (isAdded ? "enrich-th-added" : "") +
          '">' +
          escHtml(c) +
          (isAdded ? " \u2728" : "") +
          "</th>"
        );
      })
      .join("") +
    "</tr></thead>";

  let tbody =
    "<tbody>" +
    previewRows
      .map((row) => {
        return (
          "<tr>" +
          allCols
            .map((c) => {
              const isAdded = addedCols.includes(c);
              const val =
                row[c] !== undefined && row[c] !== null ? String(row[c]) : "";
              const isEmpty = isAdded && !val;
              return (
                '<td class="' +
                (isAdded
                  ? isEmpty
                    ? "enrich-td-empty"
                    : "enrich-td-added"
                  : "") +
                '">' +
                escHtml(truncate(val, 40)) +
                "</td>"
              );
            })
            .join("") +
          "</tr>"
        );
      })
      .join("") +
    "</tbody>";

  table.innerHTML = thead + tbody;
  if (rows.length > 100) {
    const note = document.createElement("div");
    note.className = "enrich-table-note";
    note.textContent =
      "Showing first 100 of " +
      rows.length.toLocaleString() +
      " rows. Full data will be in the download.";
    table.parentElement.appendChild(note);
  }
}

// ── Export ────────────────────────────────

async function enrichExport() {
  if (!enrichState.enrichedData?.length) {
    toast("No enriched data to export", "error");
    return;
  }

  try {
    const resp = await fetch("/api/enrichment/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.token,
      },
      body: JSON.stringify({
        rows: enrichState.enrichedData,
        filename: "enriched_data_" + new Date().toISOString().slice(0, 10),
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || "Export failed");
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "enriched_data_" + new Date().toISOString().slice(0, 10) + ".xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Excel file downloaded", "success");
  } catch (e) {
    toast("Export failed: " + e.message, "error");
  }
}

// ── Resets ────────────────────────────────

function enrichResetUpload() {
  enrichState.uploadedData = null;
  enrichState.enrichedData = null;
  enrichState.stats = null;
  enrichState.step = 1;
  enrichState.uploadCol = "";
  enrichState.dbTable = "";
  enrichState.dbCol = "";
  enrichRebuild();
}

function enrichResetAll() {
  enrichResetUpload();
}

// ══════════════════════════════════════════════════════════════
//  ACTIVITY LOG VIEW
// ══════════════════════════════════════════════════════════════
function buildActivityChangesHtml(a) {
  if (!a.old_values && !a.new_values) return "";
  let html = `<div class="activity-changes" style="display:none" id="changes-${a.id}">`;
  try {
    const oldObj = a.old_values ? JSON.parse(a.old_values) : {};
    const newObj = a.new_values ? JSON.parse(a.new_values) : {};
    const allKeys = [
      ...new Set([...Object.keys(oldObj), ...Object.keys(newObj)]),
    ].filter((k) => k !== "id");

    if (a.action === "UPDATE_RECORD" && allKeys.length > 0) {
      // Show only changed fields with before/after comparison
      html += '<div class="change-diff">';
      for (const key of allKeys) {
        const oldVal = oldObj[key] ?? "<em>empty</em>";
        const newVal = newObj[key] ?? "<em>empty</em>";
        html += `<div class="change-diff-row">
          <span class="change-diff-field">${humanize(key)}</span>
          <span class="change-diff-old">${escHtml(String(oldVal))}</span>
          <span class="change-diff-arrow">→</span>
          <span class="change-diff-new">${escHtml(String(newVal))}</span>
        </div>`;
      }
      html += "</div>";
    } else if (a.action === "DELETE_RECORD" && Object.keys(oldObj).length > 0) {
      html +=
        '<div class="change-block"><strong>Deleted Record:</strong><div class="change-data">';
      for (const [k, v] of Object.entries(oldObj)) {
        if (k !== "id" && v !== null && v !== "")
          html += `<span class="change-field"><strong>${humanize(k)}:</strong> ${escHtml(String(v))}</span>`;
      }
      html += "</div></div>";
    } else if (a.action === "CREATE_RECORD" && Object.keys(newObj).length > 0) {
      html +=
        '<div class="change-block"><strong>Created Record:</strong><div class="change-data">';
      for (const [k, v] of Object.entries(newObj)) {
        if (k !== "id" && v !== null && v !== "")
          html += `<span class="change-field"><strong>${humanize(k)}:</strong> ${escHtml(String(v))}</span>`;
      }
      html += "</div></div>";
    } else {
      // Fallback — show raw
      if (a.old_values)
        html += `<div class="change-block"><strong>Before:</strong><div class="change-data">${Object.entries(
          oldObj,
        )
          .map(
            ([k, v]) =>
              `<span class="change-field">${humanize(k)}: ${v}</span>`,
          )
          .join("")}</div></div>`;
      if (a.new_values)
        html += `<div class="change-block"><strong>After:</strong><div class="change-data">${Object.entries(
          newObj,
        )
          .map(
            ([k, v]) =>
              `<span class="change-field">${humanize(k)}: ${v}</span>`,
          )
          .join("")}</div></div>`;
    }
  } catch (e) {
    if (a.old_values)
      html += `<div class="change-block"><strong>Before:</strong> ${escHtml(a.old_values)}</div>`;
    if (a.new_values)
      html += `<div class="change-block"><strong>After:</strong> ${escHtml(a.new_values)}</div>`;
  }
  html += "</div>";
  return html;
}

function buildActivityItemHtml(a) {
  const iconClass = getActivityIconClass(a.action);
  const canRevert = [
    "CREATE_RECORD",
    "UPDATE_RECORD",
    "DELETE_RECORD",
  ].includes(a.action);
  const changesHtml = buildActivityChangesHtml(a);
  return `<div class="activity-item" data-text="${escHtml((a.action + " " + a.username + " " + (a.target_name || "") + " " + (a.target_type || "")).toLowerCase())}">
    <div class="activity-icon ${iconClass}">${getActivityEmoji(a.action)}</div>
    <div class="activity-body">
      <div class="activity-action">${a.username} · ${formatAction(a.action)}</div>
      <div class="activity-meta">${a.target_type || ""}${a.target_name ? " · " + a.target_name : ""}${a.details ? " — " + a.details : ""}</div>
      ${changesHtml ? `<button class="btn btn-sm" style="margin-top:4px;font-size:10px;padding:2px 8px" onclick="let el=document.getElementById('changes-${a.id}');el.style.display=el.style.display==='none'?'block':'none'">📋 Details</button>` : ""}
      ${changesHtml}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      <div class="activity-time">${formatTimeAgo(a.created_at)}</div>
      ${
        state.user.role === "admin"
          ? `<div style="display:flex;gap:4px">
        ${canRevert ? `<button class="btn btn-sm" style="font-size:10px;padding:2px 6px" onclick="revertActivity(${a.id})" title="Revert this action">↩️ Revert</button>` : ""}
        <button class="btn btn-danger btn-sm" style="font-size:10px;padding:2px 6px" onclick="deleteActivityLog(${a.id})" title="Delete log entry">🗑️</button>
      </div>`
          : ""
      }
    </div>
  </div>`;
}

async function renderActivityView() {
  const sidebar = document.getElementById("sidebar-content");
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = '<div class="tab-item active">🕐 Activity Log</div>';
  sidebar.innerHTML =
    '<div class="sidebar-item active"><span class="icon">📋</span><span class="label">All Activity</span></div>';
  content.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const userFilter = state.activityUserFilter || "";
    state.activityUserFilter = null; // Clear after use
    const apiUrl = userFilter
      ? `/api/activity?limit=100&user=${encodeURIComponent(userFilter)}`
      : `/api/activity?limit=100`;
    const data = await api(apiUrl);
    const filterLabel = userFilter ? ` for @${escHtml(userFilter)}` : "";
    let html = `<div class="search-bar"><div class="search-box"><span class="search-icon">🔍</span><input type="search" placeholder="Search activity..." oninput="debouncedFilterActivity(this.value)"></div><span class="search-info">${data.total} entries${filterLabel}</span>${userFilter ? `<button class="btn btn-sm" onclick="renderActivityView()" title="Clear filter">✕ Clear Filter</button>` : ""}</div>`;
    html += '<div class="activity-cards" id="activity-card-list">';
    data.rows.forEach((a) => {
      html += buildActivityItemHtml(a);
    });
    html += "</div>";
    if (data.pages > 1) {
      const { page, pages, total } = data;
      let pg = '<div class="pagination">';
      pg += `<button ${page <= 1 ? "disabled" : ""} onclick="loadActivityPage(${page - 1})">‹ Prev</button>`;
      const pstart = Math.max(1, page - 2),
        pend = Math.min(pages, page + 2);
      if (pstart > 1) {
        pg += `<button onclick="loadActivityPage(1)">1</button>`;
        if (pstart > 2) pg += '<span class="page-info">…</span>';
      }
      for (let i = pstart; i <= pend; i++)
        pg += `<button class="${i === page ? "active" : ""}" onclick="loadActivityPage(${i})">${i}</button>`;
      if (pend < pages) {
        if (pend < pages - 1) pg += '<span class="page-info">…</span>';
        pg += `<button onclick="loadActivityPage(${pages})">${pages}</button>`;
      }
      pg += `<button ${page >= pages ? "disabled" : ""} onclick="loadActivityPage(${page + 1})">Next ›</button>`;
      pg += `<span class="page-info">Page ${page} of ${pages}</span></div>`;
      html += pg;
    }
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

async function loadActivityPage(p) {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const data = await api(`/api/activity?limit=100&page=${p}`);
    let html = `<div class="search-bar"><div class="search-box"><span class="search-icon">🔍</span><input type="search" placeholder="Search activity..." oninput="debouncedFilterActivity(this.value)"></div><span class="search-info">${data.total} total entries</span></div>`;
    html += '<div class="activity-cards" id="activity-card-list">';
    data.rows.forEach((a) => {
      html += buildActivityItemHtml(a);
    });
    html += "</div>";
    if (data.pages > 1) {
      const { page, pages, total } = data;
      let pg = '<div class="pagination">';
      pg += `<button ${page <= 1 ? "disabled" : ""} onclick="loadActivityPage(${page - 1})">‹ Prev</button>`;
      const pstart = Math.max(1, page - 2),
        pend = Math.min(pages, page + 2);
      if (pstart > 1) {
        pg += `<button onclick="loadActivityPage(1)">1</button>`;
        if (pstart > 2) pg += '<span class="page-info">…</span>';
      }
      for (let i = pstart; i <= pend; i++)
        pg += `<button class="${i === page ? "active" : ""}" onclick="loadActivityPage(${i})">${i}</button>`;
      if (pend < pages) {
        if (pend < pages - 1) pg += '<span class="page-info">…</span>';
        pg += `<button onclick="loadActivityPage(${pages})">${pages}</button>`;
      }
      pg += `<button ${page >= pages ? "disabled" : ""} onclick="loadActivityPage(${page + 1})">Next ›</button>`;
      pg += `<span class="page-info">Page ${page} of ${pages}</span></div>`;
      html += pg;
    }
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function filterActivityCards(term) {
  const lower = term.toLowerCase();
  document.querySelectorAll(".activity-item").forEach((el) => {
    el.style.display = (el.dataset.text || "").includes(lower) ? "" : "none";
  });
}
function debouncedFilterActivity(val) {
  clearTimeout(activitySearchTimer);
  activitySearchTimer = setTimeout(() => filterActivityCards(val), 300);
}

// ══════════════════════════════════════════════════════════════
//  USERS VIEW
// ══════════════════════════════════════════════════════════════
async function renderUsersView() {
  const sidebar = document.getElementById("sidebar-content");
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = '<div class="tab-item active">👤 Users</div>';
  sidebar.innerHTML =
    '<div class="sidebar-item active"><span class="icon">👥</span><span class="label">All Users</span></div>';
  content.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const users = await api("/api/users");
    state._usersData = {};
    users.forEach((u) => {
      state._usersData[u.id] = u;
    });
    let html = `<div style="margin-bottom:16px"><button class="btn btn-primary btn-sm" onclick="showAddUserModal()">+ Add User</button></div>`;
    html += '<div class="user-cards">';
    users.forEach((u) => {
      const isOther = u.id !== state.user.id;
      html += `<div class="user-card" ${isOther ? `oncontextmenu="showUserContextMenu(event,${u.id})"` : ""}>
        <div class="user-avatar">${escHtml((u.full_name || u.username)[0].toUpperCase())}</div>
        <div class="user-name">${escHtml(u.full_name || u.username)}</div>
        <div style="font-size:12px;color:var(--text-dim)">@${escHtml(u.username)}</div>
        <div class="user-role ${escHtml(u.role)}">${escHtml(u.role)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Joined ${formatDate(u.created_at)}</div>
        ${isOther ? '<div style="font-size:10px;color:var(--text-muted);margin-top:6px;opacity:0.6">Right-click for options</div>' : '<div style="font-size:10px;color:var(--accent);margin-top:6px">(You)</div>'}
      </div>`;
    });
    html += "</div>";
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function showAddUserModal() {
  let modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  modal.innerHTML = `<div class="modal" style="width:420px">
    <div class="modal-header"><h3>Add User</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
    <div class="modal-body" style="padding:20px">
      <div class="form-group" style="margin-bottom:12px"><label>Username</label><input id="add-user-name" style="width:100%"></div>
      <div class="form-group" style="margin-bottom:12px"><label>Full Name</label><input id="add-user-fullname" style="width:100%"></div>
      <div class="form-group" style="margin-bottom:12px"><label>Password</label><input type="password" id="add-user-pass" style="width:100%"></div>
      <div class="form-group"><label>Role</label><select id="add-user-role" style="width:100%"><option value="user">User</option><option value="admin">Admin</option></select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-primary btn-sm" onclick="addUser()">Create User</button><button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button></div>
  </div>`;
  document.body.appendChild(modal);
}

async function addUser() {
  const btn = document.querySelector(".modal-footer .btn-primary");
  const restoreBtn = setButtonLoading(btn, "Creating...");
  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("add-user-name").value,
        fullName: document.getElementById("add-user-fullname").value,
        password: document.getElementById("add-user-pass").value,
        role: document.getElementById("add-user-role").value,
      }),
    });
    document.querySelector(".modal-overlay").remove();
    toast("User created", "success");
    renderUsersView();
  } catch (err) {
    toast(err.message, "error");
    restoreBtn();
  }
}

function showEditUserModal(id, username, fullName, role) {
  let modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  modal.innerHTML = `<div class="modal" style="width:420px">
    <div class="modal-header"><h3>Edit User: ${username}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
    <div class="modal-body" style="padding:20px">
      <div class="form-group" style="margin-bottom:12px"><label>Full Name</label><input id="edit-user-fullname" value="${escHtml(fullName)}" style="width:100%"></div>
      <div class="form-group" style="margin-bottom:12px"><label>Role</label><select id="edit-user-role" style="width:100%"><option value="user" ${role === "user" ? "selected" : ""}>User</option><option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option></select></div>
      <div class="form-group"><label>New Password (leave blank to keep)</label>
        <div class="password-wrapper">
          <input type="password" id="edit-user-pass" style="width:100%">
          <button type="button" class="password-toggle" onclick="togglePasswordVisibility(this)" tabindex="-1" title="Show password">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-primary btn-sm" onclick="editUser(${id})">Save</button><button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button></div>
  </div>`;
  document.body.appendChild(modal);
}

async function editUser(id) {
  const btn = document.querySelector(".modal-footer .btn-primary");
  const restoreBtn = setButtonLoading(btn, "Saving...");
  const body = {
    fullName: document.getElementById("edit-user-fullname").value,
    role: document.getElementById("edit-user-role").value,
  };
  const pw = document.getElementById("edit-user-pass").value;
  if (pw) body.password = pw;
  try {
    await api(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    document.querySelector(".modal-overlay").remove();
    toast("User updated", "success");
    renderUsersView();
  } catch (err) {
    toast(err.message, "error");
    restoreBtn();
  }
}

async function deleteUser(id) {
  if (
    !(await showConfirmModal(
      "Are you sure you want to delete this user? This action cannot be undone.",
      {
        title: "Delete User",
        icon: "👤",
        confirmText: "Delete User",
        danger: true,
      },
    ))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/users/${id}`, { method: "DELETE" });
    toast("User deleted", "success");
    renderUsersView();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ══════════════════════════════════════════════════════════════
//  SETTINGS VIEW
// ══════════════════════════════════════════════════════════════
function renderSettingsView() {
  const sidebar = document.getElementById("sidebar-content");
  const content = document.getElementById("content");
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = '<div class="tab-item active">⚙️ Settings</div>';

  let sidebarHtml =
    '<div class="sidebar-item active" onclick="showSettingsProfile()"><span class="icon">👤</span><span class="label">Profile</span></div>';
  sidebarHtml +=
    '<div class="sidebar-item" onclick="showSettingsPassword()"><span class="icon">🔒</span><span class="label">Change Password</span></div>';
  if (state.user.role === "admin") {
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsDataMgmt()"><span class="icon">🗄️</span><span class="label">Data Management</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsBackup()"><span class="icon">☁️</span><span class="label">Backup & Restore</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsDocuments()"><span class="icon">📂</span><span class="label">Document Folder</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsUpdates()"><span class="icon">🔄</span><span class="label">Updates</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsClientAccess()"><span class="icon">📡</span><span class="label">Client Access</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsEmployees()"><span class="icon">👥</span><span class="label">Employees</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsDropdowns()"><span class="icon">📝</span><span class="label">Dropdown Menus</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsCustomFields()"><span class="icon">➕</span><span class="label">Custom Fields</span></div>';
    sidebarHtml +=
      '<div class="sidebar-item" onclick="showSettingsFieldRenames()"><span class="icon">✏️</span><span class="label">Field Labels</span></div>';
  }
  sidebarHtml +=
    '<div class="sidebar-item" onclick="showSettingsAbout()"><span class="icon">ℹ️</span><span class="label">About</span></div>';
  sidebar.innerHTML = sidebarHtml;

  // Auto-show Profile
  showSettingsProfile();
}

function showSettingsProfile() {
  updateSettingsSidebar("Profile");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="settings-section">
      <h3>👤 Profile Information</h3>
      <div class="setting-row"><label>Username</label><input value="${state.user.username}" disabled></div>
      <div class="setting-row"><label>Full Name</label><input value="${state.user.fullName || ""}" disabled></div>
      <div class="setting-row"><label>Role</label><input value="${state.user.role}" disabled></div>
    </div>
  `;
}

function showSettingsPassword() {
  updateSettingsSidebar("Change Password");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="settings-section">
      <h3>🔒 Change Password</h3>
      <div class="setting-row"><label>Current Password</label>
        <div class="password-wrapper">
          <input type="password" id="set-curr-pw">
          <button type="button" class="password-toggle" onclick="togglePasswordVisibility(this)" tabindex="-1" title="Show password">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="setting-row"><label>New Password</label>
        <div class="password-wrapper">
          <input type="password" id="set-new-pw">
          <button type="button" class="password-toggle" onclick="togglePasswordVisibility(this)" tabindex="-1" title="Show password">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div style="margin-top:12px"><button class="btn btn-primary btn-sm" id="change-pw-btn" onclick="changePassword()">Update Password</button></div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
//  DROPDOWN MENUS SETTINGS
// ════════════════════════════════════════════════════════════
async function showSettingsDropdowns() {
  updateSettingsSidebar("Dropdown Menus");
  var content = document.getElementById("content");
  content.innerHTML =
    '<div class="loading">Loading dropdown configuration...</div>';
  try {
    var tables = ["PERMIT", "MOVEMENT", "WASTE", "Stores", "tbl_keyword"];
    var allOpts = {};
    for (var t of tables) allOpts[t] = await api("/api/dropdown-options/" + t);
    window._ddAllOpts = allOpts;

    var h = '<div class="settings-section"><h3>Dropdown Menu Management</h3>';
    h +=
      '<p style="color:var(--text-dim);font-size:12px;margin-bottom:16px">Add or remove options for dropdown fields across all database tables. Built-in options cannot be removed.</p>';
    h += '<div class="setting-row"><label>Select Table</label>';
    h +=
      '<select id="dd-table-select" class="enrich-select" style="max-width:300px">';
    tables.forEach(function (t, i) {
      h +=
        '<option value="' +
        t +
        '"' +
        (i === 0 ? " selected" : "") +
        ">" +
        t +
        "</option>";
    });
    h += "</select></div>";
    h += '<div id="dd-fields-container"></div></div>';
    content.innerHTML = h;

    document
      .getElementById("dd-table-select")
      .addEventListener("change", ddRenderFields);
    ddRenderFields();
  } catch (e) {
    content.innerHTML =
      '<div class="settings-section"><h3>Error</h3><p>' +
      escHtml(e.message) +
      "</p></div>";
  }
}

function ddRenderFields() {
  var table = document.getElementById("dd-table-select").value;
  var opts = window._ddAllOpts[table] || {};
  var container = document.getElementById("dd-fields-container");
  var fields = Object.keys(opts);
  if (!fields.length) {
    container.innerHTML =
      '<p style="color:var(--text-muted);padding:12px">No dropdown fields for this table.</p>';
    return;
  }

  var h = '<div style="margin-top:16px">';
  fields.forEach(function (field) {
    var values = opts[field] || [];
    var fid = field.replace(/[^a-zA-Z0-9]/g, "_");
    h += '<div class="dd-field-group">';
    h +=
      '<div class="dd-field-hdr" data-toggle="' +
      fid +
      '" style="cursor:pointer">';
    h += '<span class="dd-field-name">' + escHtml(field) + "</span>";
    h += '<span class="dd-field-count">' + values.length + " options</span>";
    h +=
      '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)" class="dd-toggle-lbl">&#9654; Expand</span>';
    h += "</div>";
    h +=
      '<div class="dd-field-body" id="dd-body-' +
      fid +
      '" style="display:none">';
    values.forEach(function (v) {
      h +=
        '<div class="dd-option-row"><span class="dd-option-val">' +
        escHtml(v) +
        "</span>";
      h +=
        '<button class="dd-option-del" data-action="dd-del" data-table="' +
        escHtml(table) +
        '" data-field="' +
        escHtml(field) +
        '" data-value="' +
        escHtml(v) +
        '" title="Remove">&#10005;</button></div>';
    });
    h += '<div class="dd-add-row">';
    h +=
      '<input type="text" placeholder="Add new option..." class="dd-add-input" id="dd-add-' +
      fid +
      '">';
    h +=
      '<button class="btn-primary" data-action="dd-add" data-table="' +
      escHtml(table) +
      '" data-field="' +
      escHtml(field) +
      '" data-input="dd-add-' +
      fid +
      '" style="padding:4px 12px;font-size:11px">Add</button>';
    h += "</div></div></div>";
  });
  h += "</div>";
  container.innerHTML = h;

  // Event delegation for all clicks in the container
  container.onclick = function (e) {
    var btn = e.target.closest("[data-action]");
    var toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      var body = document.getElementById(
        "dd-body-" + toggle.getAttribute("data-toggle"),
      );
      if (body) {
        var vis = body.style.display === "none";
        body.style.display = vis ? "block" : "none";
        var lbl = toggle.querySelector(".dd-toggle-lbl");
        if (lbl) lbl.innerHTML = vis ? "&#9660; Collapse" : "&#9654; Expand";
      }
      return;
    }
    if (!btn) return;
    var act = btn.getAttribute("data-action");
    if (act === "dd-del")
      ddRemoveOption(
        btn.getAttribute("data-table"),
        btn.getAttribute("data-field"),
        btn.getAttribute("data-value"),
      );
    if (act === "dd-add") {
      var inp = document.getElementById(btn.getAttribute("data-input"));
      if (inp && inp.value.trim())
        ddAddOption(
          btn.getAttribute("data-table"),
          btn.getAttribute("data-field"),
          inp.value.trim(),
        );
    }
  };
}

async function ddAddOption(table, field, value) {
  if (!value) {
    toast("Enter a value to add", "error");
    return;
  }
  try {
    await api(
      "/api/dropdown-options/" + table + "/" + encodeURIComponent(field),
      { method: "POST", body: JSON.stringify({ value: value }) },
    );
    toast("Option added", "success");
    window._ddAllOpts[table] = await api("/api/dropdown-options/" + table);
    if (window._fieldOptionsCache) delete window._fieldOptionsCache[table];
    ddRenderFields();
  } catch (e) {
    toast("Failed: " + e.message, "error");
  }
}

async function ddRemoveOption(table, field, value) {
  if (!confirm('Remove "' + value + '" from ' + field + "?")) return;
  try {
    await api(
      "/api/dropdown-options/" +
        table +
        "/" +
        encodeURIComponent(field) +
        "/" +
        encodeURIComponent(value),
      { method: "DELETE" },
    );
    toast("Option removed", "success");
    window._ddAllOpts[table] = await api("/api/dropdown-options/" + table);
    if (window._fieldOptionsCache) delete window._fieldOptionsCache[table];
    ddRenderFields();
  } catch (e) {
    toast("Failed: " + e.message, "error");
  }
}

// ════════════════════════════════════════════════════════════
//  CUSTOM FIELDS SETTINGS
// ════════════════════════════════════════════════════════════
async function showSettingsCustomFields() {
  updateSettingsSidebar("Custom Fields");
  var content = document.getElementById("content");
  content.innerHTML =
    '<div class="loading">Loading field configuration...</div>';
  try {
    var tables = ["PERMIT", "MOVEMENT", "WASTE", "Stores", "tbl_keyword"];
    var allCols = {},
      allCustom = {};
    for (var t of tables) {
      allCols[t] = await api("/api/tables/" + t + "/columns");
      allCustom[t] = await api("/api/custom-fields/" + t);
    }
    window._cfAllCols = allCols;
    window._cfAllCustom = allCustom;

    var h = '<div class="settings-section"><h3>Custom Fields Management</h3>';
    h +=
      '<p style="color:var(--text-dim);font-size:12px;margin-bottom:16px">Add new fields (columns) to database tables. Built-in fields cannot be removed.</p>';
    h += '<div class="setting-row"><label>Select Table</label>';
    h +=
      '<select id="cf-table-select" class="enrich-select" style="max-width:300px">';
    tables.forEach(function (t, i) {
      h +=
        '<option value="' +
        t +
        '"' +
        (i === 0 ? " selected" : "") +
        ">" +
        t +
        "</option>";
    });
    h += "</select></div>";

    // Add field form
    h +=
      '<div class="cf-add-form"><h4 style="color:var(--text-white);margin-bottom:10px">Add New Field</h4>';
    h += '<div class="cf-add-grid">';
    h +=
      '<div><label class="enrich-label">Field Name</label><input type="text" id="cf-new-name" class="enrich-search" placeholder="e.g. InspectionDate"></div>';
    h +=
      '<div><label class="enrich-label">Display Label</label><input type="text" id="cf-new-label" class="enrich-search" placeholder="e.g. Inspection Date"></div>';
    h +=
      '<div><label class="enrich-label">Field Type</label><select id="cf-new-type" class="enrich-select">';
    h +=
      '<option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="dropdown">Dropdown</option>';
    h += "</select></div></div>";
    h +=
      '<div id="cf-dropdown-opts-area" style="display:none;margin-top:10px">';
    h += '<label class="enrich-label">Dropdown Options (one per line)</label>';
    h +=
      '<textarea id="cf-dropdown-opts" class="enrich-search" style="width:100%;height:80px;resize:vertical" placeholder="Option 1"></textarea>';
    h += "</div>";
    h +=
      '<div style="margin-top:12px"><button class="btn-primary" id="cf-add-btn" style="padding:8px 20px">Add Field to Table</button></div>';
    h += "</div>";

    h += '<div id="cf-fields-container" style="margin-top:20px"></div></div>';
    content.innerHTML = h;

    document
      .getElementById("cf-table-select")
      .addEventListener("change", cfRenderFields);
    document
      .getElementById("cf-new-type")
      .addEventListener("change", function () {
        document.getElementById("cf-dropdown-opts-area").style.display =
          this.value === "dropdown" ? "block" : "none";
      });
    document.getElementById("cf-add-btn").addEventListener("click", cfAddField);
    cfRenderFields();
  } catch (e) {
    content.innerHTML =
      '<div class="settings-section"><h3>Error</h3><p>' +
      escHtml(e.message) +
      "</p></div>";
  }
}

function cfRenderFields() {
  var table = document.getElementById("cf-table-select").value;
  var cols = window._cfAllCols[table] || [];
  var customSet = {};
  (window._cfAllCustom[table] || []).forEach(function (c) {
    customSet[c.field_name] = true;
  });
  var container = document.getElementById("cf-fields-container");

  var h =
    '<h4 style="color:var(--text-white);margin-bottom:10px">Existing Fields in ' +
    escHtml(table) +
    " (" +
    cols.length +
    ")</h4>";
  h += '<div class="cf-fields-grid">';
  cols.forEach(function (col) {
    var isCustom = !!customSet[col.name];
    h +=
      '<div class="cf-field-card' +
      (isCustom ? " cf-field-card--custom" : "") +
      '">';
    h += '<div class="cf-field-name">' + escHtml(col.name) + "</div>";
    h +=
      '<div class="cf-field-type">' +
      (col.type || "TEXT") +
      (isCustom
        ? ' &middot; <em style="color:var(--accent)">Custom</em>'
        : " &middot; Built-in") +
      "</div>";
    if (isCustom)
      h +=
        '<button class="dd-option-del" data-action="cf-del" data-table="' +
        escHtml(table) +
        '" data-field="' +
        escHtml(col.name) +
        '" title="Remove custom field" style="position:absolute;top:6px;right:6px">&#10005;</button>';
    h += "</div>";
  });
  h += "</div>";
  container.innerHTML = h;

  container.onclick = function (e) {
    var btn = e.target.closest("[data-action='cf-del']");
    if (btn)
      cfRemoveField(
        btn.getAttribute("data-table"),
        btn.getAttribute("data-field"),
      );
  };
}

async function cfAddField() {
  var table = document.getElementById("cf-table-select").value;
  var name = (document.getElementById("cf-new-name").value || "").trim();
  var label = (document.getElementById("cf-new-label").value || "").trim();
  var type = document.getElementById("cf-new-type").value;
  var optsText = document.getElementById("cf-dropdown-opts").value || "";
  if (!name) {
    toast("Field name is required", "error");
    return;
  }
  var dropdownOptions =
    type === "dropdown"
      ? optsText
          .split("\n")
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
      : [];
  try {
    await api("/api/custom-fields/" + table, {
      method: "POST",
      body: JSON.stringify({
        fieldName: name,
        displayName: label || name,
        fieldType: type,
        dropdownOptions: dropdownOptions,
      }),
    });
    toast("Field '" + name + "' added to " + table, "success");
    document.getElementById("cf-new-name").value = "";
    document.getElementById("cf-new-label").value = "";
    document.getElementById("cf-dropdown-opts").value = "";
    window._cfAllCols[table] = await api("/api/tables/" + table + "/columns");
    window._cfAllCustom[table] = await api("/api/custom-fields/" + table);
    cfRenderFields();
  } catch (e) {
    toast("Failed: " + e.message, "error");
  }
}

async function cfRemoveField(table, field) {
  if (
    !confirm(
      'Remove custom field "' +
        field +
        '" from ' +
        table +
        "? This may delete associated data.",
    )
  )
    return;
  try {
    await api("/api/custom-fields/" + table + "/" + encodeURIComponent(field), {
      method: "DELETE",
    });
    toast("Field removed", "success");
    window._cfAllCols[table] = await api("/api/tables/" + table + "/columns");
    window._cfAllCustom[table] = await api("/api/custom-fields/" + table);
    cfRenderFields();
  } catch (e) {
    toast("Failed: " + e.message, "error");
  }
}

// ════════════════════════════════════════════════════════════
//  FIELD LABELS / RENAMING SETTINGS
// ════════════════════════════════════════════════════════════
async function showSettingsFieldRenames() {
  updateSettingsSidebar("Field Labels");
  var content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading field labels...</div>';
  try {
    var tables = ["PERMIT", "MOVEMENT", "WASTE", "Stores", "tbl_keyword"];
    var allCols = {};
    var allRenames = await api("/api/field-renames");
    for (var t of tables)
      allCols[t] = await api("/api/tables/" + t + "/columns");
    window._frAllCols = allCols;
    window._frAllRenames = allRenames || {};

    var h = '<div class="settings-section"><h3>Field Label Management</h3>';
    h +=
      '<p style="color:var(--text-dim);font-size:12px;margin-bottom:16px">Customize display labels for database fields. Changes affect how field names appear in forms and tables. Leave blank to use the original name.</p>';
    h += '<div class="setting-row"><label>Select Table</label>';
    h +=
      '<select id="fr-table-select" class="enrich-select" style="max-width:300px">';
    tables.forEach(function (t, i) {
      h +=
        '<option value="' +
        t +
        '"' +
        (i === 0 ? " selected" : "") +
        ">" +
        t +
        "</option>";
    });
    h += "</select></div>";
    h += '<div id="fr-fields-container" style="margin-top:16px"></div>';
    h +=
      '<div style="margin-top:16px"><button class="btn-primary" id="fr-save-btn" style="padding:8px 24px">Save All Labels</button></div>';
    h += "</div>";
    content.innerHTML = h;
    document
      .getElementById("fr-table-select")
      .addEventListener("change", frRenderFields);
    document.getElementById("fr-save-btn").addEventListener("click", frSaveAll);
    frRenderFields();
  } catch (e) {
    content.innerHTML =
      '<div class="settings-section"><h3>Error</h3><p>' +
      escHtml(e.message) +
      "</p></div>";
  }
}

function frRenderFields() {
  var table = document.getElementById("fr-table-select").value;
  var cols = window._frAllCols[table] || [];
  var renames = (window._frAllRenames || {})[table] || {};
  var container = document.getElementById("fr-fields-container");
  var h = '<div class="fr-grid">';
  cols.forEach(function (col) {
    var current = renames[col.name] || "";
    h += '<div class="fr-row">';
    h += '<div class="fr-original">' + escHtml(col.name) + "</div>";
    h += '<div class="fr-arrow">&rarr;</div>';
    h +=
      '<input type="text" class="fr-input" data-field="' +
      escHtml(col.name) +
      '" value="' +
      escHtml(current) +
      '" placeholder="' +
      escHtml(col.name) +
      '">';
    h += "</div>";
  });
  h += "</div>";
  container.innerHTML = h;
}

async function frSaveAll() {
  var table = document.getElementById("fr-table-select").value;
  var inputs = document.querySelectorAll(".fr-input");
  var renames = {};
  inputs.forEach(function (inp) {
    var field = inp.getAttribute("data-field");
    var val = (inp.value || "").trim();
    if (val) renames[field] = val;
  });
  try {
    await api("/api/field-renames/" + table, {
      method: "PUT",
      body: JSON.stringify({ renames: renames }),
    });
    toast("Field labels saved for " + table, "success");
    window._frAllRenames = window._frAllRenames || {};
    window._frAllRenames[table] = renames;
    _fieldRenameCache = window._frAllRenames;
    _fieldRenameCacheTime = Date.now();
    if (window._fieldOptionsCache) delete window._fieldOptionsCache[table];
  } catch (e) {
    toast("Failed: " + e.message, "error");
  }
}

// ════════════════════════════════════════════════════════════
//  FIELD RENAME CACHE (used by renderFormField)
// ════════════════════════════════════════════════════════════
var _fieldRenameCache = null;
var _fieldRenameCacheTime = 0;

async function loadFieldRenames() {
  var now = Date.now();
  if (_fieldRenameCache && now - _fieldRenameCacheTime < 120000)
    return _fieldRenameCache;
  try {
    _fieldRenameCache = await api("/api/field-renames");
    _fieldRenameCacheTime = now;
  } catch (e) {
    _fieldRenameCache = {};
  }
  return _fieldRenameCache;
}

function getFieldLabel(table, fieldName) {
  if (!_fieldRenameCache) return humanize(fieldName);
  var tableRenames = _fieldRenameCache[table];
  if (!tableRenames || !tableRenames[fieldName]) return humanize(fieldName);
  return tableRenames[fieldName];
}

function showSettingsAbout() {
  updateSettingsSidebar("About");
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading...</div>';
  api("/api/update/version")
    .then((v) => {
      content.innerHTML = `
      <div class="settings-section">
        <h3>ℹ️ About</h3>
        <p style="color:var(--text-dim);font-size:13px;line-height:1.8">
          <strong style="color:var(--text-white);font-size:15px">EPA Database System v${escHtml(v.version || "4.0")}</strong><br>
          Environmental Protection Agency<br>
          Database Management System<br><br>
          © 2026 EPA Ghana
        </p>
      </div>
      <div class="settings-section" style="margin-top:16px">
        <h3>🌐 Client Access</h3>
        <p style="color:var(--text-dim);font-size:13px;line-height:1.8">
          Other users can connect to this database by opening a web browser and navigating to this computer's IP address on port 3000.<br>
          Example: <code style="color:var(--accent)">http://192.168.x.x:3000</code>
        </p>
      </div>
    `;
    })
    .catch(() => {
      content.innerHTML = `<div class="settings-section"><h3>ℹ️ About</h3><p style="color:var(--text-dim)">EPA Database System<br>© 2026 EPA Ghana</p></div>`;
    });
}

// ── Software Updates (Admin) ──────────────────────────────────
async function showSettingsUpdates() {
  updateSettingsSidebar("Updates");
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Checking for updates...</div>';
  try {
    const [version, updates] = await Promise.all([
      api("/api/update/version"),
      api("/api/update/available"),
    ]);
    let filesHtml = "";
    if (updates.files && updates.files.length > 0) {
      filesHtml = updates.files
        .map((f) => {
          const sizeStr =
            f.size > 1048576
              ? (f.size / 1048576).toFixed(1) + " MB"
              : (f.size / 1024).toFixed(0) + " KB";
          const dateStr = new Date(f.modified).toLocaleDateString();
          return `<div class="attachment-item">
          <span class="att-icon">📦</span>
          <span class="att-name">${escHtml(f.name)}</span>
          <span class="att-size">${sizeStr} · ${dateStr}</span>
          <div class="att-actions">
            <button class="att-btn danger" onclick="deleteUpdateFile('${escHtml(f.name)}')" title="Delete">✕</button>
          </div>
        </div>`;
        })
        .join("");
    } else {
      filesHtml =
        '<div style="color:var(--text-muted);font-size:13px;padding:8px">No update files available.</div>';
    }

    content.innerHTML = `
      <div class="settings-section">
        <h3>🔄 Software Updates</h3>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
          Current version: <strong style="color:var(--accent)">v${escHtml(version.version || "unknown")}</strong>
        </p>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;line-height:1.6">
          To update the EPA Database System, upload the new installer (.exe) file below.
          After uploading, close the app, run the new installer (it will update the existing installation), and relaunch.
        </p>
      </div>

      <div class="settings-section" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:20px">
        <h3>📤 Upload Update File</h3>
        <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px">Upload a new setup .exe file. The file will be saved to the updates folder.</p>
        <div style="margin-bottom:12px">
          <input type="file" id="update-file-input" accept=".exe,.msi,.zip" style="display:none" onchange="uploadUpdateFile(this)">
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('update-file-input').click()">📁 Choose Update File</button>
          <span id="update-file-status" style="margin-left:12px;color:var(--text-dim);font-size:13px"></span>
        </div>
      </div>

      <div class="settings-section" style="margin-top:16px">
        <h3>📦 Available Update Files</h3>
        <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px">Updates folder: <code style="color:var(--text-muted);font-size:11px">${escHtml(updates.updateDir || "")}</code></p>
        <div id="update-files-list">${filesHtml}</div>
      </div>

      <div class="settings-section" style="margin-top:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);padding:20px">
        <h3>📋 How to Update</h3>
        <div style="color:var(--text-dim);font-size:13px;line-height:1.8">
          <ol style="padding-left:20px">
            <li>Upload or place the new installer in the updates folder shown above</li>
            <li>Close this application (File → Quit or system tray → Quit)</li>
            <li>Navigate to the updates folder and run the new setup file</li>
            <li>The installer will update the application files while preserving your data</li>
            <li>Relaunch the EPA Database System from your desktop shortcut</li>
          </ol>
          <p style="margin-top:8px;color:var(--accent)">💡 Your database, backups, and all user data are stored separately and will NOT be affected by updates.</p>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

async function uploadUpdateFile(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById("update-file-status");
  status.textContent = "Uploading...";
  status.style.color = "var(--accent)";
  const formData = new FormData();
  formData.append("updateFile", file);
  try {
    const headers = {};
    if (state.token) headers["Authorization"] = "Bearer " + state.token;
    const res = await fetch("/api/update/upload", {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast("Update file uploaded successfully", "success");
    showSettingsUpdates(); // Refresh the list
  } catch (err) {
    status.textContent = err.message;
    status.style.color = "var(--red)";
  }
  input.value = "";
}

async function deleteUpdateFile(filename) {
  if (
    !(await showConfirmModal("Delete this update file?", {
      title: "Delete Update",
      icon: "📦",
      confirmText: "Delete",
      danger: true,
    }))
  )
    return;
  try {
    await api(`/api/update/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    toast("Update file deleted", "success");
    showSettingsUpdates();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function showSettingsConnect() {
  showSettingsClientAccess();
}

async function showSettingsClientAccess() {
  updateSettingsSidebar("Client Access");
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading network info...</div>';

  try {
    const [netInfo, codeInfo] = await Promise.all([
      api("/api/admin/network-info"),
      api("/api/admin/access-code"),
    ]);

    // Generate QR code for the primary URL
    const primaryUrl =
      netInfo.urls && netInfo.urls[0]
        ? netInfo.urls[0]
        : `http://${netInfo.hostname}:${netInfo.port}`;
    let qrData = null;
    try {
      qrData = await api(
        `/api/admin/qrcode?url=${encodeURIComponent(primaryUrl)}`,
      );
    } catch (e) {}

    let html = `<div class="settings-section">
      <h3>📡 Client Access</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:24px">Manage how clients connect to this database. Share the QR code or connection link with authorized staff.</p>

      <!-- Connection Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;text-align:center">
          <div style="font-size:14px;font-weight:600;color:var(--text-white);margin-bottom:12px">📱 Scan to Connect</div>
          ${qrData ? `<img src="${qrData.qr}" alt="QR Code" style="width:200px;height:200px;border-radius:8px;margin-bottom:8px">` : '<div style="padding:40px;color:var(--text-muted)">QR unavailable</div>'}
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Point any phone camera at this code</div>
        </div>

        <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">
          <div style="font-size:14px;font-weight:600;color:var(--text-white);margin-bottom:16px">🌐 Connection URLs</div>`;

    // Show all network URLs
    if (netInfo.urls) {
      netInfo.urls.forEach((url, i) => {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <input value="${escHtml(url)}" readonly style="flex:1;font-size:13px;font-family:monospace;padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--accent)">
          <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${escHtml(url)}');toast('Copied!','success')" title="Copy">📋</button>
        </div>`;
      });
    }
    // Hostname URL
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <input value="${escHtml(netInfo.hostnameUrl)}" readonly style="flex:1;font-size:13px;font-family:monospace;padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-bright)">
      <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${escHtml(netInfo.hostnameUrl)}');toast('Copied!','success')" title="Copy">📋</button>
    </div>`;
    html += `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">💡 The hostname URL <b>${escHtml(netInfo.hostname)}</b> works on most local networks without knowing the IP.</div>`;
    html += `</div></div>`;

    // Network Interfaces
    html += `<div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:var(--text-white);margin-bottom:8px">📊 Network Interfaces</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">`;
    (netInfo.ips || []).forEach((ip) => {
      html += `<div style="background:var(--bg-primary);padding:8px 12px;border-radius:6px;font-size:12px">
        <div style="color:var(--text-muted)">${escHtml(ip.name)}</div>
        <div style="color:var(--accent);font-weight:600;font-family:monospace">${escHtml(ip.address)}</div>
      </div>`;
    });
    html += `</div></div>`;

    // mDNS Status
    html += `<div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:var(--text-white);margin-bottom:8px">📡 Auto-Discovery (mDNS)</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px">This server broadcasts itself as <b>"EPA Database System"</b> on the local network using mDNS. Devices with mDNS support can discover it automatically.</p>
      <div style="font-size:12px;color:var(--text-muted)">
        <div>• <b>Windows:</b> Use <code style="padding:2px 6px;background:var(--bg-primary);border-radius:4px">http://${escHtml(netInfo.hostname)}:${netInfo.port}</code> (works via LLMNR/NetBIOS)</div>
        <div style="margin-top:4px">• <b>macOS/iOS:</b> mDNS resolution is built-in</div>
        <div style="margin-top:4px">• <b>Android:</b> Most modern devices support mDNS</div>
      </div>
    </div>`;

    // Access Code Section
    html += `<div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:14px;font-weight:600;color:var(--text-white)">🔐 Access Code</div>
        <span class="tag ${codeInfo.enabled ? "tag-green" : "tag-yellow"}" style="font-size:11px">${codeInfo.enabled ? "ENABLED" : "DISABLED"}</span>
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:16px">When enabled, users must enter this 6-digit code before they can see the login page. This adds an extra barrier so that not everyone on the network can attempt to log in.</p>`;

    if (codeInfo.enabled) {
      html += `<div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;font-family:monospace;color:var(--accent);background:var(--bg-primary);display:inline-block;padding:12px 24px;border-radius:12px;border:2px dashed var(--border)">${escHtml(codeInfo.code)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Share this code verbally or on a notice board — not digitally</div>
      </div>`;
    }

    html += `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="generateNewAccessCode()">🎲 Generate New Code</button>
      <button class="btn btn-sm" onclick="setCustomAccessCode()">✏️ Set Custom Code</button>
      ${codeInfo.enabled ? '<button class="btn btn-sm" style="color:var(--red)" onclick="disableAccessCode()">🚫 Disable Code</button>' : ""}
    </div></div>`;

    // Instructions
    html += `<div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px">
      <div style="font-size:13px;font-weight:600;color:var(--text-white);margin-bottom:8px">📋 Quick Setup Guide for New Clients</div>
      <ol style="font-size:12px;color:var(--text-dim);padding-left:20px;line-height:1.8">
        <li>Connect the client device to the <b>same network</b> as this computer</li>
        <li>Open any web browser (Chrome, Firefox, Edge, Safari)</li>
        <li>Scan the QR code above, or type the connection URL in the address bar</li>
        ${codeInfo.enabled ? "<li>Enter the <b>6-digit access code</b> when prompted</li>" : ""}
        <li>Log in with the username and password provided by admin</li>
        <li>Bookmark the page for quick access next time</li>
      </ol>
    </div>`;

    html += `</div>`;
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

async function generateNewAccessCode() {
  try {
    const data = await api("/api/admin/access-code/generate", {
      method: "POST",
    });
    toast(`New access code: ${data.code}`, "success");
    showSettingsClientAccess();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function setCustomAccessCode() {
  const result = await showFormModal({
    title: "Set Custom Access Code",
    icon: "🔐",
    fields: [
      {
        key: "code",
        label: "6-Digit Access Code",
        placeholder: "Enter a 6-digit code",
        required: true,
      },
    ],
    confirmText: "Set Code",
  });
  if (!result) return;
  const code = result.code.trim();
  if (!/^\d{6}$/.test(code)) {
    toast("Code must be exactly 6 digits", "error");
    return;
  }
  try {
    await api("/api/admin/access-code", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    toast("Access code updated", "success");
    showSettingsClientAccess();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function disableAccessCode() {
  if (
    !(await showConfirmModal(
      "Disable the access code? Anyone on the network will be able to see the login page.",
      {
        title: "Disable Access Code",
        icon: "🔐",
        confirmText: "Disable",
        danger: true,
      },
    ))
  )
    return;
  try {
    await api("/api/admin/access-code", {
      method: "POST",
      body: JSON.stringify({ code: "" }),
    });
    toast("Access code disabled", "success");
    showSettingsClientAccess();
  } catch (err) {
    toast(err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════
//  Employee Management Settings
// ══════════════════════════════════════════════════════════════
async function showSettingsEmployees() {
  updateSettingsSidebar("Employees");
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading employees...</div>';
  state._empSelectedIds = new Set();

  try {
    const employees = await api("/api/employees?all=1");
    state._empData = employees;

    let html = `<div class="settings-section">
      <h3>👥 Employees / Officers</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">Manage the list of officers and employees. These names appear in autocomplete dropdowns when assigning officers to permit files.</p>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center">
        <button class="btn btn-primary btn-sm" onclick="addEmployeeDialog()">➕ Add Employee</button>
        <button class="btn btn-sm" onclick="importEmployeesDialog()">📄 Import from File</button>
        <div id="emp-bulk-actions" style="display:none;margin-left:auto;display:none;gap:8px;align-items:center">
          <span id="emp-sel-count" style="font-size:12px;color:var(--accent);font-weight:600"></span>
          <button class="btn btn-sm" onclick="bulkToggleEmployees(1)" title="Set Active">✅ Activate</button>
          <button class="btn btn-sm" onclick="bulkToggleEmployees(0)" title="Set Inactive">⏸️ Deactivate</button>
          <button class="btn btn-sm" onclick="bulkDeleteEmployees()" style="color:var(--red)" title="Delete Selected">🗑️ Delete</button>
          <button class="btn btn-sm" onclick="clearEmpSelection()">✖ Clear</button>
        </div>
      </div>`;

    if (employees.length === 0) {
      html += `<div class="empty-state" style="padding:40px">
        <div class="empty-title">No employees yet</div>
        <div class="empty-desc">Add employees individually or import a list from a text/CSV file.<br>
        You can add the file later — just use the "Import from File" button above.</div>
      </div>`;
    } else {
      html += `<div style="margin-bottom:12px;color:var(--text-muted);font-size:12px">${employees.length} employee${employees.length !== 1 ? "s" : ""} total</div>`;
      html += `<div style="margin-bottom:12px">
        <input type="search" id="emp-search" placeholder="Search employees..." oninput="filterEmployeeList()" style="max-width:320px;width:100%">
      </div>`;
      html += '<div id="emp-list-container">';
      html += renderEmployeeTable(employees);
      html += "</div>";
    }

    html += `</div>`;
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function renderEmployeeTable(employees) {
  let html = `<table class="data-table" style="width:100%">
    <thead><tr>
      <th style="width:36px"><input type="checkbox" id="emp-select-all" onchange="toggleAllEmployees(this.checked)" title="Select all"></th>
      <th style="width:36px">#</th>
      <th>Full Name</th>
      <th>Position</th>
      <th>Department</th>
      <th style="width:70px">Status</th>
    </tr></thead><tbody>`;
  employees.forEach((emp, i) => {
    const checked = state._empSelectedIds?.has(emp.id) ? " checked" : "";
    html += `<tr data-emp-id="${emp.id}" data-emp-name="${escHtml(emp.full_name.toLowerCase())}" oncontextmenu="showEmpContextMenu(event,${emp.id})" onclick="handleEmpRowClick(event,${emp.id})" style="cursor:pointer">
      <td onclick="event.stopPropagation()"><input type="checkbox" class="emp-cb" data-id="${emp.id}" onchange="toggleEmpSelect(${emp.id},this.checked)"${checked}></td>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td style="font-weight:500;color:var(--text-white)">${escHtml(emp.full_name)}</td>
      <td style="color:var(--text-dim)">${escHtml(emp.position || "—")}</td>
      <td style="color:var(--text-dim)">${escHtml(emp.department || "—")}</td>
      <td><span class="tag ${emp.active ? "tag-green" : "tag-yellow"}" style="font-size:10px">${emp.active ? "Active" : "Inactive"}</span></td>
    </tr>`;
  });
  html += "</tbody></table>";
  return html;
}

function handleEmpRowClick(e, id) {
  if (e.target.tagName === "INPUT") return;
  const emp = (state._empData || []).find((x) => x.id === id);
  if (!emp) return;
  editEmployeeDialog(
    emp.id,
    emp.full_name,
    emp.position || "",
    emp.department || "",
    emp.active,
  );
}

function toggleEmpSelect(id, checked) {
  if (!state._empSelectedIds) state._empSelectedIds = new Set();
  if (checked) state._empSelectedIds.add(id);
  else state._empSelectedIds.delete(id);
  updateEmpBulkUI();
}

function toggleAllEmployees(checked) {
  if (!state._empData) return;
  if (!state._empSelectedIds) state._empSelectedIds = new Set();
  const visible = document.querySelectorAll(
    "#emp-list-container tr[data-emp-id]",
  );
  visible.forEach((row) => {
    if (row.style.display === "none") return;
    const id = parseInt(row.dataset.empId);
    const cb = row.querySelector(".emp-cb");
    if (checked) {
      state._empSelectedIds.add(id);
      if (cb) cb.checked = true;
    } else {
      state._empSelectedIds.delete(id);
      if (cb) cb.checked = false;
    }
  });
  updateEmpBulkUI();
}

function clearEmpSelection() {
  if (state._empSelectedIds) state._empSelectedIds.clear();
  document.querySelectorAll(".emp-cb").forEach((cb) => (cb.checked = false));
  const selAll = document.getElementById("emp-select-all");
  if (selAll) selAll.checked = false;
  updateEmpBulkUI();
}

function updateEmpBulkUI() {
  const count = state._empSelectedIds?.size || 0;
  const bar = document.getElementById("emp-bulk-actions");
  const countEl = document.getElementById("emp-sel-count");
  if (bar) bar.style.display = count > 0 ? "flex" : "none";
  if (countEl) countEl.textContent = `${count} selected`;
  // Highlight selected rows
  document
    .querySelectorAll("#emp-list-container tr[data-emp-id]")
    .forEach((row) => {
      const id = parseInt(row.dataset.empId);
      row.style.background = state._empSelectedIds?.has(id)
        ? "rgba(0,120,212,0.08)"
        : "";
    });
}

function showEmpContextMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();
  const emp = (state._empData || []).find((x) => x.id === id);
  if (!emp) return;
  // If right-clicked item is not selected, select only it
  if (!state._empSelectedIds?.has(id)) {
    clearEmpSelection();
    state._empSelectedIds.add(id);
    const cb = document.querySelector(`.emp-cb[data-id="${id}"]`);
    if (cb) cb.checked = true;
    updateEmpBulkUI();
  }
  const count = state._empSelectedIds?.size || 0;
  let html =
    '<div class="context-menu" style="left:' +
    e.clientX +
    "px;top:" +
    e.clientY +
    'px">';
  if (count > 1) {
    html += `<button class="context-menu-item" onclick="closeContextMenu();bulkToggleEmployees(1)">✅ Activate ${count} Selected</button>`;
    html += `<button class="context-menu-item" onclick="closeContextMenu();bulkToggleEmployees(0)">⏸️ Deactivate ${count} Selected</button>`;
    html += '<div class="context-menu-sep"></div>';
    html += `<button class="context-menu-item danger" onclick="closeContextMenu();bulkDeleteEmployees()">🗑️ Delete ${count} Selected</button>`;
  } else {
    html += `<button class="context-menu-item" onclick="closeContextMenu();editEmployeeDialog(${emp.id},${JSON.stringify(emp.full_name)},${JSON.stringify(emp.position || "")},${JSON.stringify(emp.department || "")},${emp.active})">✏️ Edit</button>`;
    html += `<button class="context-menu-item" onclick="closeContextMenu();bulkToggleEmployees(${emp.active ? 0 : 1})">${emp.active ? "⏸️ Deactivate" : "✅ Activate"}</button>`;
    html += '<div class="context-menu-sep"></div>';
    html += `<button class="context-menu-item danger" onclick="closeContextMenu();deleteEmployee(${emp.id},${JSON.stringify(emp.full_name)})">🗑️ Delete</button>`;
  }
  html += "</div>";
  document.body.insertAdjacentHTML("beforeend", html);
  const menu = document.querySelector(".context-menu");
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth)
    menu.style.left = window.innerWidth - rect.width - 8 + "px";
  if (rect.bottom > window.innerHeight)
    menu.style.top = window.innerHeight - rect.height - 8 + "px";
}

async function bulkDeleteEmployees() {
  const ids = Array.from(state._empSelectedIds || []);
  if (ids.length === 0) return;
  if (
    !(await showConfirmModal(`Delete ${ids.length} employee(s) permanently?`, {
      title: "Bulk Delete",
      icon: "🗑️",
      confirmText: `Delete ${ids.length}`,
      danger: true,
    }))
  )
    return;
  showProgressBar();
  try {
    await api("/api/employees/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    toast(`${ids.length} employee(s) deleted`, "success");
    state._empSelectedIds.clear();
    showSettingsEmployees();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function bulkToggleEmployees(activeVal) {
  const ids = Array.from(state._empSelectedIds || []);
  if (ids.length === 0) return;
  const label = activeVal ? "activate" : "deactivate";
  if (
    !(await showConfirmModal(
      `${activeVal ? "Activate" : "Deactivate"} ${ids.length} employee(s)?`,
      {
        title: `Bulk ${activeVal ? "Activate" : "Deactivate"}`,
        icon: activeVal ? "✅" : "⏸️",
        confirmText: `${activeVal ? "Activate" : "Deactivate"} ${ids.length}`,
      },
    ))
  )
    return;
  showProgressBar();
  try {
    await api("/api/employees/bulk-update", {
      method: "POST",
      body: JSON.stringify({ ids, active: activeVal }),
    });
    toast(`${ids.length} employee(s) ${label}d`, "success");
    state._empSelectedIds.clear();
    showSettingsEmployees();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

function filterEmployeeList() {
  const q = (document.getElementById("emp-search")?.value || "").toLowerCase();
  document
    .querySelectorAll("#emp-list-container tr[data-emp-id]")
    .forEach((row) => {
      row.style.display = (row.dataset.empName || "").includes(q) ? "" : "none";
    });
}

async function addEmployeeDialog() {
  const result = await showFormModal({
    title: "Add Employee",
    icon: "👤",
    fields: [
      {
        key: "full_name",
        label: "Full Name",
        placeholder: "Enter employee's full name",
        required: true,
      },
      {
        key: "position",
        label: "Position / Title",
        placeholder: "e.g. Environmental Officer",
      },
      {
        key: "department",
        label: "Department",
        placeholder: "e.g. Compliance",
      },
    ],
    confirmText: "Add Employee",
  });
  if (!result) return;
  showProgressBar();
  try {
    await api("/api/employees", {
      method: "POST",
      body: JSON.stringify({
        full_name: result.full_name.trim(),
        position: result.position.trim(),
        department: result.department.trim(),
      }),
    });
    toast(`${result.full_name.trim()} added`, "success");
    showSettingsEmployees();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function editEmployeeDialog(id, name, position, department, active) {
  const result = await showFormModal({
    title: "Edit Employee",
    icon: "✏️",
    fields: [
      { key: "full_name", label: "Full Name", value: name, required: true },
      { key: "position", label: "Position / Title", value: position },
      { key: "department", label: "Department", value: department },
      {
        key: "active",
        label: "Status",
        type: "checkbox",
        value: !!active,
        checkLabel: "Currently active",
      },
    ],
    confirmText: "Save Changes",
  });
  if (!result) return;
  showProgressBar();
  try {
    await api(`/api/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        full_name: result.full_name.trim(),
        position: (result.position || "").trim(),
        department: (result.department || "").trim(),
        active: result.active,
      }),
    });
    toast("Employee updated", "success");
    showSettingsEmployees();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function deleteEmployee(id, name) {
  if (
    !(await showConfirmModal(`Delete employee "${name}" from the list?`, {
      title: "Delete Employee",
      icon: "🗑️",
      confirmText: "Delete",
      danger: true,
    }))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    toast(`${name} deleted`, "success");
    showSettingsEmployees();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function importEmployeesDialog() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.csv,.text";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    showProgressBar();
    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast(data.message, "success");
      showSettingsEmployees();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      removeProgressBar();
    }
  };
  input.click();
}

function showSettingsDataMgmt() {
  updateSettingsSidebar("Data Management");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="settings-section">
      <h3>🗄️ Data Management</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">Manage the application's data — clear existing records or import new data from a Microsoft Access file.</p>
    </div>

    <div class="settings-section" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;">
      <h3>📤 Upload Access Database</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">Upload a Microsoft Access file (.accdb or .mdb) to preview and selectively import data. You can choose which tables and columns to import.</p>
      <div style="margin-bottom:12px">
        <input type="file" id="access-file-input" accept=".accdb,.mdb" style="display:none" onchange="handleAccessPreview(this)">
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('access-file-input').click()">📁 Choose Access File</button>
        <span id="access-file-name" style="margin-left:12px;color:var(--text-dim);font-size:13px">No file selected</span>
      </div>
      <div id="upload-progress" style="display:none">
        <div class="loading">Analyzing Access file... This may take a moment.</div>
      </div>
      <div id="import-preview-container"></div>
      <div id="upload-results" style="display:none"></div>
    </div>

    <div class="settings-section" style="border:1px solid var(--red);border-radius:var(--radius-md);padding:20px;margin-top:20px;">
      <h3 style="color:var(--red)">⚠️ Clear All Data</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">This will permanently delete <strong>ALL records</strong> from the data tables (Permits, Movements, Waste, Stores, Environmental Reports). User accounts and activity logs will be preserved. <strong>This action cannot be undone.</strong></p>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="text" id="clear-confirm-input" placeholder="Type CLEAR ALL DATA to confirm" style="width:280px;font-size:13px">
        <button class="btn btn-danger btn-sm" onclick="clearAllData()">🗑️ Clear All Data</button>
      </div>
      <div id="clear-results" style="display:none;margin-top:12px"></div>
    </div>
  `;
}

async function showSettingsBackup() {
  updateSettingsSidebar("Backup & Restore");
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading backup settings...</div>';
  try {
    const status = await api("/api/backup/google/status");
    const schedule = await api("/api/backup/schedule");
    let html = "";

    // Google Drive Connection
    html += `<div class="settings-section">
      <h3>☁️ Google Drive Connection</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">Connect a Google Drive account for automatic cloud backups. Works like WhatsApp — your data is backed up automatically on schedule.</p>`;

    if (status.connected) {
      html += `<div class="backup-status connected">
        <span class="backup-status-icon">✅</span>
        <span>Google Drive Connected</span>
        <button class="btn btn-sm btn-danger" onclick="disconnectGoogleDrive()" style="margin-left:auto">Disconnect</button>
      </div>`;
    } else if (status.configured) {
      html += `<div class="backup-status pending">
        <span class="backup-status-icon">⚙️</span>
        <span>Credentials saved — authorization needed</span>
        <button class="btn btn-sm btn-primary" onclick="authorizeGoogleDrive()" style="margin-left:auto">Authorize</button>
      </div>`;
    } else {
      html += `<div class="backup-status not-configured">
        <span class="backup-status-icon">⚪</span>
        <span>Not configured</span>
      </div>
      <div style="margin-top:16px">
        <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px">To set up Google Drive backup, you need to create a Google Cloud project and get OAuth credentials. Steps:</p>
        <ol style="color:var(--text-dim);font-size:12px;padding-left:20px;line-height:1.8">
          <li>Go to <a href="https://console.cloud.google.com" target="_blank" style="color:var(--accent)">Google Cloud Console</a></li>
          <li>Create a new project or select existing one</li>
          <li>Enable the Google Drive API</li>
          <li>Create OAuth 2.0 credentials (Web Application type)</li>
          <li>Add <code>http://localhost:3000/api/backup/google/callback</code> as an authorized redirect URI</li>
          <li>Copy the Client ID and Client Secret below</li>
        </ol>
        <div class="setting-row"><label>Client ID</label><input type="text" id="gdrive-client-id" placeholder="your-client-id.apps.googleusercontent.com"></div>
        <div class="setting-row"><label>Client Secret</label><input type="password" id="gdrive-client-secret" placeholder="Client Secret"></div>
        <button class="btn btn-primary btn-sm" onclick="saveGoogleCredentials()">Save & Connect</button>
      </div>`;
    }
    html += `</div>`;

    // Backup Schedule
    html += `<div class="settings-section" style="margin-top:20px">
      <h3>⏰ Backup Schedule</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">Set automatic backup schedule. Backups are saved locally and uploaded to Google Drive if connected.</p>
      <div class="setting-row">
        <label>Schedule Type</label>
        <select id="backup-schedule-type" onchange="updateScheduleFields()">
          <option value="none" ${!schedule.schedule ? "selected" : ""}>No automatic backup</option>
          <option value="daily" ${schedule.schedule?.startsWith("daily") ? "selected" : ""}>Daily</option>
          <option value="weekly" ${schedule.schedule?.startsWith("weekly") ? "selected" : ""}>Weekly</option>
        </select>
      </div>
      <div id="schedule-fields" style="display:${schedule.schedule ? "" : "none"}">
        <div class="setting-row" id="schedule-day-row" style="display:${schedule.schedule?.startsWith("weekly") ? "" : "none"}">
          <label>Day</label>
          <select id="backup-schedule-day">
            ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => `<option value="${d}" ${schedule.schedule?.includes(d) ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="setting-row">
          <label>Time</label>
          <input type="time" id="backup-schedule-time" value="${extractScheduleTime(schedule.schedule)}">
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="saveBackupSchedule()">Save Schedule</button>
    </div>`;

    // Manual Backup
    html += `<div class="settings-section" style="margin-top:20px">
      <h3>💾 Manual Backup</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">Create an immediate backup of the entire database and all attached files.</p>
      <button class="btn btn-primary btn-sm" onclick="createManualBackup()">🔄 Create Backup Now</button>
      <div id="backup-progress" style="display:none;margin-top:12px"><div class="loading">Creating backup...</div></div>
    </div>`;

    // Backup History
    html += `<div class="settings-section" style="margin-top:20px">
      <h3>📋 Backup History</h3>
      <div id="backup-list"><div class="loading">Loading...</div></div>
    </div>`;

    // Restore
    html += `<div class="settings-section" style="margin-top:20px;border:1px solid var(--yellow);border-radius:var(--radius-md);padding:20px">
      <h3>⚠️ Restore from Backup</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">Upload a backup zip file to restore the database. <strong>This will overwrite current data.</strong></p>
      <input type="file" id="restore-file" accept=".zip" style="display:none" onchange="uploadRestoreFile(this)">
      <button class="btn btn-sm" onclick="document.getElementById('restore-file').click()">📁 Upload Backup File</button>
      <div id="restore-progress" style="display:none;margin-top:12px"></div>
    </div>`;

    content.innerHTML = html;
    loadBackupList();
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function extractScheduleTime(schedule) {
  if (!schedule) return "02:00";
  const parts = schedule.split(":");
  if (parts.length >= 3)
    return parts[parts.length - 2] + ":" + parts[parts.length - 1];
  if (parts.length >= 2) return parts[1] + ":00";
  return "02:00";
}

function updateScheduleFields() {
  const type = document.getElementById("backup-schedule-type").value;
  document.getElementById("schedule-fields").style.display =
    type === "none" ? "none" : "";
  document.getElementById("schedule-day-row").style.display =
    type === "weekly" ? "" : "none";
}

async function saveGoogleCredentials() {
  const client_id = document.getElementById("gdrive-client-id").value.trim();
  const client_secret = document
    .getElementById("gdrive-client-secret")
    .value.trim();
  if (!client_id || !client_secret) {
    toast("Both Client ID and Client Secret are required", "error");
    return;
  }
  try {
    await api("/api/backup/google/setup", {
      method: "POST",
      body: JSON.stringify({ client_id, client_secret }),
    });
    toast(
      "Credentials saved! Redirecting to Google for authorization...",
      "success",
    );
    setTimeout(authorizeGoogleDrive, 1000);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function authorizeGoogleDrive() {
  try {
    const data = await api("/api/backup/google/auth-url");
    window.open(data.url, "_blank", "width=500,height=600");
    toast(
      "Complete the authorization in the popup window, then refresh this page",
      "info",
    );
  } catch (err) {
    toast(err.message, "error");
  }
}

async function disconnectGoogleDrive() {
  if (
    !(await showConfirmModal(
      "Disconnect Google Drive? Existing backups on Drive will remain.",
      {
        title: "Disconnect Google Drive",
        icon: "☁️",
        confirmText: "Disconnect",
        danger: true,
      },
    ))
  )
    return;
  try {
    await api("/api/backup/google/disconnect", { method: "POST" });
    toast("Google Drive disconnected", "success");
    showSettingsBackup();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function saveBackupSchedule() {
  const type = document.getElementById("backup-schedule-type").value;
  let schedule = "";
  if (type === "daily") {
    const time =
      document.getElementById("backup-schedule-time").value || "02:00";
    schedule = `daily:${time}`;
  } else if (type === "weekly") {
    const day = document.getElementById("backup-schedule-day").value;
    const time =
      document.getElementById("backup-schedule-time").value || "02:00";
    schedule = `weekly:${day}:${time}`;
  }
  try {
    await api("/api/backup/schedule", {
      method: "POST",
      body: JSON.stringify({ schedule }),
    });
    toast("Backup schedule saved", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function createManualBackup() {
  const prog = document.getElementById("backup-progress");
  prog.style.display = "";
  try {
    const result = await api("/api/backup/create", { method: "POST" });
    prog.innerHTML = `<div style="color:var(--green);font-size:13px">✅ Backup created: ${result.filename} (${(result.size / 1024).toFixed(1)} KB)${result.driveUploaded ? " — Uploaded to Google Drive" : ""}</div>`;
    loadBackupList();
  } catch (err) {
    prog.innerHTML = `<div style="color:var(--red);font-size:13px">❌ ${err.message}</div>`;
  }
}

async function loadBackupList() {
  const container = document.getElementById("backup-list");
  if (!container) return;
  try {
    const data = await api("/api/backup/list");
    if (!data.backups || data.backups.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-muted);font-size:13px">No backups yet</div>';
      return;
    }
    let html = '<div class="backup-history-list">';
    data.backups.forEach((b) => {
      const size = b.size ? `${(b.size / 1024).toFixed(1)} KB` : "";
      const icon = b.location === "google_drive" ? "☁️" : "💾";
      html += `<div class="backup-history-item">
        <span class="backup-icon">${icon}</span>
        <div class="backup-info">
          <div class="backup-name">${escHtml(b.filename || b.name || "Backup")}</div>
          <div class="backup-meta">${size} · ${b.date || b.created_at || ""}</div>
        </div>
        <div class="backup-actions">
          ${b.location !== "google_drive" ? `<button class="btn btn-sm" onclick="downloadBackup('${escHtml(b.filename)}')">⬇️</button>` : ""}
          <button class="btn btn-sm btn-danger" onclick="restoreBackup('${escHtml(b.filename || "")}','${b.driveId || ""}','${b.location || "local"}')">🔄 Restore</button>
        </div>
      </div>`;
    });
    html += "</div>";
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--red);font-size:13px">${err.message}</div>`;
  }
}

function downloadBackup(filename) {
  window.open(`/api/backup/download/${filename}`, "_blank");
}

async function restoreBackup(filename, driveId, location) {
  if (
    !(await showConfirmModal(
      "Are you sure you want to restore this backup? Current data will be overwritten.",
      {
        title: "Restore Backup",
        icon: "🔄",
        confirmText: "Restore",
        danger: true,
      },
    ))
  )
    return;
  showProgressBar();
  try {
    if (location === "google_drive" && driveId) {
      await api(`/api/backup/restore-drive/${driveId}`, { method: "POST" });
    } else {
      await api(`/api/backup/restore/${filename}`, { method: "POST" });
    }
    toast("Backup restored successfully. Please refresh the page.", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function uploadRestoreFile(input) {
  if (!input.files[0]) return;
  if (
    !(await showConfirmModal(
      "This will overwrite the current database with the uploaded backup. Continue?",
      {
        title: "Upload & Restore",
        icon: "📤",
        confirmText: "Upload & Restore",
        danger: true,
      },
    ))
  ) {
    input.value = "";
    return;
  }
  const prog = document.getElementById("restore-progress");
  prog.style.display = "";
  prog.innerHTML = '<div class="loading">Uploading and restoring...</div>';
  const formData = new FormData();
  formData.append("backup", input.files[0]);
  try {
    const resp = await fetch("/api/backup/upload-restore", {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Restore failed");
    prog.innerHTML = `<div style="color:var(--green);font-size:13px">✅ ${data.message} Please refresh the page.</div>`;
  } catch (err) {
    prog.innerHTML = `<div style="color:var(--red);font-size:13px">❌ ${err.message}</div>`;
  }
  input.value = "";
}

async function showSettingsDocuments() {
  updateSettingsSidebar("Document Folder");
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const config = await api("/api/documents/config");
    content.innerHTML = `
      <div class="settings-section">
        <h3>📂 Shared Document Folder</h3>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">Configure a shared network folder where scanned documents are saved. Users can then easily browse and attach documents from this folder when editing records.</p>
        <div class="setting-row">
          <label>Folder Path</label>
          <input type="text" id="shared-docs-path" placeholder="e.g. \\\\SERVER\\Scans or C:\\SharedDocs" value="${escHtml(config.path || "")}">
        </div>
        <p style="color:var(--text-dim);font-size:11px;margin-bottom:12px">Enter the full path to the shared folder. This should be accessible from the computer running the server.</p>
        <button class="btn btn-primary btn-sm" onclick="saveDocsFolderPath()">Save Path</button>
      </div>
      <div class="settings-section" style="margin-top:20px">
        <h3>📖 How Document Scanning Works</h3>
        <div style="color:var(--text-dim);font-size:13px;line-height:1.8">
          <ol style="padding-left:20px">
            <li><strong>Scan documents</strong> from your office scanner/copier to the shared network folder configured above</li>
            <li><strong>Open a record</strong> in the EPA app and click the attachments section</li>
            <li>Click <strong>"Browse Shared Folder"</strong> to see recently scanned files</li>
            <li><strong>Click a file</strong> to attach it to the current record — the file is copied into the app's storage</li>
            <li>You can also <strong>drag and drop</strong> files directly onto the attachment area, or use the upload button</li>
          </ol>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

async function saveDocsFolderPath() {
  const path = document.getElementById("shared-docs-path").value.trim();
  try {
    await api("/api/documents/config", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    toast("Document folder path saved", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

function updateSettingsSidebar(activeLabel) {
  document.querySelectorAll("#sidebar-content .sidebar-item").forEach((el) => {
    el.classList.toggle(
      "active",
      el.querySelector(".label")?.textContent === activeLabel,
    );
  });
}

async function clearAllData() {
  const confirmText = document.getElementById("clear-confirm-input")?.value;
  if (confirmText !== "CLEAR ALL DATA") {
    toast("Please type 'CLEAR ALL DATA' exactly to confirm", "error");
    return;
  }
  if (
    !(await showConfirmModal(
      "Are you absolutely sure? This will delete ALL data records permanently. This cannot be undone.",
      {
        title: "Clear All Data",
        icon: "🚨",
        confirmText: "Clear All Data",
        danger: true,
      },
    ))
  )
    return;

  const results = document.getElementById("clear-results");
  showProgressBar();
  try {
    const data = await api("/api/admin/clear-data", {
      method: "POST",
      body: JSON.stringify({ confirmText }),
    });
    results.style.display = "block";
    let html =
      '<div style="background:var(--bg-tertiary);border:1px solid var(--green);border-radius:var(--radius-md);padding:16px">';
    html +=
      '<div style="color:var(--green);font-weight:600;margin-bottom:8px">✅ All data cleared</div>';
    html += '<div style="font-size:12px;color:var(--text-dim)">Deleted: ';
    html += Object.entries(data.deletedCounts || {})
      .map(([t, c]) => `${t}: ${c}`)
      .join(", ");
    html += "</div></div>";
    results.innerHTML = html;
    document.getElementById("clear-confirm-input").value = "";
    toast("All data has been cleared", "success");
  } catch (err) {
    results.style.display = "block";
    results.innerHTML = `<div class="tag tag-red" style="padding:8px 12px;font-size:13px">❌ ${err.message}</div>`;
  } finally {
    removeProgressBar();
  }
}

async function changePassword() {
  const curr = document.getElementById("set-curr-pw").value;
  const newPw = document.getElementById("set-new-pw").value;
  if (!curr || !newPw) {
    toast("Both passwords required", "error");
    return;
  }
  const btn = document.getElementById("change-pw-btn");
  const restoreBtn = setButtonLoading(btn, "Updating...");
  try {
    await api("/api/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: curr, newPassword: newPw }),
    });
    toast("Password changed successfully", "success");
    document.getElementById("set-curr-pw").value = "";
    document.getElementById("set-new-pw").value = "";
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreBtn();
  }
}

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════

// ── Build sections from form definitions ─────────────────────
async function buildSections(columns, table) {
  // Try to get form definitions from cache or API
  if (!FORM_SECTIONS[table]) {
    try {
      const forms = await api("/api/forms");
      forms.forEach((f) => {
        FORM_SECTIONS[f.table] = f.sections;
      });
    } catch (e) {}
  }
  const defined = FORM_SECTIONS[table];
  if (defined) {
    const used = new Set();
    const sections = defined.map((s) => {
      s.fields.forEach((f) => used.add(f));
      return s;
    });
    const remaining = columns.filter((c) => !used.has(c));
    if (remaining.length)
      sections.push({ title: "Other Fields", fields: remaining });
    return sections;
  }
  // Fallback — chunk into groups of 8
  const sections = [];
  for (let i = 0; i < columns.length; i += 8) {
    sections.push({
      title: `Fields ${i + 1}–${Math.min(i + 8, columns.length)}`,
      fields: columns.slice(i, i + 8),
    });
  }
  return sections;
}

// ── Card configuration per table ─────────────────────────────
function getCardTitleCol(table) {
  const map = {
    PERMIT: "RegisteredNameOfUndertaking",
    MOVEMENT: "Vehicle",
    WASTE: "NameOfCompany",
    Stores: "Description_of_Stores",
    tbl_keyword: "NameOFDocument",
  };
  return map[table] || "id";
}

function getCardFields(table) {
  const map = {
    PERMIT: [
      "ClassificationOfUndertaking",
      "FacilityLocation",
      "District",
      "FileNumber",
      "PermitNumber",
      "PermitExpirationDate",
    ],
    MOVEMENT: [
      "Destination",
      "DepartureDate",
      "ArrivalDate",
      "Purpose",
      "RequestedBy",
      "ApprovedBy",
    ],
    WASTE: [
      "ContactPerson",
      "LocationOfWaste",
      "DateOfInspection",
      "ConsigmentArrivalDate",
      "GeneralWaste",
    ],
    Stores: [
      "Classification",
      "Quantity_Received_Purchase",
      "Unit_Price",
      "Total_Amount",
      "Date_Received",
    ],
    tbl_keyword: [
      "Code",
      "Project",
      "ClassificationOfDocument",
      "DocumentYear",
      "ReviewingOfficer",
    ],
  };
  return map[table] || [];
}

// ── Status tags for cards ────────────────────────────────────
function getStatusTags(row, table) {
  const tags = [];
  if (table === "PERMIT") {
    if (row.ApplicationStatus) {
      const s = row.ApplicationStatus;
      const cls = s.includes("Issued")
        ? "green"
        : s.includes("Paid")
          ? "teal"
          : s.includes("Received")
            ? "blue"
            : s.includes("Review")
              ? "orange"
              : s.includes("Sent")
                ? "purple"
                : "default";
      tags.push(
        `<span class="tag tag-${cls}">${escHtml(truncate(s, 24))}</span>`,
      );
    }
    if (row.PermitExpirationDate) {
      const exp = new Date(row.PermitExpirationDate);
      const now = new Date();
      if (exp < now) tags.push('<span class="tag tag-red">Expired</span>');
      else {
        const days = Math.ceil((exp - now) / 86400000);
        if (days <= 90)
          tags.push(`<span class="tag tag-yellow">Expires ${days}d</span>`);
        else tags.push('<span class="tag tag-green">Valid</span>');
      }
    }
  } else if (table === "MOVEMENT") {
    if (row.ExpiryDate) {
      const exp = new Date(row.ExpiryDate);
      if (exp < new Date())
        tags.push('<span class="tag tag-red">Licence Expired</span>');
    }
  }
  return tags;
}

// ── Format cell values ───────────────────────────────────────
function formatCellValue(val, col) {
  if (val === null || val === undefined || val === "")
    return '<span style="color:var(--text-muted)">—</span>';
  const s = String(val);
  const colLower = (col || "").toLowerCase();
  // Dates
  if (colLower.includes("date") || colLower.includes("created_at")) {
    const d = new Date(s);
    if (!isNaN(d.getTime()) && s.length >= 8) {
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  // Currency
  if (
    colLower.includes("fee") ||
    colLower.includes("amount") ||
    colLower.includes("price") ||
    colLower.includes("total")
  ) {
    const n = parseFloat(s);
    if (!isNaN(n) && n > 0)
      return `GH₵ ${n.toLocaleString("en", { minimumFractionDigits: 2 })}`;
  }
  // Boolean-like
  if (s === "Yes") return '<span class="tag tag-green">Yes</span>';
  if (s === "No") return '<span class="tag tag-red">No</span>';
  // Status values
  if (colLower === "applicationstatus") {
    const cls = s.includes("Issued")
      ? "green"
      : s.includes("Paid")
        ? "teal"
        : s.includes("Received")
          ? "blue"
          : s.includes("Review")
            ? "orange"
            : s.includes("Required")
              ? "yellow"
              : s.includes("Sent")
                ? "purple"
                : "default";
    return `<span class="tag tag-${cls}">${escHtml(s)}</span>`;
  }
  if (colLower === "compliance" && s === "Compliance Enforcement")
    return '<span class="tag tag-orange">Enforcement</span>';
  // Email
  if (s.includes("@") && s.includes("."))
    return `<a href="mailto:${s}" style="color:var(--accent)">${escHtml(s)}</a>`;
  return escHtml(s);
}

// ── Pagination ───────────────────────────────────────────────
function renderPagination(data) {
  const { page, pages, total } = data;
  let html = '<div class="pagination">';
  html += `<button ${page <= 1 ? "disabled" : ""} onclick="changePage(${page - 1})">‹ Prev</button>`;
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  if (start > 1) {
    html += `<button onclick="changePage(1)">1</button>`;
    if (start > 2) html += '<span class="page-info">…</span>';
  }
  for (let i = start; i <= end; i++) {
    html += `<button class="${i === page ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
  }
  if (end < pages) {
    if (end < pages - 1) html += '<span class="page-info">…</span>';
    html += `<button onclick="changePage(${pages})">${pages}</button>`;
  }
  html += `<button ${page >= pages ? "disabled" : ""} onclick="changePage(${page + 1})">Next ›</button>`;
  html += `<span class="page-info">Page ${page} of ${pages}</span>`;
  html += "</div>";
  return html;
}

// ── Empty state with EPA watermark ───────────────────────────
function renderEmptyState(title, desc) {
  return `<div class="empty-state">
    <img src="/epa%20logo.png" class="empty-watermark" alt="" onerror="this.style.display='none'">
    <div class="empty-title">${title}</div>
    <div class="empty-desc">${desc}</div>
  </div>`;
}

// ── Toast notifications ──────────────────────────────────────
function toast(msg, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  el.innerHTML = `<span>${icons[type] || ""}</span> ${escHtml(msg)}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-exit");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Helpers ──────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
/* Safely encode a value for use in an inline onclick attribute as a JS argument */
function escAttr(val) {
  return JSON.stringify(String(val == null ? "" : val))
    .replace(/&/g, "&amp;")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function humanize(s) {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAction(action) {
  const map = {
    LOGIN: "Logged In",
    CREATE_RECORD: "Created Record",
    UPDATE_RECORD: "Updated Record",
    DELETE_RECORD: "Deleted Record",
    BULK_DELETE: "Bulk Deleted Records",
    RUN_QUERY: "Ran Query",
    RUN_REPORT: "Generated Report",
    CREATE_USER: "Created User",
    UPDATE_USER: "Updated User",
    DELETE_USER: "Deleted User",
    CHANGE_PASSWORD: "Changed Password",
    UPLOAD_ACCESS: "Uploaded Access File",
    SELECTIVE_IMPORT: "Selective Import",
    CLEAR_DATA: "Cleared All Data",
    REVERT_ACTION: "Reverted Action",
    SET_PERMISSIONS: "Set Permissions",
    UPLOAD_ATTACHMENT: "Uploaded Attachment",
    DELETE_ATTACHMENT: "Deleted Attachment",
  };
  return (
    map[action] ||
    action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getActivityIconClass(action) {
  if (action === "LOGIN") return "login";
  if (
    action.includes("CREATE") ||
    action.includes("UPLOAD") ||
    action.includes("IMPORT")
  )
    return "create";
  if (
    action.includes("UPDATE") ||
    action.includes("CHANGE") ||
    action.includes("REVERT") ||
    action.includes("SET")
  )
    return "update";
  if (action.includes("DELETE") || action.includes("CLEAR")) return "delete";
  if (action.includes("QUERY")) return "query";
  if (action.includes("REPORT")) return "report";
  return "default";
}

function getActivityEmoji(action) {
  if (action === "LOGIN") return "🔑";
  if (action.includes("REVERT")) return "↩️";
  if (
    action.includes("CREATE") ||
    action.includes("UPLOAD") ||
    action.includes("IMPORT")
  )
    return "➕";
  if (
    action.includes("UPDATE") ||
    action.includes("CHANGE") ||
    action.includes("SET")
  )
    return "✏️";
  if (action.includes("DELETE") || action.includes("CLEAR")) return "🗑️";
  if (action.includes("QUERY")) return "🔍";
  if (action.includes("REPORT")) return "📊";
  if (action.includes("FILE")) return "📎";
  return "📌";
}

// ══════════════════════════════════════════════════════════════
//  CONTEXT MENU — Right-click on data cards
// ══════════════════════════════════════════════════════════════
function closeContextMenu() {
  const existing = document.querySelector(".context-menu");
  if (existing) existing.remove();
}

document.addEventListener("click", closeContextMenu);
document.addEventListener("contextmenu", (e) => {
  // Handle data cards and user cards
  const card = e.target.closest(".data-card") || e.target.closest(".user-card");
  if (!card) {
    closeContextMenu();
    return;
  }
});

function showUserContextMenu(e, userId) {
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();
  const u = state._usersData && state._usersData[userId];
  if (!u) return;
  const username = u.username;
  const fullName = u.full_name || "";
  const role = u.role;

  let html =
    '<div class="context-menu" style="left:' +
    e.clientX +
    "px;top:" +
    e.clientY +
    'px">';
  html += `<button class="context-menu-item" onclick="closeContextMenu();showEditUserModal(${userId},${escAttr(username)},${escAttr(fullName)},${escAttr(role)})">✏️ Edit User</button>`;
  html += `<button class="context-menu-item" onclick="closeContextMenu();showPermissionsForUser(${userId},${escAttr(username)})">🔐 Permissions</button>`;
  html += '<div class="context-menu-sep"></div>';
  html += `<button class="context-menu-item" onclick="closeContextMenu();viewUserActivityLogs(${escAttr(username)})">🕐 View Activity Logs</button>`;
  html += '<div class="context-menu-sep"></div>';
  html += `<button class="context-menu-item danger" onclick="closeContextMenu();deleteUser(${userId})">🗑️ Delete User</button>`;
  html += "</div>";

  document.body.insertAdjacentHTML("beforeend", html);
  const menu = document.querySelector(".context-menu");
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth)
    menu.style.left = window.innerWidth - rect.width - 8 + "px";
  if (rect.bottom > window.innerHeight)
    menu.style.top = window.innerHeight - rect.height - 8 + "px";
}

async function viewUserActivityLogs(username) {
  // Navigate to activity view filtered by this user
  state.activityUserFilter = username;
  switchView("activity");
}

function showContextMenu(e, table, id) {
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();
  const canEdit = userCan("can_edit", table);
  const canDelete = userCan("can_delete", table);
  const isSelected = state.selectedRecords.has(id);
  const hasSelection = state.selectedRecords.size > 0;

  let html =
    '<div class="context-menu" style="left:' +
    e.clientX +
    "px;top:" +
    e.clientY +
    'px">';
  html += `<button class="context-menu-item" onclick="closeContextMenu();showRecordModal('${table}',${id})">👁️ View Record</button>`;
  if (canEdit) {
    html += `<button class="context-menu-item" onclick="closeContextMenu();showEditRecordModal('${table}',${id})">✏️ Edit Record</button>`;
  }
  if (canEdit || canDelete) {
    html += '<div class="context-menu-sep"></div>';
    if (!isSelected) {
      html += `<button class="context-menu-item" onclick="closeContextMenu();toggleSelectRecord(${id})">☑️ Select</button>`;
    } else {
      html += `<button class="context-menu-item" onclick="closeContextMenu();toggleSelectRecord(${id})">☐ Deselect</button>`;
    }
    if (hasSelection && canDelete) {
      html += `<button class="context-menu-item danger" onclick="closeContextMenu();bulkDeleteSelected('${table}')">🗑️ Delete Selected (${state.selectedRecords.size})</button>`;
    }
  }
  if (canDelete) {
    html += '<div class="context-menu-sep"></div>';
    html += `<button class="context-menu-item danger" onclick="closeContextMenu();deleteRecord('${table}',${id})">🗑️ Delete This Record</button>`;
  }
  html += "</div>";

  document.body.insertAdjacentHTML("beforeend", html);
  // Adjust if off-screen
  const menu = document.querySelector(".context-menu");
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth)
    menu.style.left = window.innerWidth - rect.width - 8 + "px";
  if (rect.bottom > window.innerHeight)
    menu.style.top = window.innerHeight - rect.height - 8 + "px";
}

function toggleSelectRecord(id) {
  if (state.selectedRecords.has(id)) {
    state.selectedRecords.delete(id);
  } else {
    state.selectedRecords.add(id);
  }
  updateCardSelections();
}

function updateCardSelections() {
  document.querySelectorAll(".data-card[data-id]").forEach((card) => {
    const cardId = parseInt(card.dataset.id);
    card.classList.toggle("selected", state.selectedRecords.has(cardId));
  });
  // Show/hide bulk action bar
  const existing = document.getElementById("bulk-bar");
  if (state.selectedRecords.size > 0) {
    if (!existing) {
      const bar = document.createElement("div");
      bar.id = "bulk-bar";
      bar.className = "bulk-action-bar";
      bar.innerHTML = `<span>${state.selectedRecords.size} record(s) selected</span>
        <button onclick="clearSelection()">Clear</button>
        <button class="danger" onclick="bulkDeleteSelected('${state.currentTable}')">🗑️ Delete Selected</button>`;
      const content = document.getElementById("content");
      const cards = content.querySelector(".data-cards");
      if (cards) cards.parentElement.insertBefore(bar, cards);
    } else {
      existing.querySelector("span").textContent =
        `${state.selectedRecords.size} record(s) selected`;
    }
  } else if (existing) {
    existing.remove();
  }
}

function clearSelection() {
  state.selectedRecords.clear();
  updateCardSelections();
}

async function bulkDeleteSelected(table) {
  const ids = Array.from(state.selectedRecords);
  if (ids.length === 0) return;
  if (
    !(await showConfirmModal(
      `Delete ${ids.length} record(s) permanently? This action cannot be undone.`,
      {
        title: "Bulk Delete",
        icon: "🗑️",
        confirmText: `Delete ${ids.length} Records`,
        danger: true,
      },
    ))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/data/${table}/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    toast(`${ids.length} record(s) deleted`, "success");
    state.selectedRecords.clear();
    loadTableData();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ══════════════════════════════════════════════════════════════
//  CSV / EXCEL EXPORT
// ══════════════════════════════════════════════════════════════
function exportTable(table, format = "csv") {
  const url = `/api/export/${encodeURIComponent(table)}?format=${format}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${table}_export.${format}`;
  // Add auth header via fetch instead
  fetch(url, { headers: { Authorization: "Bearer " + state.token } })
    .then((r) => r.blob())
    .then((blob) => {
      const burl = URL.createObjectURL(blob);
      a.href = burl;
      a.click();
      URL.revokeObjectURL(burl);
      toast(`Exported ${table} as ${format.toUpperCase()}`, "success");
    })
    .catch((err) => toast("Export failed: " + err.message, "error"));
}

async function exportResults(rows, name, format = "csv") {
  try {
    const res = await fetch("/api/export-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.token,
      },
      body: JSON.stringify({ rows, name, format }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "export"}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported as ${format.toUpperCase()}`, "success");
  } catch (err) {
    toast("Export failed: " + err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════
//  DIGITIZED FILES — Smart document linking system
// ══════════════════════════════════════════════════════════════
let _digiCurrentPath = "";
let _digiTable = "";
let _digiRecordId = 0;

async function loadDigitizedSection(table, recordId, row) {
  const container = document.getElementById("digitized-container");
  const countEl = document.getElementById("digi-count");
  if (!container) return;

  _digiTable = table;
  _digiRecordId = recordId;

  try {
    // Load existing linked documents
    const links = await api(`/api/digitized/links/${table}/${recordId}`);

    // Try to auto-match a company folder (for PERMIT records)
    let matchResult = null;
    if (table === "PERMIT" && row.RegisteredNameOfUndertaking) {
      try {
        const params = new URLSearchParams({
          company: row.RegisteredNameOfUndertaking || "",
          location: row.FacilityLocation || "",
          classification: row.ClassificationOfUndertaking || "",
        });
        matchResult = await api(`/api/digitized/match?${params}`);
      } catch (e) {
        // Shared docs folder might not be configured — that's ok
      }
    }

    if (countEl) countEl.textContent = `(${links.length})`;

    let html = "";

    // Show linked documents
    if (links.length > 0) {
      html +=
        '<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:600;color:var(--text-white);margin-bottom:8px">Linked Documents</div>';
      html += '<div class="attachment-list">';
      links.forEach((link) => {
        const ext = link.file_name.split(".").pop().toLowerCase();
        const icon = ["pdf"].includes(ext)
          ? "📕"
          : ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff"].includes(ext)
            ? "🖼️"
            : ["doc", "docx"].includes(ext)
              ? "📝"
              : ["xls", "xlsx"].includes(ext)
                ? "📊"
                : "📄";
        const canPreview = [
          "pdf",
          "jpg",
          "jpeg",
          "png",
          "gif",
          "bmp",
          "webp",
        ].includes(ext);
        html += `<div class="attachment-item">
          <span class="att-icon">${icon}</span>
          <span class="att-name" title="${escHtml(link.relative_path)}">${escHtml(link.file_name)}</span>
          <span class="att-size" style="font-size:11px;color:var(--text-muted)">${escHtml(link.linked_by)} · ${formatDate(link.created_at)}</span>
          <div class="att-actions">
            ${canPreview ? `<button class="att-btn" onclick="previewDigitizedFile('${escHtml(link.relative_path)}','${escHtml(link.file_name)}')" title="Preview">👁️</button>` : ""}
            <button class="att-btn" onclick="downloadDigitizedFile('${escHtml(link.relative_path)}')" title="Download">⬇️</button>
            <button class="att-btn danger" onclick="unlinkDigitizedFile(${link.id},'${table}',${recordId})" title="Remove link">✕</button>
          </div>
        </div>`;
      });
      html += "</div></div>";
    }

    // Show auto-matched folder
    if (matchResult && matchResult.matched) {
      html += `<div class="digi-match-box" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:var(--accent)">📂 Matched Company Folder</div>
          <span class="tag tag-green" style="font-size:10px">${matchResult.score}% match</span>
        </div>
        <div style="font-size:13px;color:var(--text-white);margin-bottom:8px;font-weight:500">${escHtml(matchResult.folderName)}</div>`;
      if (matchResult.files && matchResult.files.length > 0) {
        html += '<div class="attachment-list">';
        matchResult.files.forEach((f) => {
          if (f.isDirectory) {
            html += `<div class="shared-doc-item folder" onclick="browseDigitizedFolder('${escHtml(f.relativePath)}')">
              <span class="att-icon">📁</span><span class="att-name">${escHtml(f.name)}</span>
            </div>`;
          } else {
            const ext = f.name.split(".").pop().toLowerCase();
            const icon = ["pdf"].includes(ext)
              ? "📕"
              : ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff"].includes(
                    ext,
                  )
                ? "🖼️"
                : "📄";
            const sizeStr =
              f.size > 1048576
                ? (f.size / 1048576).toFixed(1) + " MB"
                : (f.size / 1024).toFixed(0) + " KB";
            // Check if already linked
            const isLinked = links.some(
              (l) => l.relative_path === f.relativePath,
            );
            html += `<div class="shared-doc-item${isLinked ? " linked" : ""}" style="${isLinked ? "opacity:0.6" : "cursor:pointer"}"
              ${!isLinked ? `onclick="linkDigitizedFile('${escHtml(f.relativePath)}','${escHtml(f.name)}','${table}',${recordId})"` : ""}>
              <span class="att-icon">${icon}</span>
              <span class="att-name">${escHtml(f.name)}</span>
              <span class="att-size">${sizeStr}</span>
              ${isLinked ? '<span class="tag tag-green" style="font-size:10px;margin-left:auto">linked</span>' : '<span style="color:var(--accent);font-size:11px;margin-left:auto">+ Link</span>'}
            </div>`;
          }
        });
        html += "</div>";
      } else {
        html +=
          '<div style="color:var(--text-muted);font-size:12px">No files in this folder yet.</div>';
      }
      html += "</div>";
    }

    // Browse & Create buttons
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-sm" onclick="openDigitizedBrowser('${table}',${recordId})">📂 Browse Digitized Files</button>`;
    if (table === "PERMIT" && row.RegisteredNameOfUndertaking) {
      const suggestedName =
        (row.RegisteredNameOfUndertaking || "").trim() +
        (row.FacilityLocation ? " @ " + row.FacilityLocation.trim() : "");
      html += `<button class="btn btn-sm" onclick="createCompanyFolder('${escHtml(suggestedName)}','${escHtml(row.ClassificationOfUndertaking || "")}','${table}',${recordId})">📁 Create Company Folder</button>`;
    }
    html += "</div>";

    // Full browser area (hidden by default)
    html +=
      '<div id="digi-browser" style="display:none;margin-top:12px"></div>';

    container.innerHTML = html;

    // Auto-expand if there are links or a match
    if (links.length > 0 || (matchResult && matchResult.matched)) {
      const section = document.getElementById("record-digitized");
      if (section) section.classList.add("open");
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:12px">Digitized files not available. ${err.message || "Configure the shared document folder in Settings."}</div>`;
  }
}

async function linkDigitizedFile(relativePath, fileName, table, recordId) {
  try {
    await api("/api/digitized/link", {
      method: "POST",
      body: JSON.stringify({ table, recordId, relativePath, fileName }),
    });
    toast("Document linked ✓", "success");
    // Reload the unified documents section
    refreshUnifiedDocuments(table, recordId);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function unlinkDigitizedFile(linkId, table, recordId) {
  if (
    !(await showConfirmModal(
      "Remove this document link? The file itself will not be deleted.",
      { title: "Remove Link", icon: "🗂️", confirmText: "Remove", danger: true },
    ))
  )
    return;
  try {
    await api(`/api/digitized/link/${linkId}`, { method: "DELETE" });
    toast("Link removed", "success");
    refreshUnifiedDocuments(table, recordId);
  } catch (err) {
    toast(err.message, "error");
  }
}

function previewDigitizedFile(relativePath, filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const url = `/api/digitized/file?path=${encodeURIComponent(relativePath)}`;

  // Fetch with auth token, then display via blob URL
  fetch(url, { headers: { Authorization: "Bearer " + state.token } })
    .then((r) => {
      if (!r.ok) throw new Error("Failed to load file");
      return r.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.onclick = (e) => {
        if (e.target === modal) {
          URL.revokeObjectURL(blobUrl);
          modal.remove();
        }
      };
      let content = "";
      if (isImage) {
        content = `<img src="${blobUrl}" style="max-width:100%;max-height:80vh;border-radius:8px" alt="${escHtml(filename)}">`;
      } else if (isPdf) {
        content = `<iframe src="${blobUrl}" style="width:100%;height:80vh;border:none;border-radius:8px"></iframe>`;
      }
      modal.innerHTML = `<div class="modal" style="max-width:900px">
        <div class="modal-header"><h3>Preview: ${escHtml(filename)}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
        <div style="padding:16px">${content}</div>
      </div>`;
      document.body.appendChild(modal);
    })
    .catch((err) => toast("Preview failed: " + err.message, "error"));
}

function downloadDigitizedFile(relativePath) {
  const url = `/api/digitized/file?path=${encodeURIComponent(relativePath)}&download=1`;
  fetch(url, { headers: { Authorization: "Bearer " + state.token } })
    .then((r) =>
      r.blob().then((blob) => ({ blob, name: relativePath.split("/").pop() })),
    )
    .then(({ blob, name }) => {
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = name;
      a.click();
      URL.revokeObjectURL(u);
    })
    .catch((err) => toast("Download failed: " + err.message, "error"));
}

async function openDigitizedBrowser(table, recordId) {
  _digiTable = table;
  _digiRecordId = recordId;
  _digiCurrentPath = "";
  const browser = document.getElementById("digi-browser");
  if (!browser) return;
  browser.style.display = "";
  await renderDigitizedBrowser("");
}

async function renderDigitizedBrowser(subPath) {
  const browser = document.getElementById("digi-browser");
  if (!browser) return;
  _digiCurrentPath = subPath;
  browser.innerHTML =
    '<div class="loading" style="padding:8px">Loading...</div>';
  try {
    const data = await api(
      `/api/digitized/browse?path=${encodeURIComponent(subPath)}`,
    );
    let html =
      '<div class="shared-docs-list" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:8px">';
    html += `<div class="shared-docs-header" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);margin-bottom:6px">`;
    if (subPath) {
      const parent = data.parentPath === "." ? "" : data.parentPath || "";
      html += `<button class="btn btn-sm" onclick="renderDigitizedBrowser('${escHtml(parent)}')">← Back</button>`;
    }
    html += `<span style="font-size:12px;color:var(--text-dim);flex:1">📂 ${subPath ? escHtml(subPath) : "Root"}</span>`;
    html += `<button class="att-btn" onclick="document.getElementById('digi-browser').style.display='none'" title="Close">✕</button>`;
    html += "</div>";

    if (data.items && data.items.length > 0) {
      data.items.forEach((f) => {
        if (f.isDirectory) {
          html += `<div class="shared-doc-item folder" onclick="renderDigitizedBrowser('${escHtml(f.relativePath)}')">
            <span class="att-icon">📁</span><span class="att-name">${escHtml(f.name)}</span>
          </div>`;
        } else {
          const ext = f.name.split(".").pop().toLowerCase();
          const icon = ["pdf"].includes(ext)
            ? "📕"
            : ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff"].includes(ext)
              ? "🖼️"
              : "📄";
          const sizeStr =
            f.size > 1048576
              ? (f.size / 1048576).toFixed(1) + " MB"
              : (f.size / 1024).toFixed(0) + " KB";
          html += `<div class="shared-doc-item" style="cursor:pointer" onclick="linkDigitizedFile('${escHtml(f.relativePath)}','${escHtml(f.name)}','${_digiTable}',${_digiRecordId})">
            <span class="att-icon">${icon}</span><span class="att-name">${escHtml(f.name)}</span>
            <span class="att-size">${sizeStr}</span>
            <span style="color:var(--accent);font-size:11px;margin-left:auto">+ Link</span>
          </div>`;
        }
      });
    } else {
      html +=
        '<div style="color:var(--text-muted);font-size:12px;padding:8px">Empty folder</div>';
    }
    html += "</div>";
    browser.innerHTML = html;
  } catch (err) {
    browser.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px">${err.message}</div>`;
  }
}

async function browseDigitizedFolder(relativePath) {
  const browser = document.getElementById("digi-browser");
  if (browser) browser.style.display = "";
  await renderDigitizedBrowser(relativePath);
}

async function createCompanyFolder(
  suggestedName,
  classification,
  table,
  recordId,
) {
  // Find the best parent folder (classification/undertaking type)
  let parentPath = "";
  if (classification) {
    try {
      const data = await api("/api/digitized/browse?path=");
      const match = (data.items || []).find(
        (f) =>
          f.isDirectory &&
          (f.name.toLowerCase().includes(classification.toLowerCase()) ||
            classification.toLowerCase().includes(f.name.toLowerCase())),
      );
      if (match) parentPath = match.relativePath;
    } catch (e) {}
  }

  // Prompt for folder name (pre-filled with suggestion)
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  modal.innerHTML = `<div class="modal" style="max-width:500px">
    <div class="modal-header">
      <h3>📁 Create Company Folder</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label style="font-size:12px;color:var(--text-dim)">Parent Folder (undertaking type)</label>
        <input id="digi-parent-path" value="${escHtml(parentPath)}" placeholder="e.g. Mining, Manufacturing" style="font-size:13px">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Leave empty to create in the root of your digitized files folder</div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label style="font-size:12px;color:var(--text-dim)">Folder Name (Company @ Location)</label>
        <input id="digi-folder-name" value="${escHtml(suggestedName)}" style="font-size:13px;font-weight:500">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Convention: COMPANY NAME @ LOCATION</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary btn-sm" onclick="executeCreateCompanyFolder('${table}',${recordId})">Create Folder</button>
      <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function executeCreateCompanyFolder(table, recordId) {
  const parentPath = document.getElementById("digi-parent-path")?.value || "";
  const folderName = document.getElementById("digi-folder-name")?.value || "";
  if (!folderName.trim()) {
    toast("Folder name is required", "error");
    return;
  }

  try {
    await api("/api/digitized/create-folder", {
      method: "POST",
      body: JSON.stringify({ parentPath, folderName: folderName.trim() }),
    });
    toast(`Folder created: ${folderName.trim()}`, "success");
    document.querySelector(".modal-overlay:last-child")?.remove();
    // Reload unified documents section
    refreshUnifiedDocuments(table, recordId);
  } catch (err) {
    toast(err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════
//  FILE ATTACHMENTS
// ══════════════════════════════════════════════════════════════
async function loadAttachments(table, recordId) {
  try {
    return await api(`/api/attachments/${table}/${recordId}`);
  } catch (e) {
    return [];
  }
}

function renderAttachmentSection(table, recordId, attachments) {
  const canEdit = userCan("can_edit", table);
  let html = "";
  if (attachments.length > 0) {
    html += '<div class="attachment-list">';
    attachments.forEach((a) => {
      const sizeStr =
        a.file_size > 1048576
          ? (a.file_size / 1048576).toFixed(1) + " MB"
          : (a.file_size / 1024).toFixed(0) + " KB";
      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(a.original_name);
      const isPdf = /\.pdf$/i.test(a.original_name);
      html += `<div class="attachment-item">
        <span class="att-icon">${isImage ? "🖼️" : isPdf ? "📕" : "📄"}</span>
        <span class="att-name">${escHtml(a.original_name)}</span>
        <span class="att-size">${sizeStr}</span>
        <div class="att-actions">
          ${isImage || isPdf ? `<button class="att-btn" onclick="previewAttachment(${a.id},'${escHtml(a.original_name)}')" title="Preview">👁️</button>` : ""}
          <button class="att-btn" onclick="downloadAttachment(${a.id})" title="Download">⬇️</button>
          ${state.user?.role === "admin" || canEdit ? `<button class="att-btn danger" onclick="deleteAttachment(${a.id},'${table}',${recordId})" title="Delete">✕</button>` : ""}
        </div>
      </div>`;
    });
    html += "</div>";
  } else {
    html +=
      '<div style="color:var(--text-muted);font-size:12px;padding:4px 0">No files attached</div>';
  }
  if (state.user?.role === "admin" || canEdit) {
    // Drag and drop zone
    html += `<div class="att-dropzone" id="att-dropzone"
      ondragover="event.preventDefault();this.classList.add('dragover')"
      ondragleave="this.classList.remove('dragover')"
      ondrop="event.preventDefault();this.classList.remove('dragover');handleAttDrop(event,'${table}',${recordId})">
      <div class="att-dropzone-text">
        <span style="font-size:24px">📎</span>
        <span>Drag & drop files here or</span>
        <button class="btn btn-sm" onclick="document.getElementById('att-upload-input').click()">Browse Files</button>
        <button class="btn btn-sm" onclick="showSharedDocsBrowser('${table}',${recordId})">📂 Shared Folder</button>
      </div>
      <input type="file" id="att-upload-input" multiple style="display:none" onchange="uploadAttachments('${table}',${recordId})">
    </div>`;
    html += `<div id="shared-docs-browser" style="display:none"></div>`;
  }
  return html;
}

async function previewAttachment(id, filename) {
  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename);
  const isPdf = /\.pdf$/i.test(filename);
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = (e) => {
    if (e.target === modal) {
      cleanupPreviewModal(modal);
    }
  };
  // Show loading state first
  modal.innerHTML = `<div class="modal" style="max-width:900px">
    <div class="modal-header"><h3>Preview: ${escHtml(filename)}</h3><button class="modal-close" onclick="cleanupPreviewModal(this.closest('.modal-overlay'))">✕</button></div>
    <div style="padding:16px;text-align:center"><div class="spinner" style="margin:40px auto"></div><div style="color:var(--text-muted);margin-top:12px">Loading preview...</div></div>
  </div>`;
  document.body.appendChild(modal);
  try {
    const res = await fetch(`/api/attachments/preview/${id}`, {
      headers: { Authorization: "Bearer " + state.token },
    });
    if (!res.ok) throw new Error("Failed to load preview");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    modal._blobUrl = blobUrl;
    let content = "";
    if (isImage) {
      content = `<img src="${blobUrl}" style="max-width:100%;max-height:80vh;border-radius:8px" alt="${escHtml(filename)}">`;
    } else if (isPdf) {
      content = `<iframe src="${blobUrl}" style="width:100%;height:80vh;border:none;border-radius:8px"></iframe>`;
    }
    modal.innerHTML = `<div class="modal" style="max-width:900px">
      <div class="modal-header"><h3>Preview: ${escHtml(filename)}</h3><button class="modal-close" onclick="cleanupPreviewModal(this.closest('.modal-overlay'))">✕</button></div>
      <div style="padding:16px">${content}</div>
    </div>`;
  } catch (err) {
    modal.innerHTML = `<div class="modal" style="max-width:400px">
      <div class="modal-header"><h3>Preview Error</h3><button class="modal-close" onclick="cleanupPreviewModal(this.closest('.modal-overlay'))">✕</button></div>
      <div style="padding:20px;text-align:center;color:var(--red)">${err.message}</div>
    </div>`;
  }
}

function cleanupPreviewModal(modal) {
  if (modal?._blobUrl) URL.revokeObjectURL(modal._blobUrl);
  if (modal) modal.remove();
}

function handleAttDrop(event, table, recordId) {
  const files = event.dataTransfer.files;
  if (!files.length) return;
  const formData = new FormData();
  for (const f of files) formData.append("files", f);
  const headers = {};
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  fetch(`/api/attachments/${table}/${recordId}`, {
    method: "POST",
    headers,
    body: formData,
  })
    .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error);
      toast(`${data.files.length} file(s) uploaded`, "success");
      // Refresh unified documents section
      refreshUnifiedDocuments(table, recordId);
    })
    .catch((err) => toast(err.message, "error"));
}

/** Refresh the unified documents section after upload/delete/link */
async function refreshUnifiedDocuments(table, recordId) {
  try {
    const row = await api(`/api/data/${table}/${recordId}`);
    await loadUnifiedDocuments(table, recordId, row);
  } catch (e) {
    // Fallback: at least refresh attachments
    const attachments = await loadAttachments(table, recordId);
    const container = document.getElementById("documents-container");
    if (container)
      container.innerHTML = renderAttachmentList(table, recordId, attachments);
  }
}

async function showSharedDocsBrowser(table, recordId) {
  const browser = document.getElementById("shared-docs-browser");
  if (!browser) return;
  browser.style.display = "";
  browser.innerHTML = '<div class="loading">Loading shared folder...</div>';
  try {
    const data = await api("/api/documents/browse");
    if (!data.files || data.files.length === 0) {
      browser.innerHTML =
        '<div style="color:var(--text-muted);font-size:12px;padding:8px">No files found in shared folder. Configure the folder path in Settings → Document Folder.</div>';
      return;
    }
    let html = '<div class="shared-docs-list">';
    html += `<div class="shared-docs-header"><span>📂 Shared Folder</span><button class="att-btn" onclick="document.getElementById('shared-docs-browser').style.display='none'">✕</button></div>`;
    data.files.forEach((f) => {
      if (f.isDirectory) {
        html += `<div class="shared-doc-item folder" onclick="browseSubfolder('${escHtml(f.name)}','${table}',${recordId})">
          <span class="att-icon">📁</span><span class="att-name">${escHtml(f.name)}</span>
        </div>`;
      } else {
        const sizeStr =
          f.size > 1048576
            ? (f.size / 1048576).toFixed(1) + " MB"
            : (f.size / 1024).toFixed(0) + " KB";
        html += `<div class="shared-doc-item" onclick="attachFromShared('${escHtml(f.name)}','${table}',${recordId})">
          <span class="att-icon">📄</span><span class="att-name">${escHtml(f.name)}</span>
          <span class="att-size">${sizeStr}</span>
        </div>`;
      }
    });
    html += "</div>";
    browser.innerHTML = html;
  } catch (err) {
    browser.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px">${err.message}</div>`;
  }
}

async function browseSubfolder(subpath, table, recordId) {
  const browser = document.getElementById("shared-docs-browser");
  browser.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const data = await api(
      `/api/documents/browse?path=${encodeURIComponent(subpath)}`,
    );
    let html = '<div class="shared-docs-list">';
    html += `<div class="shared-docs-header"><button class="btn btn-sm" onclick="showSharedDocsBrowser('${table}',${recordId})">← Back</button><span>📂 ${escHtml(subpath)}</span><button class="att-btn" onclick="document.getElementById('shared-docs-browser').style.display='none'">✕</button></div>`;
    (data.files || []).forEach((f) => {
      const fullPath = subpath + "/" + f.name;
      if (f.isDirectory) {
        html += `<div class="shared-doc-item folder" onclick="browseSubfolder('${escHtml(fullPath)}','${table}',${recordId})">
          <span class="att-icon">📁</span><span class="att-name">${escHtml(f.name)}</span>
        </div>`;
      } else {
        const sizeStr =
          f.size > 1048576
            ? (f.size / 1048576).toFixed(1) + " MB"
            : (f.size / 1024).toFixed(0) + " KB";
        html += `<div class="shared-doc-item" onclick="attachFromShared('${escHtml(fullPath)}','${table}',${recordId})">
          <span class="att-icon">📄</span><span class="att-name">${escHtml(f.name)}</span>
          <span class="att-size">${sizeStr}</span>
        </div>`;
      }
    });
    html += "</div>";
    browser.innerHTML = html;
  } catch (err) {
    browser.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px">${err.message}</div>`;
  }
}

async function attachFromShared(filePath, table, recordId) {
  try {
    await api("/api/documents/attach", {
      method: "POST",
      body: JSON.stringify({ filePath, table, record_id: recordId }),
    });
    toast("File attached from shared folder", "success");
    document.getElementById("shared-docs-browser").style.display = "none";
    refreshUnifiedDocuments(table, recordId);
  } catch (err) {
    toast(err.message, "error");
  }
}

function downloadAttachment(id) {
  fetch(`/api/attachments/download/${id}`, {
    headers: { Authorization: "Bearer " + state.token },
  })
    .then((r) => {
      const disp = r.headers.get("content-disposition");
      const name = disp
        ? disp.split("filename=")[1]?.replace(/"/g, "")
        : "download";
      return r.blob().then((blob) => ({ blob, name }));
    })
    .then(({ blob, name }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((err) => toast("Download failed: " + err.message, "error"));
}

async function uploadAttachments(table, recordId) {
  const input = document.getElementById("att-upload-input");
  if (!input.files.length) return;
  const formData = new FormData();
  for (const f of input.files) formData.append("files", f);
  showProgressBar();
  try {
    const headers = {};
    if (state.token) headers["Authorization"] = "Bearer " + state.token;
    const res = await fetch(`/api/attachments/${table}/${recordId}`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(`${data.files.length} file(s) uploaded`, "success");
    // Refresh unified documents section
    refreshUnifiedDocuments(table, recordId);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function deleteAttachment(id, table, recordId) {
  if (
    !(await showConfirmModal(
      "Delete this attachment? The file will be permanently removed.",
      {
        title: "Delete Attachment",
        icon: "📎",
        confirmText: "Delete",
        danger: true,
      },
    ))
  )
    return;
  showProgressBar();
  try {
    const endpoint =
      state.user?.role === "admin"
        ? `/api/attachments/${id}`
        : `/api/attachments/${id}/user`;
    await api(endpoint, { method: "DELETE" });
    toast("Attachment deleted", "success");
    // Refresh unified documents section
    refreshUnifiedDocuments(table, recordId);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ══════════════════════════════════════════════════════════════
//  SCAN LOG — Full view with table, filters, add/edit/delete
// ══════════════════════════════════════════════════════════════
let _scanLogFieldOptions = null;

async function loadScanLogOptions() {
  if (_scanLogFieldOptions) return _scanLogFieldOptions;
  try {
    // Load field options for all relevant tables
    const permitOpts = await api("/api/field-options/PERMIT");
    const movementOpts = await api("/api/field-options/MOVEMENT").catch(
      () => ({}),
    );
    _scanLogFieldOptions = { PERMIT: permitOpts, MOVEMENT: movementOpts };
    return _scanLogFieldOptions;
  } catch (e) {
    return { PERMIT: {}, MOVEMENT: {} };
  }
}

async function renderScanLogView() {
  const sidebar = document.getElementById("sidebar-content");
  sidebar.innerHTML = `<div class="nav-section"><div class="nav-section-title">SCAN LOG</div>
    <button class="nav-item active" onclick="renderScanLogView()">📋 All Entries</button>
  </div>`;
  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Loading scan log...</div>';

  try {
    const [entries, opts] = await Promise.all([
      api("/api/scan-log"),
      loadScanLogOptions(),
    ]);
    const districts = opts.PERMIT?.District || [];
    const jurisdictions = opts.PERMIT?.Jurisdiction || [];
    const sectors = opts.PERMIT?.ClassificationOfUndertaking || [];

    let html = `<div style="padding:20px;max-width:1400px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="color:var(--text-white);margin:0;font-size:18px">📋 Scan Log</h2>
          <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0">Track document scanning activities — ${entries.length} entries</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="addScanLogEntry()">➕ New Entry</button>
          <button class="btn btn-sm" onclick="exportScanLog()">📥 Export Excel</button>
        </div>
      </div>

      <!-- Filters -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:end">
        <div style="flex:1;min-width:150px">
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Company</label>
          <input type="text" id="sl-filter-company" placeholder="Search company..." style="width:100%;font-size:12px" oninput="filterScanLogTable()">
        </div>
        <div style="min-width:120px">
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">District</label>
          <select id="sl-filter-district" style="width:100%;font-size:12px" onchange="filterScanLogTable()">
            <option value="">All</option>
            ${districts.map((d) => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join("")}
          </select>
        </div>
        <div style="min-width:100px">
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Status</label>
          <select id="sl-filter-status" style="width:100%;font-size:12px" onchange="filterScanLogTable()">
            <option value="">All</option><option value="New">New</option><option value="Update">Update</option>
          </select>
        </div>
        <button class="btn btn-sm" onclick="clearScanLogFilters()" style="font-size:11px">Clear</button>
      </div>

      <!-- Table -->
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-card)">
        <table class="data-table" id="scan-log-table" style="width:100%;min-width:1200px">
          <thead><tr>
            <th style="width:40px">#</th>
            <th style="width:90px">Date</th>
            <th style="width:80px">File No.</th>
            <th>Company Name</th>
            <th>Sector</th>
            <th>Location</th>
            <th>District</th>
            <th style="width:80px">Status</th>
            <th style="width:65px">Last Folio</th>
            <th style="width:65px">Curr Folio</th>
            <th style="width:60px">Docs</th>
            <th style="width:80px">Actions</th>
          </tr></thead>
          <tbody id="scan-log-tbody">`;

    if (entries.length === 0) {
      html +=
        '<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-muted)">No scan log entries yet. Click "New Entry" to get started.</td></tr>';
    } else {
      entries.forEach((e, i) => {
        html += `<tr data-company="${escHtml((e.company_name || "").toLowerCase())}" data-district="${escHtml(e.district || "")}" data-status="${escHtml(e.scan_status || "")}">
          <td style="color:var(--text-muted)">${i + 1}</td>
          <td style="font-size:12px">${escHtml(e.scan_date || "").slice(0, 10)}</td>
          <td style="font-size:12px">${escHtml(e.file_number || "")}</td>
          <td style="font-weight:500;color:var(--text-white)">${escHtml(e.company_name || "—")}</td>
          <td style="font-size:12px;color:var(--text-dim)">${escHtml(e.sector || e.specific_sector || "—")}</td>
          <td style="font-size:12px;color:var(--text-dim)">${escHtml(e.location || "—")}</td>
          <td style="font-size:12px">${escHtml(e.district || "—")}</td>
          <td><span class="tag ${e.scan_status === "New" ? "tag-green" : "tag-blue"}" style="font-size:10px">${escHtml(e.scan_status || "")}</span></td>
          <td style="text-align:center">${e.last_folio || 0}</td>
          <td style="text-align:center">${e.current_folio || 0}</td>
          <td style="text-align:center;font-weight:600;color:var(--accent)">${e.documents_scanned || 0}</td>
          <td>
            <button class="btn btn-sm" onclick="editScanLogEntry(${e.id})" title="Edit" style="padding:3px 6px">✏️</button>
            <button class="btn btn-sm" onclick="deleteScanLogEntry(${e.id},${escAttr(e.company_name || "")})" title="Delete" style="padding:3px 6px;color:var(--red)">🗑️</button>
          </td>
        </tr>`;
      });
    }

    html += `</tbody></table></div>

      <!-- Summary -->
      <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 20px;flex:1;min-width:140px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:var(--accent)">${entries.length}</div>
          <div style="font-size:11px;color:var(--text-muted)">Total Entries</div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 20px;flex:1;min-width:140px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:var(--green)">${entries.reduce((s, e) => s + (e.documents_scanned || 0), 0)}</div>
          <div style="font-size:11px;color:var(--text-muted)">Total Documents Scanned</div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 20px;flex:1;min-width:140px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:var(--blue)">${entries.filter((e) => e.scan_status === "New").length}</div>
          <div style="font-size:11px;color:var(--text-muted)">New Scans</div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 20px;flex:1;min-width:140px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:var(--yellow)">${entries.filter((e) => e.scan_status === "Update").length}</div>
          <div style="font-size:11px;color:var(--text-muted)">Updates</div>
        </div>
      </div>
    </div>`;

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function filterScanLogTable() {
  const company = (
    document.getElementById("sl-filter-company")?.value || ""
  ).toLowerCase();
  const district = document.getElementById("sl-filter-district")?.value || "";
  const status = document.getElementById("sl-filter-status")?.value || "";
  document
    .querySelectorAll("#scan-log-tbody tr[data-company]")
    .forEach((row) => {
      const matchCompany = !company || row.dataset.company.includes(company);
      const matchDistrict = !district || row.dataset.district === district;
      const matchStatus = !status || row.dataset.status === status;
      row.style.display =
        matchCompany && matchDistrict && matchStatus ? "" : "none";
    });
}

function clearScanLogFilters() {
  const el1 = document.getElementById("sl-filter-company");
  if (el1) el1.value = "";
  const el2 = document.getElementById("sl-filter-district");
  if (el2) el2.value = "";
  const el3 = document.getElementById("sl-filter-status");
  if (el3) el3.value = "";
  filterScanLogTable();
}

async function addScanLogEntry() {
  const opts = await loadScanLogOptions();
  const districts = opts.PERMIT?.District || [];
  const jurisdictions = opts.PERMIT?.Jurisdiction || [];
  const sectors = opts.PERMIT?.ClassificationOfUndertaking || [];

  const result = await showFormModal({
    title: "New Scan Log Entry",
    icon: "📋",
    fields: [
      {
        key: "scan_date",
        label: "Date",
        type: "date",
        value: new Date().toISOString().slice(0, 10),
        required: true,
      },
      {
        key: "file_number",
        label: "File Number",
        placeholder: "e.g. EPA/WR/123",
      },
      {
        key: "company_name",
        label: "Company Name",
        placeholder: "Enter company name",
        required: true,
      },
      {
        key: "sector",
        label: "Sector",
        type: "select",
        options: ["", ...sectors],
      },
      { key: "location", label: "Location", placeholder: "Facility location" },
      {
        key: "district",
        label: "District",
        type: "select",
        options: ["", ...districts],
      },
      {
        key: "jurisdiction",
        label: "Jurisdiction",
        type: "select",
        options: ["", ...jurisdictions],
      },
      {
        key: "scan_status",
        label: "Status",
        type: "select",
        options: [
          { value: "New", label: "New" },
          { value: "Update", label: "Update" },
        ],
        value: "New",
      },
      { key: "last_folio", label: "Last Folio", type: "number", value: "0" },
      {
        key: "current_folio",
        label: "Current Folio",
        type: "number",
        value: "0",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Additional notes...",
      },
    ],
    confirmText: "Add Entry",
  });
  if (!result) return;
  showProgressBar();
  try {
    await api("/api/scan-log", {
      method: "POST",
      body: JSON.stringify(result),
    });
    toast("Scan log entry added", "success");
    renderScanLogView();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function editScanLogEntry(id) {
  showProgressBar();
  try {
    const entry = await api(`/api/scan-log/${id}`);
    const opts = await loadScanLogOptions();
    const districts = opts.PERMIT?.District || [];
    const jurisdictions = opts.PERMIT?.Jurisdiction || [];
    const sectors = opts.PERMIT?.ClassificationOfUndertaking || [];

    const result = await showFormModal({
      title: "Edit Scan Log Entry",
      icon: "✏️",
      fields: [
        {
          key: "scan_date",
          label: "Date",
          type: "date",
          value: (entry.scan_date || "").slice(0, 10),
          required: true,
        },
        {
          key: "file_number",
          label: "File Number",
          value: entry.file_number || "",
        },
        {
          key: "company_name",
          label: "Company Name",
          value: entry.company_name || "",
          required: true,
        },
        {
          key: "sector",
          label: "Sector",
          type: "select",
          options: ["", ...sectors],
          value: entry.sector || "",
        },
        { key: "location", label: "Location", value: entry.location || "" },
        {
          key: "district",
          label: "District",
          type: "select",
          options: ["", ...districts],
          value: entry.district || "",
        },
        {
          key: "jurisdiction",
          label: "Jurisdiction",
          type: "select",
          options: ["", ...jurisdictions],
          value: entry.jurisdiction || "",
        },
        {
          key: "scan_status",
          label: "Status",
          type: "select",
          options: [
            { value: "New", label: "New" },
            { value: "Update", label: "Update" },
          ],
          value: entry.scan_status || "New",
        },
        {
          key: "last_folio",
          label: "Last Folio",
          type: "number",
          value: String(entry.last_folio || 0),
        },
        {
          key: "current_folio",
          label: "Current Folio",
          type: "number",
          value: String(entry.current_folio || 0),
        },
        {
          key: "notes",
          label: "Notes",
          type: "textarea",
          value: entry.notes || "",
        },
      ],
      confirmText: "Save Changes",
    });
    if (!result) return;
    showProgressBar();
    await api(`/api/scan-log/${id}`, {
      method: "PUT",
      body: JSON.stringify(result),
    });
    toast("Entry updated", "success");
    renderScanLogView();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function deleteScanLogEntry(id, name) {
  if (
    !(await showConfirmModal(`Delete scan log entry "${name}"?`, {
      title: "Delete Entry",
      icon: "🗑️",
      confirmText: "Delete",
      danger: true,
    }))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/scan-log/${id}`, { method: "DELETE" });
    toast("Entry deleted", "success");
    renderScanLogView();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function exportScanLog() {
  showProgressBar();
  try {
    const params = new URLSearchParams();
    const company = document.getElementById("sl-filter-company")?.value;
    const district = document.getElementById("sl-filter-district")?.value;
    const status = document.getElementById("sl-filter-status")?.value;
    if (company) params.set("company", company);
    if (district) params.set("district", district);
    if (status) params.set("status", status);
    const res = await fetch(`/api/scan-log-export?${params}`, {
      headers: { Authorization: "Bearer " + state.token },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan_log_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Scan log exported", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ══════════════════════════════════════════════════════════════
//  PERMIT FILTER & EXPORT — Advanced filtering tool
// ══════════════════════════════════════════════════════════════
async function renderPermitFilterView() {
  const sidebar = document.getElementById("sidebar-content");
  sidebar.innerHTML = `<div class="nav-section"><div class="nav-section-title">PERMIT FILTER</div>
    <button class="nav-item active" onclick="renderPermitFilterView()">🔍 Filter & Export</button>
  </div>`;
  const content = document.getElementById("content");

  try {
    const opts = await loadScanLogOptions();
    const districts = opts.PERMIT?.District || [];
    const jurisdictions = opts.PERMIT?.Jurisdiction || [];
    const sectors = opts.PERMIT?.ClassificationOfUndertaking || [];
    const statuses = opts.PERMIT?.ApplicationStatus || [];
    const remarks = opts.PERMIT?.Remarks || [];
    const fileLocations = opts.PERMIT?.FileLocation || [];
    const permittedBy = opts.PERMIT?.PermittedBy || [];
    const screening = opts.PERMIT?.Screening || [];
    const appStatusII = opts.PERMIT?.ApplicationStatusII || [];
    const statusComments = opts.PERMIT?.StatusOrComments || [];

    const selOpts = (arr) =>
      arr
        .map((v) => `<option value="${escHtml(v)}">${escHtml(v)}</option>`)
        .join("");

    let html = `<div class="pf-container">
      <div class="pf-header">
        <div>
          <h2 class="pf-title">🔍 Permit Filter & Export</h2>
          <p class="pf-subtitle">Build precise queries using the filters below, then view or export results</p>
        </div>
        <div class="pf-header-actions">
          <button class="btn btn-primary btn-sm" onclick="applyPermitFilter()">🔍 Search</button>
          <button class="btn btn-sm" onclick="exportFilteredPermits()">📥 Export</button>
          <button class="btn btn-sm" onclick="clearPermitFilters()">✕ Clear</button>
        </div>
      </div>

      <!-- Active filter chips -->
      <div id="pf-chips" class="pf-chips" style="display:none"></div>

      <!-- Filter Groups -->
      <div class="pf-groups">

        <!-- Group 1: Search & Identity -->
        <div class="pf-group">
          <div class="pf-group-title">🏢 Search & Identity</div>
          <div class="pf-group-grid">
            <div class="pf-field">
              <label class="pf-label">Company Name</label>
              <input type="text" id="pf-name" class="pf-input" placeholder="Search by name...">
            </div>
            <div class="pf-field">
              <label class="pf-label">File Number</label>
              <input type="text" id="pf-file-number" class="pf-input" placeholder="e.g. EPA/WR/...">
            </div>
            <div class="pf-field">
              <label class="pf-label">Permit Number</label>
              <input type="text" id="pf-permit-number" class="pf-input" placeholder="Search permit no...">
            </div>
            <div class="pf-field">
              <label class="pf-label">Officer Working on File</label>
              <input type="text" id="pf-officer" class="pf-input" placeholder="Officer name...">
            </div>
          </div>
        </div>

        <!-- Group 2: Classification & Area -->
        <div class="pf-group">
          <div class="pf-group-title">📍 Classification & Area</div>
          <div class="pf-group-grid">
            <div class="pf-field">
              <label class="pf-label">Sector / Undertaking</label>
              <select id="pf-undertaking" class="pf-input"><option value="">All Sectors</option>${selOpts(sectors)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">District</label>
              <select id="pf-district" class="pf-input"><option value="">All Districts</option>${selOpts(districts)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Jurisdiction</label>
              <select id="pf-jurisdiction" class="pf-input"><option value="">All Jurisdictions</option>${selOpts(jurisdictions)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Facility Location</label>
              <input type="text" id="pf-location" class="pf-input" placeholder="Search location...">
            </div>
            <div class="pf-field">
              <label class="pf-label">File Storage Location</label>
              <select id="pf-file-location" class="pf-input"><option value="">All Locations</option>${selOpts(fileLocations)}</select>
            </div>
          </div>
        </div>

        <!-- Group 3: Status & Processing -->
        <div class="pf-group">
          <div class="pf-group-title">📋 Status & Processing</div>
          <div class="pf-group-grid">
            <div class="pf-field">
              <label class="pf-label">Application Status</label>
              <select id="pf-status" class="pf-input"><option value="">All Statuses</option>${selOpts(statuses)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Application Type</label>
              <select id="pf-app-type" class="pf-input"><option value="">New & Existing</option>${selOpts(appStatusII)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Screening</label>
              <select id="pf-screening" class="pf-input"><option value="">All</option>${selOpts(screening)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Permitted By</label>
              <select id="pf-permitted-by" class="pf-input"><option value="">All Offices</option>${selOpts(permittedBy)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Remarks</label>
              <select id="pf-remarks" class="pf-input"><option value="">All</option>${selOpts(remarks)}</select>
            </div>
            <div class="pf-field">
              <label class="pf-label">Status / Comments</label>
              <select id="pf-status-comments" class="pf-input"><option value="">All</option>${selOpts(statusComments)}</select>
            </div>
          </div>
        </div>

        <!-- Group 4: Date Ranges -->
        <div class="pf-group">
          <div class="pf-group-title">📅 Date Ranges</div>
          <div class="pf-group-grid pf-date-grid">
            <div class="pf-field">
              <label class="pf-label">Permit Issue Date — From</label>
              <input type="date" id="pf-issue-from" class="pf-input">
            </div>
            <div class="pf-field">
              <label class="pf-label">Permit Issue Date — To</label>
              <input type="date" id="pf-issue-to" class="pf-input">
            </div>
            <div class="pf-field">
              <label class="pf-label">Permit Expiry Date — From</label>
              <input type="date" id="pf-expiry-from" class="pf-input">
            </div>
            <div class="pf-field">
              <label class="pf-label">Permit Expiry Date — To</label>
              <input type="date" id="pf-expiry-to" class="pf-input">
            </div>
          </div>
        </div>

      </div>

      <!-- Results -->
      <div id="pf-results" class="pf-results">
        <div class="pf-empty-state">
          <div class="pf-empty-icon">🔍</div>
          <div class="pf-empty-text">Set your filter criteria above and click <strong>Search</strong> to find permits</div>
        </div>
      </div>
    </div>`;

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function getPermitFilterValues() {
  return {
    name: document.getElementById("pf-name")?.value?.trim() || "",
    fileNumber: document.getElementById("pf-file-number")?.value?.trim() || "",
    permitNumber:
      document.getElementById("pf-permit-number")?.value?.trim() || "",
    officer: document.getElementById("pf-officer")?.value?.trim() || "",
    undertaking: document.getElementById("pf-undertaking")?.value || "",
    district: document.getElementById("pf-district")?.value || "",
    jurisdiction: document.getElementById("pf-jurisdiction")?.value || "",
    location: document.getElementById("pf-location")?.value?.trim() || "",
    fileLocation: document.getElementById("pf-file-location")?.value || "",
    permitStatus: document.getElementById("pf-status")?.value || "",
    appType: document.getElementById("pf-app-type")?.value || "",
    screening: document.getElementById("pf-screening")?.value || "",
    permittedBy: document.getElementById("pf-permitted-by")?.value || "",
    remarks: document.getElementById("pf-remarks")?.value || "",
    statusComments: document.getElementById("pf-status-comments")?.value || "",
    issueDateFrom: document.getElementById("pf-issue-from")?.value || "",
    issueDateTo: document.getElementById("pf-issue-to")?.value || "",
    expiryDateFrom: document.getElementById("pf-expiry-from")?.value || "",
    expiryDateTo: document.getElementById("pf-expiry-to")?.value || "",
  };
}

const PF_CHIP_LABELS = {
  name: "Company",
  fileNumber: "File #",
  permitNumber: "Permit #",
  officer: "Officer",
  undertaking: "Sector",
  district: "District",
  jurisdiction: "Jurisdiction",
  location: "Location",
  fileLocation: "File Location",
  permitStatus: "Status",
  appType: "Type",
  screening: "Screening",
  permittedBy: "Permitted By",
  remarks: "Remarks",
  statusComments: "Comments",
  issueDateFrom: "Issue From",
  issueDateTo: "Issue To",
  expiryDateFrom: "Expiry From",
  expiryDateTo: "Expiry To",
};

function renderPermitFilterChips() {
  const chipsEl = document.getElementById("pf-chips");
  if (!chipsEl) return;
  const filters = getPermitFilterValues();
  const active = Object.entries(filters).filter(([, v]) => v);
  if (active.length === 0) {
    chipsEl.style.display = "none";
    return;
  }
  chipsEl.style.display = "flex";
  chipsEl.innerHTML =
    active
      .map(
        ([k, v]) =>
          `<span class="pf-chip">${escHtml(PF_CHIP_LABELS[k] || k)}: <strong>${escHtml(v)}</strong> <button onclick="clearPfField('${k}')" class="pf-chip-x">✕</button></span>`,
      )
      .join("") +
    `<button class="pf-chip pf-chip-clear" onclick="clearPermitFilters()">Clear All</button>`;
}

function clearPfField(key) {
  const map = {
    name: "pf-name",
    fileNumber: "pf-file-number",
    permitNumber: "pf-permit-number",
    officer: "pf-officer",
    undertaking: "pf-undertaking",
    district: "pf-district",
    jurisdiction: "pf-jurisdiction",
    location: "pf-location",
    fileLocation: "pf-file-location",
    permitStatus: "pf-status",
    appType: "pf-app-type",
    screening: "pf-screening",
    permittedBy: "pf-permitted-by",
    remarks: "pf-remarks",
    statusComments: "pf-status-comments",
    issueDateFrom: "pf-issue-from",
    issueDateTo: "pf-issue-to",
    expiryDateFrom: "pf-expiry-from",
    expiryDateTo: "pf-expiry-to",
  };
  const el = document.getElementById(map[key]);
  if (el) el.value = "";
  renderPermitFilterChips();
  applyPermitFilter();
}

async function applyPermitFilter() {
  const filters = getPermitFilterValues();
  const activeFilters = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v) activeFilters[k] = v;
  });

  renderPermitFilterChips();

  const resultsDiv = document.getElementById("pf-results");
  resultsDiv.innerHTML = '<div class="loading">Searching permits...</div>';

  try {
    const data = await api("/api/permit-filter", {
      method: "POST",
      body: JSON.stringify(activeFilters),
    });
    const rows = data.rows || [];

    if (rows.length === 0) {
      resultsDiv.innerHTML = `<div class="pf-empty-state">
        <div class="pf-empty-icon">📭</div>
        <div class="pf-empty-text">No permits match your filter criteria</div>
      </div>`;
      return;
    }

    let html = `<div class="pf-results-header">
      <span>Found <strong>${rows.length}</strong> permit${rows.length !== 1 ? "s" : ""}</span>
      <button class="btn btn-sm" onclick="exportFilteredPermits()">📥 Export ${rows.length} Result${rows.length !== 1 ? "s" : ""}</button>
    </div>`;
    html += '<div class="pf-table-wrap">';
    html += '<table class="data-table pf-table"><thead><tr>';
    html += '<th style="width:35px">#</th>';
    html += "<th>Company Name</th>";
    html += "<th>Sector</th>";
    html += "<th>Location</th>";
    html += "<th>District</th>";
    html += "<th>File No.</th>";
    html += "<th>Permit No.</th>";
    html += "<th>Issue Date</th>";
    html += "<th>Expiry Date</th>";
    html += "<th>Status</th>";
    html += "<th>Remarks</th>";
    html += '<th style="width:50px"></th>';
    html += "</tr></thead><tbody>";

    rows.forEach((r, i) => {
      const remarkClass =
        r.Remarks === "Valid"
          ? "tag-green"
          : r.Remarks === "Expired"
            ? "tag-red"
            : r.Remarks === "Renewed"
              ? "tag-blue"
              : "tag-yellow";
      html += `<tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td style="font-weight:500;color:var(--text-white)">${escHtml(r.RegisteredNameOfUndertaking || "—")}</td>
        <td class="pf-td-dim">${escHtml(r.ClassificationOfUndertaking || "—")}</td>
        <td class="pf-td-dim">${escHtml(r.FacilityLocation || "—")}</td>
        <td class="pf-td-sm">${escHtml(r.District || "—")}</td>
        <td class="pf-td-sm">${escHtml(r.FileNumber || "—")}</td>
        <td class="pf-td-sm">${escHtml(r.PermitNumber || "—")}</td>
        <td class="pf-td-sm">${escHtml(r.DateOfIssueOfPermit || "—")}</td>
        <td class="pf-td-sm">${escHtml(r.PermitExpirationDate || "—")}</td>
        <td class="pf-td-sm">${escHtml(r.ApplicationStatus || "—")}</td>
        <td><span class="tag ${remarkClass}" style="font-size:10px">${escHtml(r.Remarks || "—")}</span></td>
        <td><button class="btn btn-sm" onclick="showRecordModal('PERMIT',${r.id})" style="padding:3px 6px" title="View Record">👁️</button></td>
      </tr>`;
    });

    html += "</tbody></table></div>";
    resultsDiv.innerHTML = html;
  } catch (err) {
    resultsDiv.innerHTML = `<div style="color:var(--red);padding:12px">${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  RECORDS MANAGEMENT MODULE
// ══════════════════════════════════════════════════════════════

// ── Field definitions for records entries ─────────────────────
const REC_FIELD_SECTIONS = [
  { title: 'Identification', fields: [
    { key: 'company_name', label: 'Company Name', type: 'text', required: true },
    { key: 'client_id', label: 'Client ID', type: 'text' },
    { key: 'contact_person', label: 'Contact Person', type: 'text' },
    { key: 'telephone', label: 'Telephone', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
  ]},
  { title: 'Operational Details', fields: [
    { key: 'sector', label: 'Sector', type: 'suggest' },
    { key: 'type_of_activity', label: 'Type of Activity', type: 'text' },
    { key: 'file_number', label: 'File Number', type: 'text' },
    { key: 'facility_location', label: 'Facility Location', type: 'text' },
    { key: 'district', label: 'District', type: 'text' },
    { key: 'mmda', label: 'MMDA', type: 'text' },
    { key: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
  ]},
  { title: 'Geospatial Data', fields: [
    { key: 'latitude', label: 'Latitude', type: 'text' },
    { key: 'longitude', label: 'Longitude', type: 'text' },
  ]},
  { title: 'Financial Tracking', fields: [
    { key: 'processing_fee', label: 'Processing Fee', type: 'currency' },
    { key: 'date_of_processing_fee', label: 'Date of Processing Fee', type: 'date' },
    { key: 'date_of_payment_processing', label: 'Date of Payment (Processing)', type: 'date' },
    { key: 'permit_fee', label: 'Permit Fee', type: 'currency' },
    { key: 'date_of_permit_fee', label: 'Date of Permit Fee', type: 'date' },
    { key: 'date_of_payment_permit', label: 'Date of Payment (Permit)', type: 'date' },
    { key: 'invoice_number', label: 'Invoice Number', type: 'text' },
    { key: 'date_of_invoice', label: 'Date of Invoice', type: 'date' },
    { key: 'amount_to_pay', label: 'Amount to Pay', type: 'currency' },
    { key: 'amount_paid', label: 'Amount Paid', type: 'currency' },
    { key: 'balance', label: 'Balance', type: 'currency' },
    { key: 'date_of_payment', label: 'Date of Payment', type: 'date' },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' },
  ]},
  { title: 'Permit Details', fields: [
    { key: 'permit_number', label: 'Permit Number', type: 'text' },
    { key: 'permit_holder', label: 'Permit Holder', type: 'text' },
    { key: 'permit_issue_date', label: 'Permit Issue Date', type: 'date' },
    { key: 'permit_expiry_date', label: 'Permit Expiry Date', type: 'date' },
    { key: 'permit_renewal_date', label: 'Permit Renewal Date', type: 'date' },
    { key: 'application_status', label: 'Application Status', type: 'text' },
  ]},
  { title: 'Compliance Timeline', fields: [
    { key: 'date_of_receipt', label: 'Date of Receipt', type: 'date' },
    { key: 'date_of_screening', label: 'Date of Screening', type: 'date' },
    { key: 'date_of_draft_receipt', label: 'Date of Draft Receipt', type: 'date' },
    { key: 'date_of_revised_receipt', label: 'Date of Revised Receipt', type: 'date' },
    { key: 'date_review_sent', label: 'Date Review Comment Sent', type: 'date' },
    { key: 'date_of_emp_submission', label: 'Date of EMP Submission', type: 'date' },
    { key: 'date_of_trc', label: 'Date of TRC', type: 'date' },
    { key: 'date_sent_head_office', label: 'Date Sent to Head Office', type: 'date' },
    { key: 'date_received_head_office', label: 'Date Received from Head Office', type: 'date' },
  ]},
  { title: 'Monitoring & Compliance', fields: [
    { key: 'tentative_date', label: 'Tentative Date', type: 'date' },
    { key: 'group_name', label: 'Group', type: 'text' },
    { key: 'coordinating_officer', label: 'Coordinating Officer', type: 'text' },
    { key: 'monitoring_status', label: 'Monitoring Status', type: 'text' },
    { key: 'compliance_status', label: 'Compliance Status', type: 'text' },
    { key: 'compliance_date', label: 'Compliance Date', type: 'date' },
    { key: 'environmental_report', label: 'Environmental Report', type: 'text' },
    { key: 'due_date_reporting', label: 'Due Date for Reporting', type: 'date' },
    { key: 'reporting_days', label: 'Reporting Days', type: 'text' },
  ]},
  { title: 'Status & Notes', fields: [
    { key: 'officer_on_file', label: 'Officer Working on File', type: 'text' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'remarks', label: 'Remarks', type: 'textarea' },
  ]},
];

// Master grid columns (the 5 key columns shown in the table)
const REC_MASTER_COLS = [
  { key: 'id', label: 'S/N', width: '60px', mono: true },
  { key: 'company_name', label: 'Company Name', flex: 3 },
  { key: 'date_of_receipt', label: 'Date', width: '110px' },
  { key: 'sector', label: 'Sector', flex: 1 },
  { key: 'status', label: 'Status', width: '120px' },
];

// ── Records Explorer View ─────────────────────────────────────
async function renderRecordsView() {
  const sidebar = document.getElementById('sidebar-content');
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '<div class="tab-item active">📂 Records Entries</div>';
  sidebar.innerHTML = '<div class="loading">Loading...</div>';
  await renderRecordsTreeSidebar();
  // If we have a selected category/year/quarter, load it
  if (state.recCategory && state.recYear && state.recQuarter) {
    loadRecordsWorkspace();
  } else {
    const content = document.getElementById('content');
    content.innerHTML = `<div class="rec-welcome">
      <div class="rec-welcome-icon">📂</div>
      <h2>Records Entries</h2>
      <p>Select a category, year, and quarter from the sidebar explorer to view records.</p>
      <p style="color:var(--text-muted);font-size:12px;margin-top:8px">Use the tree navigation on the left to browse Applications Received, Permitted Applications, and Monitoring Records.</p>
    </div>`;
  }
}

// ── Tree Sidebar ──────────────────────────────────────────────
async function renderRecordsTreeSidebar() {
  const sidebar = document.getElementById('sidebar-content');
  let html = '<div class="rec-tree">';
  for (const cat of REC_CATEGORIES) {
    const expanded = state.recExpandedNodes[cat.key];
    html += `<div class="rec-tree-node rec-tree-root" onclick="toggleRecTreeNode('${cat.key}')">
      <span class="rec-tree-arrow">${expanded ? '▾' : '▸'}</span>
      <span class="rec-tree-icon">${cat.icon}</span>
      <span class="rec-tree-label">${cat.label}</span>
    </div>`;
    if (expanded) {
      html += `<div class="rec-tree-children" id="rec-tree-children-${cat.key}">
        <div class="rec-tree-add" onclick="event.stopPropagation();showAddYearModal('${cat.key}')">
          <span class="rec-tree-add-icon">＋</span>
          <span>Add New Year</span>
        </div>
        <div class="loading" style="padding:4px 16px;font-size:11px">Loading years...</div>
      </div>`;
    }
  }
  html += '</div>';
  sidebar.innerHTML = html;
  // Load years for expanded categories
  for (const cat of REC_CATEGORIES) {
    if (state.recExpandedNodes[cat.key]) {
      loadRecTreeYears(cat.key);
    }
  }
}

async function toggleRecTreeNode(key) {
  state.recExpandedNodes[key] = !state.recExpandedNodes[key];
  await renderRecordsTreeSidebar();
}

async function loadRecTreeYears(catKey) {
  const container = document.getElementById(`rec-tree-children-${catKey}`);
  if (!container) return;
  try {
    const data = await api(`/api/records/years/${catKey}`);
    let html = `<div class="rec-tree-add" onclick="event.stopPropagation();showAddYearModal('${catKey}')">
      <span class="rec-tree-add-icon">＋</span>
      <span>Add New Year</span>
    </div>`;
    if (data.years.length === 0) {
      html += '<div class="rec-tree-empty">No years yet</div>';
    }
    for (const yr of data.years) {
      const yrKey = `${catKey}_${yr.year}`;
      const yrExpanded = state.recExpandedNodes[yrKey];
      const yrCounts = data.counts[yr.year] || {};
      const totalCount = Object.values(yrCounts).reduce((a, b) => a + b, 0);
      html += `<div class="rec-tree-node rec-tree-year" onclick="event.stopPropagation();toggleRecTreeNode('${yrKey}')">
        <span class="rec-tree-arrow">${yrExpanded ? '▾' : '▸'}</span>
        <span class="rec-tree-icon">📅</span>
        <span class="rec-tree-label">${yr.year}</span>
        ${totalCount > 0 ? `<span class="rec-tree-badge">${totalCount}</span>` : ''}
      </div>`;
      if (yrExpanded) {
        html += '<div class="rec-tree-children">';
        for (let q = 1; q <= 4; q++) {
          const cnt = yrCounts[q] || 0;
          const isActive = state.recCategory === catKey && state.recYear === yr.year && state.recQuarter === q;
          html += `<div class="rec-tree-node rec-tree-quarter${isActive ? ' rec-tree-active' : ''}" onclick="event.stopPropagation();selectRecQuarter('${catKey}',${yr.year},${q})" oncontextmenu="event.preventDefault();event.stopPropagation();showRecQuarterCtx(event,'${catKey}',${yr.year},${q})">
            <span class="rec-tree-icon" style="font-size:11px">📋</span>
            <span class="rec-tree-label">${REC_QUARTER_LABELS[q]}</span>
            ${cnt > 0 ? `<span class="rec-tree-badge">${cnt}</span>` : ''}
          </div>`;
        }
        html += '</div>';
      }
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:4px 16px;color:var(--red);font-size:11px">${e.message}</div>`;
  }
}

function selectRecQuarter(cat, year, quarter) {
  state.recCategory = cat;
  state.recYear = year;
  state.recQuarter = quarter;
  state.recSelectedEntryId = null;
  state.recInspectorMode = 'detail';
  state.recSearchTerm = '';
  // Update tree active state
  document.querySelectorAll('.rec-tree-quarter').forEach(el => el.classList.remove('rec-tree-active'));
  const activeNode = document.querySelector(`.rec-tree-quarter[onclick*="'${cat}',${year},${quarter}"]`);
  if (activeNode) activeNode.classList.add('rec-tree-active');
  loadRecordsWorkspace();
}

// ── Right-click context menu on quarter ───────────────────────
function showRecQuarterCtx(event, cat, year, quarter) {
  document.querySelectorAll('.att-ctx-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'att-ctx-menu';
  menu.style.left = event.clientX + 'px';
  menu.style.top = event.clientY + 'px';
  menu.innerHTML = `
    <div class="att-ctx-item" onclick="this.parentElement.remove();selectRecQuarter('${cat}',${year},${quarter});setTimeout(()=>recStartAddEntry(),200)">📝 Add New Record</div>
    <div class="att-ctx-item" onclick="this.parentElement.remove();selectRecQuarter('${cat}',${year},${quarter})">📋 View Records</div>
  `;
  document.body.appendChild(menu);
  setTimeout(() => {
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }};
    document.addEventListener('click', close);
  }, 0);
}

// ── Add Year Modal ────────────────────────────────────────────
function showAddYearModal(catKey) {
  const currentYear = new Date().getFullYear();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `<div class="modal" style="width:400px">
    <div class="modal-header"><h3 style="margin:0">Add New Year</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
    <div class="modal-body" style="padding:20px">
      <p style="font-size:13px;color:var(--text-primary);margin-bottom:12px">Add a year to <strong>${REC_CATEGORY_LABELS[catKey]}</strong></p>
      <input type="number" id="rec-add-year-input" value="${currentYear}" min="2000" max="2100" style="width:100%;padding:10px;font-size:16px;text-align:center;border-radius:8px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-white)">
    </div>
    <div class="modal-footer"><button class="btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button><button class="btn btn-primary" onclick="submitAddYear('${catKey}')">Add Year</button></div>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('rec-add-year-input').focus();
}

async function submitAddYear(catKey) {
  const input = document.getElementById('rec-add-year-input');
  const year = parseInt(input.value);
  if (!year || year < 2000 || year > 2100) { showToast('Please enter a valid year (2000-2100)', 'error'); return; }
  try {
    await api('/api/records/years', { method: 'POST', body: JSON.stringify({ category: catKey, year }) });
    document.querySelector('.modal-overlay')?.remove();
    showToast(`Year ${year} added to ${REC_CATEGORY_LABELS[catKey]}`, 'success');
    state.recExpandedNodes[catKey] = true;
    state.recExpandedNodes[`${catKey}_${year}`] = true;
    await renderRecordsTreeSidebar();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Master-Detail Workspace ───────────────────────────────────
async function loadRecordsWorkspace() {
  const content = document.getElementById('content');
  const tabBar = document.getElementById('tab-bar');
  const catLabel = REC_CATEGORY_LABELS[state.recCategory] || state.recCategory;
  const qLabel = REC_QUARTER_LABELS[state.recQuarter] || `Q${state.recQuarter}`;
  tabBar.innerHTML = `<div class="tab-item active">📂 ${catLabel} — ${state.recYear} ${qLabel}</div>`;
  content.innerHTML = '<div class="loading">Loading records...</div>';
  try {
    const params = state.recSearchTerm ? `?search=${encodeURIComponent(state.recSearchTerm)}` : '';
    const data = await api(`/api/records/entries/${state.recCategory}/${state.recYear}/${state.recQuarter}${params}`);
    let html = '';
    // Breadcrumbs
    html += `<div class="rec-breadcrumbs">
      <span class="rec-bc-item" onclick="state.recCategory=null;state.recYear=null;state.recQuarter=null;renderRecordsView()">Records Entries</span>
      <span class="rec-bc-sep">›</span>
      <span class="rec-bc-item">${escHtml(catLabel)}</span>
      <span class="rec-bc-sep">›</span>
      <span class="rec-bc-item">${state.recYear}</span>
      <span class="rec-bc-sep">›</span>
      <span class="rec-bc-current">${qLabel}</span>
    </div>`;
    // Toolbar
    html += `<div class="rec-toolbar">
      <div class="rec-toolbar-left">
        <div class="rec-search-box">
          <span class="search-icon">🔍</span>
          <input type="search" id="rec-search-input" placeholder="Filter records..." value="${escHtml(state.recSearchTerm)}" oninput="recHandleSearch(this.value)">
        </div>
        <span class="rec-result-count">${data.total} record${data.total !== 1 ? 's' : ''}</span>
      </div>
      <div class="rec-toolbar-right">
        <button class="btn btn-sm" onclick="recExportCSV()" title="Export CSV">📥 Export</button>
        <button class="btn btn-primary btn-sm" onclick="recStartAddEntry()">＋ New Entry</button>
      </div>
    </div>`;
    // Master-Detail container
    html += '<div class="rec-master-detail">';
    // Master Grid
    html += '<div class="rec-master" id="rec-master">';
    html += '<table class="rec-table"><thead><tr>';
    for (const col of REC_MASTER_COLS) {
      const w = col.width ? `width:${col.width}` : `flex:${col.flex || 1}`;
      html += `<th style="${w}">${col.label}</th>`;
    }
    html += '</tr></thead><tbody>';
    if (data.rows.length === 0) {
      html += `<tr><td colspan="${REC_MASTER_COLS.length}" class="rec-table-empty">
        <div class="rec-empty-zone" id="rec-drop-zone">
          <div class="rec-empty-icon">📋</div>
          <div class="rec-empty-title">No records yet</div>
          <div class="rec-empty-sub">Click <strong>＋ New Entry</strong> to add a record, or drag &amp; drop a CSV file here to import.</div>
        </div>
      </td></tr>`;
    } else {
      data.rows.forEach((row, idx) => {
        const isSelected = state.recSelectedEntryId === row.id;
        const isNew = row._isNew;
        const statusClass = recGetStatusClass(row.status);
        const ffFields = (row.is_forward_filled || '').split(',').filter(Boolean);
        html += `<tr class="rec-row${isSelected ? ' rec-row-selected' : ''}${isNew ? ' rec-row-new' : ''}" data-id="${row.id}" onclick="recSelectRow(${row.id})">`;
        html += `<td class="rec-cell-mono">${idx + 1}</td>`;
        html += `<td class="rec-cell-name" title="${escHtml(row.company_name || '')}">${escHtml(row.company_name || '—')}</td>`;
        html += `<td class="rec-cell-date">${escHtml(row.date_of_receipt || '—')}</td>`;
        html += `<td class="rec-cell-sector" title="${escHtml(row.sector || '')}">${escHtml(row.sector || '—')}</td>`;
        html += `<td><span class="rec-status-chip ${statusClass}">${escHtml(row.status || 'Pending')}</span></td>`;
        html += '</tr>';
      });
    }
    html += '</tbody></table></div>';
    // Inspector Panel
    html += '<div class="rec-inspector" id="rec-inspector">';
    html += recRenderInspectorContent(data.rows);
    html += '</div>';
    html += '</div>'; // end master-detail
    content.innerHTML = html;
    // Setup drag-drop on empty zone
    const dropZone = document.getElementById('rec-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('rec-drop-active'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('rec-drop-active'));
      dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('rec-drop-active'); recHandleCSVDrop(e); });
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
  }
}

function recGetStatusClass(status) {
  if (!status) return 'rec-status-pending';
  const s = status.toLowerCase();
  if (s.includes('permit') && (s.includes('issued') || s.includes('granted'))) return 'rec-status-permitted';
  if (s.includes('pending') || s.includes('processing')) return 'rec-status-pending';
  if (s.includes('expired')) return 'rec-status-expired';
  if (s.includes('renew')) return 'rec-status-renewal';
  if (s.includes('complete') || s.includes('done') || s.includes('valid')) return 'rec-status-permitted';
  return 'rec-status-pending';
}

function recHandleSearch(val) {
  clearTimeout(searchTimer);
  state.recSearchTerm = val;
  searchTimer = setTimeout(() => loadRecordsWorkspace(), 300);
}

// ── Select Row → Inspector ────────────────────────────────────
async function recSelectRow(id) {
  state.recSelectedEntryId = id;
  state.recInspectorMode = 'detail';
  // Highlight row
  document.querySelectorAll('.rec-row').forEach(r => r.classList.toggle('rec-row-selected', parseInt(r.dataset.id) === id));
  // Load entry details
  const inspector = document.getElementById('rec-inspector');
  inspector.innerHTML = '<div class="loading" style="padding:20px">Loading...</div>';
  try {
    const entry = await api(`/api/records/entry/${id}`);
    inspector.innerHTML = recRenderDetailInspector(entry);
  } catch (e) {
    inspector.innerHTML = `<div style="padding:16px;color:var(--red)">${e.message}</div>`;
  }
}

function recRenderInspectorContent(rows) {
  if (state.recInspectorMode === 'add') return recRenderAddForm();
  if (state.recSelectedEntryId) {
    const entry = rows.find(r => r.id === state.recSelectedEntryId);
    if (entry) return recRenderDetailInspector(entry);
  }
  return `<div class="rec-inspector-empty">
    <div class="rec-inspector-empty-icon">👈</div>
    <div class="rec-inspector-empty-text">Select a record from the table to view its details</div>
  </div>`;
}

// ── Detail Inspector ──────────────────────────────────────────
function recRenderDetailInspector(entry) {
  const ffFields = (entry.is_forward_filled || '').split(',').filter(Boolean);
  let html = `<div class="rec-insp-header">
    <div class="rec-insp-title">${escHtml(entry.company_name || 'Record #' + entry.id)}</div>
    <div class="rec-insp-actions">
      <button class="btn btn-sm" onclick="recStartEditEntry(${entry.id})" title="Edit">✏️ Edit</button>
      <button class="btn btn-sm rec-btn-danger" onclick="recDeleteEntry(${entry.id})" title="Delete">🗑️</button>
    </div>
  </div>
  <div class="rec-insp-meta">
    <span class="rec-status-chip ${recGetStatusClass(entry.status)}">${escHtml(entry.status || 'Pending')}</span>
    <span style="font-size:11px;color:var(--text-muted)">Created ${escHtml(entry.created_at || '')} by ${escHtml(entry.created_by || 'system')}</span>
  </div>`;
  html += '<div class="rec-insp-fields">';
  for (const section of REC_FIELD_SECTIONS) {
    const hasData = section.fields.some(f => entry[f.key] !== null && entry[f.key] !== undefined && entry[f.key] !== '');
    if (!hasData) continue;
    html += `<div class="rec-insp-section">
      <div class="rec-insp-section-title">${section.title}</div>`;
    for (const f of section.fields) {
      const val = entry[f.key];
      if (val === null || val === undefined || val === '') continue;
      const isFF = ffFields.includes(f.key);
      const displayVal = f.type === 'currency' ? formatGHS(val) : escHtml(String(val));
      html += `<div class="rec-insp-field">
        <span class="rec-insp-label">${f.label}</span>
        <span class="rec-insp-value${isFF ? ' rec-insp-ghost' : ''}${f.type === 'currency' ? ' rec-cell-mono' : ''}">${displayVal}${isFF ? ' <span class="rec-ff-tag">auto-filled</span>' : ''}</span>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function formatGHS(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return escHtml(String(val));
  return 'GHS ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Add Entry Form ────────────────────────────────────────────
function recStartAddEntry() {
  state.recInspectorMode = 'add';
  state.recSelectedEntryId = null;
  document.querySelectorAll('.rec-row').forEach(r => r.classList.remove('rec-row-selected'));
  const inspector = document.getElementById('rec-inspector');
  if (inspector) inspector.innerHTML = recRenderAddForm();
  // Dim the master grid
  const master = document.getElementById('rec-master');
  if (master) master.classList.add('rec-master-dimmed');
}

function recCancelAdd() {
  state.recInspectorMode = 'detail';
  const inspector = document.getElementById('rec-inspector');
  if (inspector) inspector.innerHTML = `<div class="rec-inspector-empty">
    <div class="rec-inspector-empty-icon">👈</div>
    <div class="rec-inspector-empty-text">Select a record from the table to view its details</div>
  </div>`;
  const master = document.getElementById('rec-master');
  if (master) master.classList.remove('rec-master-dimmed');
}

function recRenderAddForm(editEntry) {
  const isEdit = !!editEntry;
  const title = isEdit ? 'Edit Record' : 'New Record';
  const catLabel = REC_CATEGORY_LABELS[state.recCategory] || '';
  const qLabel = REC_QUARTER_LABELS[state.recQuarter] || '';
  let html = `<div class="rec-form-header">
    <div class="rec-form-title">${title}</div>
    <div class="rec-form-context">${catLabel} › ${state.recYear} › ${qLabel}</div>
  </div>
  <form id="rec-entry-form" class="rec-form" onsubmit="event.preventDefault();recSubmitEntry(${isEdit ? editEntry.id : 'null'})">`;
  for (const section of REC_FIELD_SECTIONS) {
    html += `<div class="rec-form-section-title">${section.title}</div>`;
    for (const f of section.fields) {
      const val = isEdit ? (editEntry[f.key] || '') : '';
      const reqMark = f.required ? '<span class="rec-required">*</span>' : '';
      html += `<div class="rec-form-group">
        <label class="rec-form-label">${f.label}${reqMark}</label>`;
      if (f.type === 'textarea') {
        html += `<textarea name="${f.key}" class="rec-form-input rec-form-textarea" rows="3">${escHtml(String(val))}</textarea>`;
      } else if (f.type === 'date') {
        html += `<input type="date" name="${f.key}" class="rec-form-input" value="${escHtml(String(val))}">`;
      } else if (f.type === 'currency') {
        html += `<div class="rec-currency-wrap"><span class="rec-currency-prefix">GHS</span><input type="number" step="0.01" name="${f.key}" class="rec-form-input rec-form-currency" value="${val}" oninput="recAutoCalcTotals()"></div>`;
      } else if (f.type === 'suggest') {
        html += `<input type="text" name="${f.key}" class="rec-form-input" value="${escHtml(String(val))}" list="rec-suggest-${f.key}" autocomplete="off">
        <datalist id="rec-suggest-${f.key}"></datalist>`;
      } else if (f.type === 'status') {
        html += `<select name="${f.key}" class="rec-form-input">
          <option value="Pending"${val === 'Pending' ? ' selected' : ''}>Pending</option>
          <option value="Processing"${val === 'Processing' ? ' selected' : ''}>Processing</option>
          <option value="Permit Issued"${val === 'Permit Issued' ? ' selected' : ''}>Permit Issued</option>
          <option value="Expired"${val === 'Expired' ? ' selected' : ''}>Expired</option>
          <option value="Renewal"${val === 'Renewal' ? ' selected' : ''}>Renewal</option>
          <option value="Completed"${val === 'Completed' ? ' selected' : ''}>Completed</option>
        </select>`;
      } else {
        html += `<input type="${f.type === 'email' ? 'email' : 'text'}" name="${f.key}" class="rec-form-input" value="${escHtml(String(val))}"${f.required ? ' required' : ''}>`;
      }
      html += '</div>';
    }
  }
  html += `<div class="rec-form-actions">
    <button type="button" class="btn" onclick="recCancelAdd()">Cancel</button>
    <button type="submit" class="btn btn-primary" id="rec-save-btn">${isEdit ? 'Save Changes' : 'Save Entry'}</button>
  </div></form>`;
  // Load sector suggestions
  setTimeout(() => recLoadSectorSuggestions(), 100);
  return html;
}

async function recLoadSectorSuggestions() {
  try {
    const data = await api(`/api/records/analytics`);
    const dl = document.getElementById('rec-suggest-sector');
    if (dl && data.sectors) {
      dl.innerHTML = data.sectors.map(s => `<option value="${escHtml(s)}">`).join('');
    }
  } catch (e) { /* ignore */ }
}

function recAutoCalcTotals() {
  const form = document.getElementById('rec-entry-form');
  if (!form) return;
  const pf = parseFloat(form.querySelector('[name="processing_fee"]')?.value) || 0;
  const pmf = parseFloat(form.querySelector('[name="permit_fee"]')?.value) || 0;
  const totalInput = form.querySelector('[name="total_amount"]');
  if (totalInput && !totalInput.dataset.manual) {
    totalInput.value = (pf + pmf).toFixed(2);
  }
  const paid = parseFloat(form.querySelector('[name="amount_paid"]')?.value) || 0;
  const toPayInput = form.querySelector('[name="amount_to_pay"]');
  const balInput = form.querySelector('[name="balance"]');
  if (balInput && !balInput.dataset.manual) {
    const total = parseFloat(totalInput?.value) || 0;
    balInput.value = (total - paid).toFixed(2);
  }
}

async function recSubmitEntry(editId) {
  const form = document.getElementById('rec-entry-form');
  if (!form) return;
  const formData = new FormData(form);
  const body = { category: state.recCategory, year: state.recYear, quarter: state.recQuarter };
  for (const [k, v] of formData.entries()) body[k] = v;
  const saveBtn = document.getElementById('rec-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  try {
    if (editId) {
      await api(`/api/records/entry/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Record updated successfully', 'success');
    } else {
      const result = await api('/api/records/entries', { method: 'POST', body: JSON.stringify(body) });
      showToast(`Record ${result.file_number || '#' + result.id} successfully added to ${state.recYear} Q${state.recQuarter}`, 'success');
    }
    state.recInspectorMode = 'detail';
    const master = document.getElementById('rec-master');
    if (master) master.classList.remove('rec-master-dimmed');
    await loadRecordsWorkspace();
    // Refresh sidebar counts
    const catKey = state.recCategory;
    if (state.recExpandedNodes[catKey]) loadRecTreeYears(catKey);
  } catch (e) {
    showToast(e.message, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editId ? 'Save Changes' : 'Save Entry'; }
  }
}

// ── Edit Entry ────────────────────────────────────────────────
async function recStartEditEntry(id) {
  try {
    const entry = await api(`/api/records/entry/${id}`);
    state.recInspectorMode = 'edit';
    const inspector = document.getElementById('rec-inspector');
    if (inspector) inspector.innerHTML = recRenderAddForm(entry);
    const master = document.getElementById('rec-master');
    if (master) master.classList.add('rec-master-dimmed');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Delete Entry ──────────────────────────────────────────────
async function recDeleteEntry(id) {
  if (!confirm('Are you sure you want to delete this record?')) return;
  try {
    await api(`/api/records/entry/${id}`, { method: 'DELETE' });
    showToast('Record deleted', 'success');
    state.recSelectedEntryId = null;
    await loadRecordsWorkspace();
    const catKey = state.recCategory;
    if (state.recExpandedNodes[catKey]) loadRecTreeYears(catKey);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── CSV Import with Forward-Fill ──────────────────────────────
async function recHandleCSVDrop(event) {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
    showToast('Please drop a CSV or XLSX file', 'error');
    return;
  }
  showToast('Parsing file...', 'info');
  try {
    const text = await file.text();
    const rows = recParseCSV(text);
    if (rows.length === 0) { showToast('No data rows found', 'error'); return; }
    const result = await api(`/api/records/import/${state.recCategory}/${state.recYear}/${state.recQuarter}`, {
      method: 'POST',
      body: JSON.stringify({ rows, ffillCols: ['tentative_date', 'group_name', 'coordinating_officer'] })
    });
    showToast(`Imported ${result.inserted} records successfully`, 'success');
    await loadRecordsWorkspace();
    const catKey = state.recCategory;
    if (state.recExpandedNodes[catKey]) loadRecTreeYears(catKey);
  } catch (e) {
    showToast('Import failed: ' + e.message, 'error');
  }
}

function recParseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const fieldMap = {};
  // Map common header names to our column names
  const headerMappings = {
    'company': 'company_name', 'company_name': 'company_name', 'name_of_company': 'company_name',
    'sector': 'sector', 'district': 'district', 'location': 'facility_location',
    'contact': 'contact_person', 'phone': 'telephone', 'email': 'email',
    'latitude': 'latitude', 'longitude': 'longitude', 'mmda': 'mmda',
    'processing_fee': 'processing_fee', 'permit_fee': 'permit_fee',
    'status': 'status', 'remarks': 'remarks', 'file_number': 'file_number',
    'permit_number': 'permit_number', 'date_of_receipt': 'date_of_receipt',
    'tentative_date': 'tentative_date', 'group': 'group_name', 'group_name': 'group_name',
    'officer': 'coordinating_officer', 'coordinating_officer': 'coordinating_officer',
  };
  headers.forEach((h, i) => {
    const mapped = headerMappings[h] || h;
    fieldMap[i] = mapped;
  });
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row = {};
    vals.forEach((v, i) => {
      if (fieldMap[i]) row[fieldMap[i]] = v.trim();
    });
    return row;
  });
}

// ── Export CSV ─────────────────────────────────────────────────
async function recExportCSV() {
  try {
    const data = await api(`/api/records/entries/${state.recCategory}/${state.recYear}/${state.recQuarter}`);
    if (data.rows.length === 0) { showToast('No records to export', 'info'); return; }
    const allFields = REC_FIELD_SECTIONS.flatMap(s => s.fields);
    const headers = allFields.map(f => f.label);
    const csvRows = [headers.join(',')];
    data.rows.forEach(row => {
      csvRows.push(allFields.map(f => {
        const v = row[f.key];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') ? `"${s}"` : s;
      }).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.recCategory}_${state.recYear}_Q${state.recQuarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  RECORDS ANALYTICS DASHBOARD
// ══════════════════════════════════════════════════════════════
async function renderRecordsAnalyticsView() {
  const sidebar = document.getElementById('sidebar-content');
  sidebar.innerHTML = `<div class="sidebar-item active" onclick="switchView('recordsAnalytics')"><span class="icon">📈</span><span class="label">Analytics Overview</span></div>
  <div class="sidebar-item" onclick="switchView('records')"><span class="icon">📂</span><span class="label">Records Explorer</span></div>`;
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '<div class="tab-item active">📈 Records Analytics</div>';
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Loading analytics...</div>';
  try {
    const data = await api('/api/records/analytics');
    let html = '';
    // Filters
    html += `<div class="rec-analytics-filters">
      <div class="rec-analytics-title">Records Analytics</div>
      <div class="rec-analytics-controls">
        <select id="rec-an-year" onchange="recAnalyticsFilter()" class="rec-an-select">
          <option value="">All Years</option>
          ${(data.years || []).map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
        <select id="rec-an-sector" onchange="recAnalyticsFilter()" class="rec-an-select">
          <option value="">All Sectors</option>
          ${(data.sectors || []).map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('')}
        </select>
      </div>
    </div>`;
    // KPI Cards
    const received = (data.categoryTotals.find(c => c.category === 'applications_received') || {}).cnt || 0;
    const permitted = (data.categoryTotals.find(c => c.category === 'permitted_applications') || {}).cnt || 0;
    const monitoring = (data.categoryTotals.find(c => c.category === 'monitoring_records') || {}).cnt || 0;
    const total = received + permitted + monitoring;
    html += `<div class="rec-an-kpis">
      <div class="rec-an-kpi rec-an-kpi--blue"><div class="rec-an-kpi-val">${total.toLocaleString()}</div><div class="rec-an-kpi-label">Total Records</div></div>
      <div class="rec-an-kpi rec-an-kpi--orange"><div class="rec-an-kpi-val">${received.toLocaleString()}</div><div class="rec-an-kpi-label">Applications Received</div></div>
      <div class="rec-an-kpi rec-an-kpi--green"><div class="rec-an-kpi-val">${permitted.toLocaleString()}</div><div class="rec-an-kpi-label">Permitted</div></div>
      <div class="rec-an-kpi rec-an-kpi--purple"><div class="rec-an-kpi-val">${monitoring.toLocaleString()}</div><div class="rec-an-kpi-label">Monitoring</div></div>
    </div>`;
    // Fulfillment Funnel
    const funnelPct = data.funnel.received > 0 ? Math.round((data.funnel.permitted / data.funnel.received) * 100) : 0;
    html += `<div class="rec-an-row">
      <div class="rec-an-card rec-an-card-half">
        <div class="rec-an-card-title">Fulfillment Funnel</div>
        <div class="rec-an-funnel">
          <div class="rec-an-funnel-bar" style="width:100%;background:var(--orange-bg);border:1px solid var(--orange)">
            <span>Received: ${data.funnel.received}</span>
          </div>
          <div class="rec-an-funnel-bar" style="width:${Math.max(funnelPct, 5)}%;background:var(--green-bg);border:1px solid var(--green)">
            <span>Permitted: ${data.funnel.permitted} (${funnelPct}%)</span>
          </div>
        </div>
      </div>
      <div class="rec-an-card rec-an-card-half">
        <div class="rec-an-card-title">Status Distribution</div>
        <div class="rec-an-status-list">
          ${data.statusDistribution.map(s => {
            const pct = total > 0 ? Math.round((s.cnt / total) * 100) : 0;
            return `<div class="rec-an-status-row">
              <span class="rec-status-chip ${recGetStatusClass(s.status)}">${escHtml(s.status || 'Unknown')}</span>
              <div class="rec-an-bar-track"><div class="rec-an-bar-fill" style="width:${pct}%"></div></div>
              <span class="rec-an-bar-val">${s.cnt}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
    // Sector Distribution & Revenue by MMDA
    html += `<div class="rec-an-row">
      <div class="rec-an-card rec-an-card-half">
        <div class="rec-an-card-title">Sector Distribution</div>
        <canvas id="rec-an-sector-chart" height="250"></canvas>
      </div>
      <div class="rec-an-card rec-an-card-half">
        <div class="rec-an-card-title">Revenue by MMDA</div>
        <canvas id="rec-an-revenue-chart" height="250"></canvas>
      </div>
    </div>`;
    // Quarterly Volume
    html += `<div class="rec-an-row">
      <div class="rec-an-card">
        <div class="rec-an-card-title">Quarterly Volume</div>
        <canvas id="rec-an-quarterly-chart" height="200"></canvas>
      </div>
    </div>`;
    content.innerHTML = html;
    // Render charts
    recRenderAnalyticsCharts(data);
  } catch (e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

async function recAnalyticsFilter() {
  const year = document.getElementById('rec-an-year')?.value || '';
  const sector = document.getElementById('rec-an-sector')?.value || '';
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Updating analytics...</div>';
  try {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (sector) params.set('sector', sector);
    const data = await api(`/api/records/analytics?${params}`);
    // Re-render with same function but passing filters
    renderRecordsAnalyticsView();
  } catch (e) {
    content.innerHTML = `<div style="padding:16px;color:var(--red)">${e.message}</div>`;
  }
}

function recRenderAnalyticsCharts(data) {
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') return;
  // Sector donut
  const sectorCtx = document.getElementById('rec-an-sector-chart');
  if (sectorCtx && data.sectorDistribution.length > 0) {
    new Chart(sectorCtx, {
      type: 'doughnut',
      data: {
        labels: data.sectorDistribution.map(s => s.sector || 'Unknown'),
        datasets: [{
          data: data.sectorDistribution.map(s => s.cnt),
          backgroundColor: ['#0078d4', '#4ec9b0', '#ce9178', '#dcdcaa', '#f14c4c', '#c586c0', '#4fc1ff', '#569cd6', '#d7ba7d', '#9cdcfe', '#608b4e', '#b5cea8', '#d4d4d4', '#e06c75', '#56b6c2'],
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'right', labels: { color: '#ccc', font: { size: 11 } } } }
      }
    });
  }
  // Revenue bar chart
  const revCtx = document.getElementById('rec-an-revenue-chart');
  if (revCtx && data.revenueByMmda.length > 0) {
    new Chart(revCtx, {
      type: 'bar',
      data: {
        labels: data.revenueByMmda.map(r => r.mmda || 'Unknown'),
        datasets: [
          { label: 'Processing Fees', data: data.revenueByMmda.map(r => r.proc_fees), backgroundColor: '#0078d4' },
          { label: 'Permit Fees', data: data.revenueByMmda.map(r => r.perm_fees), backgroundColor: '#4ec9b0' },
        ]
      },
      options: {
        responsive: true,
        scales: { x: { ticks: { color: '#999', font: { size: 10 } }, grid: { color: '#333' } }, y: { ticks: { color: '#999' }, grid: { color: '#333' } } },
        plugins: { legend: { labels: { color: '#ccc' } } }
      }
    });
  }
  // Quarterly line chart
  const qCtx = document.getElementById('rec-an-quarterly-chart');
  if (qCtx && data.quarterlyVolume.length > 0) {
    const categories = ['applications_received', 'permitted_applications', 'monitoring_records'];
    const catColors = { applications_received: '#ce9178', permitted_applications: '#4ec9b0', monitoring_records: '#569cd6' };
    const allLabels = [...new Set(data.quarterlyVolume.map(q => `${q.year} Q${q.quarter}`))].sort();
    const datasets = categories.map(cat => {
      const catData = data.quarterlyVolume.filter(q => q.category === cat);
      const dataMap = {};
      catData.forEach(q => { dataMap[`${q.year} Q${q.quarter}`] = q.cnt; });
      return {
        label: REC_CATEGORY_LABELS[cat],
        data: allLabels.map(l => dataMap[l] || 0),
        borderColor: catColors[cat],
        backgroundColor: catColors[cat] + '33',
        fill: true,
        tension: 0.3,
      };
    });
    new Chart(qCtx, {
      type: 'line',
      data: { labels: allLabels, datasets },
      options: {
        responsive: true,
        scales: { x: { ticks: { color: '#999' }, grid: { color: '#333' } }, y: { ticks: { color: '#999' }, grid: { color: '#333' }, beginAtZero: true } },
        plugins: { legend: { labels: { color: '#ccc' } } }
      }
    });
  }
}

async function exportFilteredPermits() {
  const filters = getPermitFilterValues();
  const activeFilters = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v) activeFilters[k] = v;
  });

  showProgressBar();
  try {
    const res = await fetch("/api/permit-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.token,
      },
      body: JSON.stringify(activeFilters),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permit_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Permits exported to Excel", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

function clearPermitFilters() {
  [
    "pf-name",
    "pf-file-number",
    "pf-permit-number",
    "pf-officer",
    "pf-undertaking",
    "pf-district",
    "pf-jurisdiction",
    "pf-location",
    "pf-file-location",
    "pf-status",
    "pf-app-type",
    "pf-screening",
    "pf-permitted-by",
    "pf-remarks",
    "pf-status-comments",
    "pf-issue-from",
    "pf-issue-to",
    "pf-expiry-from",
    "pf-expiry-to",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const chipsEl = document.getElementById("pf-chips");
  if (chipsEl) chipsEl.style.display = "none";
  document.getElementById("pf-results").innerHTML =
    `<div class="pf-empty-state">
      <div class="pf-empty-icon">🔍</div>
      <div class="pf-empty-text">Set your filter criteria above and click <strong>Search</strong> to find permits</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  ACTIVITY LOG — Enhanced with revert & delete
// ══════════════════════════════════════════════════════════════
async function revertActivity(logId) {
  if (
    !(await showConfirmModal(
      "Revert this action? This will attempt to undo the change.",
      { title: "Revert Action", icon: "↩️", confirmText: "Revert" },
    ))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/activity/${logId}/revert`, { method: "POST" });
    toast("Action reverted successfully", "success");
    renderActivityView();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

async function deleteActivityLog(logId) {
  if (
    !(await showConfirmModal("Delete this activity log entry?", {
      title: "Delete Log Entry",
      icon: "🗑️",
      confirmText: "Delete",
      danger: true,
    }))
  )
    return;
  showProgressBar();
  try {
    await api(`/api/activity/${logId}`, { method: "DELETE" });
    toast("Log entry deleted", "success");
    renderActivityView();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

// ══════════════════════════════════════════════════════════════
//  SELECTIVE IMPORT PREVIEW
// ══════════════════════════════════════════════════════════════
let importPreviewData = null;

async function handleAccessPreview(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById("access-file-name").textContent = file.name;
  const progress = document.getElementById("upload-progress");
  const results = document.getElementById("upload-results");
  progress.style.display = "block";
  results.style.display = "none";

  const formData = new FormData();
  formData.append("accessFile", file);
  try {
    const headers = {};
    if (state.token) headers["Authorization"] = "Bearer " + state.token;
    const res = await fetch("/api/admin/preview-access", {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json();
    progress.style.display = "none";
    if (!res.ok) {
      results.style.display = "block";
      results.innerHTML = `<div class="tag tag-red" style="padding:8px 12px;font-size:13px">❌ ${data.error}</div>`;
      return;
    }
    importPreviewData = data;
    renderImportPreview(data);
  } catch (err) {
    progress.style.display = "none";
    results.style.display = "block";
    results.innerHTML = `<div class="tag tag-red" style="padding:8px 12px;font-size:13px">❌ ${err.message}</div>`;
  }
}

function renderImportPreview(data) {
  const container =
    document.getElementById("import-preview-container") ||
    document.getElementById("upload-results");
  container.style.display = "block";
  let html = '<div class="import-preview">';
  html +=
    '<h3 style="font-size:15px;color:var(--text-white);margin-bottom:4px">📂 Import Preview</h3>';
  html +=
    '<p style="font-size:12px;color:var(--text-dim);margin-bottom:16px">Select which tables and columns to import from the Access file.</p>';

  data.preview.forEach((t, idx) => {
    html += `<div class="import-table-item" onclick="toggleImportTable(${idx})">
      <input type="checkbox" id="imp-tbl-${idx}" checked onclick="event.stopPropagation()">
      <span class="itl">${t.targetTable}</span>
      <span class="itc">${t.rowCount} rows · ${t.columns.length} matching columns</span>
    </div>`;
    html += `<div class="import-columns" id="imp-cols-${idx}">`;
    t.columns.forEach((col, ci) => {
      html += `<label class="import-col-chip checked">
        <input type="checkbox" checked data-table="${idx}" data-col="${col}" onclick="this.parentElement.classList.toggle('checked',this.checked)"> ${col}
      </label>`;
    });
    html += "</div>";
  });

  html += `<div style="margin-top:16px;display:flex;gap:10px">
    <button class="btn btn-primary" onclick="executeSelectiveImport()">Import Selected</button>
    <button class="btn" onclick="document.getElementById('import-preview-container').style.display='none'">Cancel</button>
  </div>`;
  html += "</div>";
  container.innerHTML = html;
}

function toggleImportTable(idx) {
  const cb = document.getElementById("imp-tbl-" + idx);
  cb.checked = !cb.checked;
  const cols = document.getElementById("imp-cols-" + idx);
  cols.style.display = cb.checked ? "" : "none";
}

async function executeSelectiveImport() {
  if (!importPreviewData) return;
  const selections = [];
  importPreviewData.preview.forEach((t, idx) => {
    const tblCb = document.getElementById("imp-tbl-" + idx);
    if (!tblCb || !tblCb.checked) return;
    const colCheckboxes = document.querySelectorAll(
      `input[data-table="${idx}"]:checked`,
    );
    const columns = Array.from(colCheckboxes).map((c) => c.dataset.col);
    if (columns.length > 0) {
      selections.push({ targetTable: t.targetTable, columns });
    }
  });
  if (selections.length === 0) {
    toast("No tables or columns selected", "error");
    return;
  }
  showProgressBar();
  try {
    const data = await api("/api/admin/import-selected", {
      method: "POST",
      body: JSON.stringify({
        tempFile: importPreviewData.tempFile,
        selections,
      }),
    });
    const results = document.getElementById("upload-results");
    const previewContainer = document.getElementById(
      "import-preview-container",
    );
    if (previewContainer) previewContainer.style.display = "none";
    results.style.display = "block";
    let html =
      '<div style="background:var(--bg-tertiary);border:1px solid var(--green);border-radius:var(--radius-md);padding:16px">';
    html +=
      '<div style="color:var(--green);font-weight:600;margin-bottom:12px">✅ Selective Import Complete</div>';
    html +=
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">';
    for (const [table, count] of Object.entries(data.imported || {})) {
      html += `<div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-sm);text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--text-white)">${count.toLocaleString()}</div>
        <div style="font-size:11px;color:var(--text-dim)">${table}</div>
      </div>`;
    }
    html += "</div>";
    if (data.errors) {
      html += `<div style="margin-top:12px;color:var(--yellow);font-size:12px">⚠️ ${data.errors.join(", ")}</div>`;
    }
    html += "</div>";
    results.innerHTML = html;
    importPreviewData = null;
    toast("Selective import completed", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    removeProgressBar();
  }
}

// ══════════════════════════════════════════════════════════════
//  PERMISSIONS UI
// ══════════════════════════════════════════════════════════════
async function showPermissionsForUser(userId, username) {
  try {
    const [tablePerms, featurePermsData, available] = await Promise.all([
      api(`/api/permissions/user/${userId}`),
      api(`/api/feature-permissions/user/${userId}`),
      api("/api/feature-permissions/available"),
    ]);

    // Build feature permission lookup
    const fp = {};
    featurePermsData.forEach((f) => {
      if (!fp[f.feature_category]) fp[f.feature_category] = {};
      fp[f.feature_category][f.feature_key] = f.is_allowed;
    });
    const hasFP = (cat, key) => (fp[cat]?.[key] ? true : false);

    const content = document.getElementById("content");
    let html = `<div style="margin-bottom:16px"><button class="btn btn-sm" onclick="renderUsersView()">← Back to Users</button></div>`;
    html += `<h2 style="font-size:18px;color:var(--text-white);margin-bottom:4px">Permissions for @${escHtml(username)}</h2>`;
    html += `<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Configure exactly what this user can access. Toggle features on/off. Changes are saved when you click Save.</p>`;

    // Tab navigation
    html += `<div class="perm-tabs">
      <button class="perm-tab active" onclick="switchPermTab(this,'perm-pages')">Pages</button>
      <button class="perm-tab" onclick="switchPermTab(this,'perm-tables')">Tables</button>
      <button class="perm-tab" onclick="switchPermTab(this,'perm-queries')">Queries</button>
      <button class="perm-tab" onclick="switchPermTab(this,'perm-reports')">Reports</button>
      <button class="perm-tab" onclick="switchPermTab(this,'perm-forms')">Forms</button>
      <button class="perm-tab" onclick="switchPermTab(this,'perm-widgets')">Dashboard</button>
    </div>`;

    // Page-level description map
    const pageDesc = {
      dashboard: "Main overview with stats, charts, and quick lists",
      tables: "Browse, search, create, edit, and delete records",
      queries: "Run pre-built queries and view results",
      forms: "Access data entry forms for creating/editing records",
      reports: "Generate and export reports",
      scanlog: "Track and manage scanned document logs",
      permitfilter: "Advanced permit filtering and export tools",
    };

    // ─── Pages Tab ───
    html += `<div class="perm-tab-content" id="perm-pages">
      <div class="perm-section-header">
        <h3>Page Access</h3>
        <p>Control which main pages this user can see and access. Disabling a page hides it from navigation and the dashboard sidebar.</p>
        <div class="perm-bulk-actions">
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-pages',true)">Enable All</button>
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-pages',false)">Disable All</button>
        </div>
      </div>
      <div class="perm-toggle-list">`;
    available.pages.forEach((p) => {
      const on = hasFP("page", p.key);
      const desc = pageDesc[p.key] || "";
      html += `<div class="perm-toggle-row" data-cat="page" data-key="${p.key}">
        <div class="perm-toggle-info"><span class="perm-toggle-name">${p.name}</span>${desc ? `<span class="perm-toggle-sub">${desc}</span>` : ""}</div>
        <button class="perm-switch ${on ? "on" : ""}" onclick="this.classList.toggle('on')"><span class="perm-switch-knob"></span></button>
      </div>`;
    });
    html += `</div>
      <div style="margin-top:12px;padding:10px 14px;background:var(--bg-hover);border-radius:8px;font-size:11px;color:var(--text-muted);line-height:1.5">
        <strong>Note:</strong> Users &amp; Activity Log pages are admin-only and cannot be assigned to regular users. Settings is always accessible.
      </div>
    </div>`;

    // ─── Tables Tab ───
    const tablesPageEnabled = hasFP("page", "tables");
    html += `<div class="perm-tab-content" id="perm-tables" style="display:none">
      <div class="perm-section-header">
        <h3>Table Permissions</h3>
        <p>Set View, Create, Edit, and Delete permissions per table</p>
        ${!tablesPageEnabled ? `<div style="margin-top:8px;padding:8px 12px;background:var(--yellow-dim,rgba(255,193,7,.12));border:1px solid var(--yellow,#ffc107);border-radius:6px;font-size:11px;color:var(--yellow,#ffc107)">⚠️ The "Data Tables" page is currently disabled for this user. These CRUD permissions will only apply if the page is enabled.</div>` : ""}
      </div>
      <div class="perm-table-grid">`;
    const wildcardPerm = tablePerms.find(
      (p) => p.table_name === "*" && !p.record_id,
    );
    const tables = ["*", ...available.tables.map((t) => t.key)];
    tables.forEach((t) => {
      const existing = tablePerms.find(
        (p) => p.table_name === t && !p.record_id,
      );
      let cv, cc, ce, cd;
      if (existing) {
        cv = existing.can_view;
        cc = existing.can_create;
        ce = existing.can_edit;
        cd = existing.can_delete;
      } else if (t === "*") {
        cv = 1;
        cc = 0;
        ce = 0;
        cd = 0;
      } else {
        cv = wildcardPerm?.can_view || 0;
        cc = wildcardPerm?.can_create || 0;
        ce = wildcardPerm?.can_edit || 0;
        cd = wildcardPerm?.can_delete || 0;
      }
      const label = t === "*" ? "⭐ All Tables (Default)" : t;
      const highlight = t === "*" ? " perm-card-highlight" : "";
      html += `<div class="perm-card${highlight}" data-table="${t}" data-user="${userId}">
        <h4>${label}</h4>
        <div class="perm-row"><label>View</label><button class="perm-toggle ${cv ? "on" : ""}" onclick="this.classList.toggle('on')" data-perm="can_view"></button></div>
        <div class="perm-row"><label>Create</label><button class="perm-toggle ${cc ? "on" : ""}" onclick="this.classList.toggle('on')" data-perm="can_create"></button></div>
        <div class="perm-row"><label>Edit</label><button class="perm-toggle ${ce ? "on" : ""}" onclick="this.classList.toggle('on')" data-perm="can_edit"></button></div>
        <div class="perm-row"><label>Delete</label><button class="perm-toggle ${cd ? "on" : ""}" onclick="this.classList.toggle('on')" data-perm="can_delete"></button></div>
      </div>`;
    });
    html += `</div></div>`;

    // ─── Queries Tab ───
    const queriesPageEnabled = hasFP("page", "queries");
    html += `<div class="perm-tab-content" id="perm-queries" style="display:none">
      <div class="perm-section-header">
        <h3>Query Access</h3>
        <p>Control which queries this user can run</p>
        ${!queriesPageEnabled ? `<div style="margin-top:8px;padding:8px 12px;background:var(--yellow-dim,rgba(255,193,7,.12));border:1px solid var(--yellow,#ffc107);border-radius:6px;font-size:11px;color:var(--yellow,#ffc107)">⚠️ The "Queries" page is currently disabled. These permissions will only apply if the page is enabled.</div>` : ""}
        <div class="perm-bulk-actions">
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-queries',true)">Enable All</button>
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-queries',false)">Disable All</button>
        </div>
      </div>
      <div class="perm-toggle-list">`;
    // Group queries by category
    const qGroups = {};
    available.queries.forEach((q) => {
      const cat = q.category || "General";
      if (!qGroups[cat]) qGroups[cat] = [];
      qGroups[cat].push(q);
    });
    Object.entries(qGroups).forEach(([cat, queries]) => {
      html += `<div class="perm-group-title">${cat}</div>`;
      queries.forEach((q) => {
        const on = hasFP("query", q.key);
        html += `<div class="perm-toggle-row" data-cat="query" data-key="${q.key}">
          <div class="perm-toggle-info"><span class="perm-toggle-name">${q.name}</span></div>
          <button class="perm-switch ${on ? "on" : ""}" onclick="this.classList.toggle('on')"><span class="perm-switch-knob"></span></button>
        </div>`;
      });
    });
    html += `</div></div>`;

    // ─── Reports Tab ───
    const reportsPageEnabled = hasFP("page", "reports");
    html += `<div class="perm-tab-content" id="perm-reports" style="display:none">
      <div class="perm-section-header">
        <h3>Report Access</h3>
        <p>Control which reports this user can generate</p>
        ${!reportsPageEnabled ? `<div style="margin-top:8px;padding:8px 12px;background:var(--yellow-dim,rgba(255,193,7,.12));border:1px solid var(--yellow,#ffc107);border-radius:6px;font-size:11px;color:var(--yellow,#ffc107)">⚠️ The "Reports" page is currently disabled. These permissions will only apply if the page is enabled.</div>` : ""}
        <div class="perm-bulk-actions">
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-reports',true)">Enable All</button>
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-reports',false)">Disable All</button>
        </div>
      </div>
      <div class="perm-toggle-list">`;
    available.reports.forEach((r) => {
      const on = hasFP("report", r.key);
      html += `<div class="perm-toggle-row" data-cat="report" data-key="${r.key}">
        <div class="perm-toggle-info"><span class="perm-toggle-name">${r.name}</span></div>
        <button class="perm-switch ${on ? "on" : ""}" onclick="this.classList.toggle('on')"><span class="perm-switch-knob"></span></button>
      </div>`;
    });
    html += `</div></div>`;

    // ─── Forms Tab ───
    const formsPageEnabled = hasFP("page", "forms");
    html += `<div class="perm-tab-content" id="perm-forms" style="display:none">
      <div class="perm-section-header">
        <h3>Form Access</h3>
        <p>Control which data entry forms this user can use</p>
        ${!formsPageEnabled ? `<div style="margin-top:8px;padding:8px 12px;background:var(--yellow-dim,rgba(255,193,7,.12));border:1px solid var(--yellow,#ffc107);border-radius:6px;font-size:11px;color:var(--yellow,#ffc107)">⚠️ The "Forms" page is currently disabled. These permissions will only apply if the page is enabled.</div>` : ""}
        <div class="perm-bulk-actions">
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-forms',true)">Enable All</button>
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-forms',false)">Disable All</button>
        </div>
      </div>
      <div class="perm-toggle-list">`;
    available.forms.forEach((f) => {
      const on = hasFP("form", f.key);
      html += `<div class="perm-toggle-row" data-cat="form" data-key="${f.key}">
        <div class="perm-toggle-info"><span class="perm-toggle-name">${f.name}</span><span class="perm-toggle-sub">Table: ${f.table}</span></div>
        <button class="perm-switch ${on ? "on" : ""}" onclick="this.classList.toggle('on')"><span class="perm-switch-knob"></span></button>
      </div>`;
    });
    html += `</div></div>`;

    // ─── Dashboard Widgets Tab ───
    const dashboardPageEnabled = hasFP("page", "dashboard");
    html += `<div class="perm-tab-content" id="perm-widgets" style="display:none">
      <div class="perm-section-header">
        <h3>Dashboard Widgets</h3>
        <p>Control which dashboard sections are visible to this user</p>
        ${!dashboardPageEnabled ? `<div style="margin-top:8px;padding:8px 12px;background:var(--yellow-dim,rgba(255,193,7,.12));border:1px solid var(--yellow,#ffc107);border-radius:6px;font-size:11px;color:var(--yellow,#ffc107)">⚠️ The "Dashboard" page is currently disabled. These widget permissions will only apply if the Dashboard page is enabled.</div>` : ""}
        <div class="perm-bulk-actions">
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-widgets',true)">Enable All</button>
          <button class="btn btn-sm" onclick="bulkTogglePerms('perm-widgets',false)">Disable All</button>
        </div>
      </div>
      <div class="perm-toggle-list">`;
    available.dashboard_widgets.forEach((w) => {
      const on = hasFP("dashboard_widget", w.key);
      html += `<div class="perm-toggle-row" data-cat="dashboard_widget" data-key="${w.key}">
        <div class="perm-toggle-info"><span class="perm-toggle-name">${w.name}</span></div>
        <button class="perm-switch ${on ? "on" : ""}" onclick="this.classList.toggle('on')"><span class="perm-switch-knob"></span></button>
      </div>`;
    });
    html += `</div></div>`;

    // Save button
    html += `<div style="margin-top:20px;display:flex;gap:12px">
      <button class="btn btn-primary" onclick="saveAllPermissions(${userId})">💾 Save All Permissions</button>
      <button class="btn btn-sm" onclick="renderUsersView()">Cancel</button>
    </div>`;

    content.innerHTML = html;
  } catch (err) {
    toast(err.message, "error");
  }
}

function switchPermTab(btn, tabId) {
  document
    .querySelectorAll(".perm-tab")
    .forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  document
    .querySelectorAll(".perm-tab-content")
    .forEach((c) => (c.style.display = "none"));
  document.getElementById(tabId).style.display = "";
}

function bulkTogglePerms(tabId, enable) {
  document.querySelectorAll(`#${tabId} .perm-switch`).forEach((btn) => {
    if (enable) btn.classList.add("on");
    else btn.classList.remove("on");
  });
}

async function saveAllPermissions(userId) {
  const saveBtn = document.querySelector(
    '.btn-primary[onclick*="saveAllPermissions"]',
  );
  const originalText = saveBtn?.textContent;
  try {
    if (saveBtn) {
      saveBtn.textContent = "⏳ Saving...";
      saveBtn.disabled = true;
    }

    // Save table permissions (parallel for speed)
    const cards = document.querySelectorAll(".perm-card");
    const tablePromises = [];
    for (const card of cards) {
      const table_name = card.dataset.table;
      const can_view = card
        .querySelector('[data-perm="can_view"]')
        .classList.contains("on")
        ? 1
        : 0;
      const can_create = card
        .querySelector('[data-perm="can_create"]')
        .classList.contains("on")
        ? 1
        : 0;
      const can_edit = card
        .querySelector('[data-perm="can_edit"]')
        .classList.contains("on")
        ? 1
        : 0;
      const can_delete = card
        .querySelector('[data-perm="can_delete"]')
        .classList.contains("on")
        ? 1
        : 0;
      tablePromises.push(
        api("/api/permissions", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            table_name,
            can_view,
            can_create,
            can_edit,
            can_delete,
          }),
        }),
      );
    }
    await Promise.all(tablePromises);

    // Save feature permissions (pages, queries, reports, forms, widgets)
    const features = [];
    document.querySelectorAll(".perm-toggle-row").forEach((row) => {
      features.push({
        feature_category: row.dataset.cat,
        feature_key: row.dataset.key,
        is_allowed: row.querySelector(".perm-switch").classList.contains("on")
          ? 1
          : 0,
      });
    });
    await api("/api/feature-permissions/bulk", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, features }),
    });

    toast("All permissions saved successfully", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.textContent = originalText || "💾 Save All Permissions";
      saveBtn.disabled = false;
    }
  }
}
