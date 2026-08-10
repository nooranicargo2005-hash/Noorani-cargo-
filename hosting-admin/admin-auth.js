import {
  signInAdmin,
  signOutAdmin,
  watchAdminAuth
} from './firebase.js';

/**
 * Noorani Cargo | Admin Authentication Controller
 * Enforces production-grade session management.
 */

const AUTH_STATE_EVENT = 'noorani:admin-auth-state';
let authOverlay = null;
let splashOverlay = null;
let currentUser = null;
let authStateResolved = false;
let authCheckTimeout = null;
let splashStartTime = 0;
const AUTH_CHECK_TIMEOUT_MS = 10000; // Increased for slow production cold-starts
const MIN_SPLASH_DURATION_MS = 1500;

function createAuthOverlay() {
  if (authOverlay) return authOverlay;
  authOverlay = document.getElementById('adminAuthOverlay');
  if (!authOverlay) {
    authOverlay = document.createElement('div');
    authOverlay.id = 'adminAuthOverlay';
    authOverlay.className = 'admin-auth-overlay';
    authOverlay.hidden = true;
    authOverlay.style.display = 'none';
    authOverlay.innerHTML = `<div class="admin-auth-card"><h2>Checking session...</h2><p id="adminAuthStatus" class="admin-auth-status">Please wait while we verify your access.</p></div>`;
    document.body.appendChild(authOverlay);
  }
  return authOverlay;
}

function createSplashOverlay() {
  if (splashOverlay) return splashOverlay;
  splashOverlay = document.getElementById('nooraniSplashOverlay');
  if (!splashOverlay) {
    splashOverlay = document.createElement('div');
    splashOverlay.id = 'nooraniSplashOverlay';
    splashOverlay.className = 'noorani-splash-screen';
    splashOverlay.innerHTML = `
      <div class="noorani-splash-card">
        <div class="splash-logo"><div class="splash-icon"><i class="fa-solid fa-shipping-fast"></i></div></div>
        <h1 class="splash-title">Noorani Cargo Admin</h1>
        <p class="splash-tagline">Loading secure management console...</p>
        <div class="splash-status">Establishing connection...</div>
      </div>
    `;
    document.body.appendChild(splashOverlay);
  }
  return splashOverlay;
}

function showSplash(message) {
  const overlay = createSplashOverlay();
  const status = overlay.querySelector('.splash-status');
  if (status) status.textContent = String(message || 'Initializing Noorani Admin...');
  overlay.hidden = false;
  overlay.style.display = 'grid';
  splashStartTime = Date.now();
}

function hideSplash() {
  if (!splashOverlay) return;
  splashOverlay.hidden = true;
  splashOverlay.style.display = 'none';
}

function authFormMarkup() {
  return `
    <div class="admin-auth-card">
      <h2>Admin Access</h2>
      <p>Sign in to manage the global Noorani network.</p>
      <form id="adminAuthForm" class="admin-auth-form">
        <input name="email" type="email" placeholder="Email" required class="admin-auth-input">
        <input name="password" type="password" placeholder="Password" required class="admin-auth-input">
        <button type="submit" class="btn-primary-action">Sign In</button>
      </form>
      <p id="adminAuthStatus" class="admin-auth-status"></p>
    </div>
  `;
}

function notifyAuthState(user) {
  if (authCheckTimeout) { clearTimeout(authCheckTimeout); authCheckTimeout = null; }
  currentUser = user || null;
  authStateResolved = true;

  const emailEl = document.getElementById('adminUserEmail');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const sidebar = document.getElementById('adminSidebar');

  if (user) {
    if (emailEl) { emailEl.textContent = user.email; emailEl.style.display = 'inline-flex'; }
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (sidebar) sidebar.hidden = false;
    hideLogin();
  } else {
    if (emailEl) emailEl.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (sidebar) sidebar.hidden = true;
    showLogin();
  }

  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: { user: currentUser } }));
}

function ensureLoginForm() {
  const overlay = createAuthOverlay();
  if (overlay.dataset.loginRendered === 'true') return overlay;
  overlay.innerHTML = authFormMarkup();
  const form = overlay.querySelector('#adminAuthForm');
  const status = overlay.querySelector('#adminAuthStatus');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Authenticating...';
    try {
      await signInAdmin(form.elements.email.value, form.elements.password.value);
      status.textContent = '';
    } catch (error) {
      console.error('[Auth] Error:', error);
      status.textContent = error.message || 'Invalid credentials.';
    }
  });
  overlay.dataset.loginRendered = 'true';
  return overlay;
}

function showLogin() {
  hideSplash();
  const overlay = ensureLoginForm();
  overlay.hidden = false;
  overlay.style.display = 'flex';
}

function hideLogin() {
  if (authOverlay) { authOverlay.hidden = true; authOverlay.style.display = 'none'; }
}

export async function signOutAdminFromUi() {
  await signOutAdmin();
  window.location.reload();
}

window.signOutAdminFromUi = signOutAdminFromUi;

async function init() {
  showSplash();

  // Timeout for initial connection
  authCheckTimeout = setTimeout(() => {
    if (!authStateResolved) {
        console.warn('[Auth] Initialization timed out. Showing login.');
        showLogin();
    }
  }, AUTH_CHECK_TIMEOUT_MS);

  try {
    watchAdminAuth(async (user) => {
      const elapsed = Date.now() - splashStartTime;
      const delay = Math.max(0, MIN_SPLASH_DURATION_MS - elapsed);

      setTimeout(() => {
          hideSplash();
          notifyAuthState(user);
      }, delay);
    });
  } catch (err) {
    console.error('[Auth] Watch failed:', err);
    hideSplash();
    showLogin();
  }
}

init();
