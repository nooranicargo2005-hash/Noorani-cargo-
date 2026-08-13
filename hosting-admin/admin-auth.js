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
    authOverlay.style.cssText = 'position:fixed; inset:0; z-index:12000; display:flex; align-items:center; justify-content:center; background:#000; background-image:radial-gradient(circle at 100% 0%, rgba(244, 180, 0, 0.08) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(56, 189, 248, 0.05) 0%, transparent 40%);';
    authOverlay.hidden = true;
    authOverlay.style.display = 'none';
    authOverlay.innerHTML = `<div class="n-card" style="text-align:center;"><h2 class="text-gold">VERIFYING SESSION</h2><p class="text-muted mt-20">Synchronizing secure credentials...</p></div>`;
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
        <div class="splash-logo"><i class="fa-solid fa-shipping-fast"></i></div>
        <h1 class="splash-title">NOORANI CARGO</h1>
        <p class="splash-tagline">Management System</p>
        <p class="splash-status mt-20" style="font-size:0.75rem; font-weight:800; color:var(--n-gold); text-transform:uppercase; letter-spacing:2px;"></p>
      </div>
    `;
    document.body.appendChild(splashOverlay);
  }
  return splashOverlay;
}

function showSplash(message) {
  const overlay = createSplashOverlay();
  const status = overlay.querySelector('.splash-status');
  if (status) status.textContent = String(message || 'Initializing NOORANI CARGO...');
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
    <div class="n-card auth-card" style="width:100%; max-width:440px; text-align:center; border-color:var(--n-border-accent);">
      <div class="kpi-icon" style="width:80px; height:80px; margin:0 auto 32px; font-size:2rem; border-radius:20px;"><i class="fa-solid fa-shield-halved"></i></div>
      <h2 style="font-size:2rem; margin-bottom:12px; letter-spacing:-1px;">Secure Access</h2>
      <p class="text-muted" style="margin-bottom:40px;">Authenticated session required for network management.</p>
      <form id="adminAuthForm" style="display:grid; gap:20px; text-align:left;">
        <div style="display:grid; gap:8px;">
            <label for="admin-email" style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--n-low); margin-left:4px;">Corporate Email</label>
            <input id="admin-email" name="email" type="email" placeholder="email@nooranicargo.com" required class="n-input">
        </div>
        <div style="display:grid; gap:8px;">
            <label for="admin-password" style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--n-low); margin-left:4px;">Access Token</label>
            <input id="admin-password" name="password" type="password" placeholder="••••••••" required class="n-input">
        </div>
        <button type="submit" class="n-btn primary" style="width:100%; justify-content:center; padding:18px; margin-top:12px; font-size:1rem;">Authorize Session</button>
      </form>
      <p id="adminAuthStatus" style="margin-top:24px; font-size:0.85rem; font-weight:700; color:var(--n-danger); text-transform:uppercase; letter-spacing:1px;"></p>
      <div style="margin-top:40px; padding-top:32px; border-top:1px solid var(--n-border);">
          <strong style="color:var(--n-gold); letter-spacing:4px; font-size:0.9rem; text-transform:uppercase; font-family:var(--font-header);">NOORANI CARGO SERVICES</strong>
      </div>
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
