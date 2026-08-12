import { firebaseConfig } from './shared-firebase-config.js';
import * as perms from './permissions.js';

/**
 * Noorani Cargo Enterprise | Unified API Bridge & Firebase Controller
 * Environment-aware connector for Supabase REST Backend.
 * Version: 2026-08-08 v10 (Production Resilience)
 */

// --- API Configuration ---
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

// PRODUCTION API URL - IMPORTANT: Ensure your Render service name matches this!
const PROD_API_URL = 'https://noorani-cargo-api.onrender.com/api';

const urlParams = new URLSearchParams(window.location.search);
const API_BASE = urlParams.get('api') || (isLocal ? 'http://127.0.0.1:3000/api' : PROD_API_URL);

console.log(`%c[Noorani System] Connected to API: ${API_BASE}`, 'background: #222; color: #bada55; font-weight: bold; padding: 4px;');

// --- Firebase SDK Dynamic Loader ---
let firebaseApp = null;
let firebaseAuth = null;
let authInitialized = false;
const authReadyQueue = [];

async function getAuthInstance() {
    if (firebaseAuth) return firebaseAuth;

    try {
        const sdkBase = 'https://www.gstatic.com/firebasejs/10.7.1';
        const { initializeApp } = await import(`${sdkBase}/firebase-app.js`);
        const { getAuth, onAuthStateChanged } = await import(`${sdkBase}/firebase-auth.js`);

        if (!firebaseApp) {
            console.log('[Firebase] Initializing Project:', firebaseConfig.projectId);
            firebaseApp = initializeApp(firebaseConfig);
        }

        if (!firebaseAuth) {
            firebaseAuth = getAuth(firebaseApp);
            onAuthStateChanged(firebaseAuth, (user) => {
                console.log('[Firebase] Auth State Changed:', user ? user.email : 'No session');
                window.nooraniAdminUser = user;
                authInitialized = true;
                // Drain queue
                while(authReadyQueue.length) {
                    const resolve = authReadyQueue.shift();
                    resolve(user);
                }
                // Notify system via event
                window.dispatchEvent(new CustomEvent('noorani:admin-auth-state', { detail: { user } }));
            });
        }

        return firebaseAuth;
    } catch (err) {
        console.error('[Firebase] Fatal Initialization Error:', err);
        throw err;
    }
}

// REST Fetch Utility
async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, options));

        if (!response.ok) {
            let errorText = `HTTP ${response.status}`;
            try {
                const body = await response.json();
                errorText = body.error || errorText;
            } catch(e){}
            throw new Error(errorText);
        }
        return await response.json();
    } catch (err) {
        console.error(`[API Bridge] Request FAILED: ${endpoint}`, err);
        throw err;
    }
}

// Global Bridge Engine
export const nooraniDb = {
    isReady: true,
    waitForReady: () => new Promise(resolve => {
        if (authInitialized) resolve(true);
        else {
            getAuthInstance()
                .then(() => {
                    // Success case: resolve is handled by onAuthStateChanged draining the queue
                    authReadyQueue.push(() => resolve(true));
                })
                .catch(err => {
                    console.error('[Firebase] waitForReady FAILED:', err);
                    authInitialized = true; // Mark as done to prevent hangs
                    resolve(false);
                });
        }
    }),

    // --- Authentication ---
    signInAdmin: async (e, p) => {
        const auth = await getAuthInstance();
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        return signInWithEmailAndPassword(auth, e, p);
    },
    signOutAdmin: async () => {
        const auth = await getAuthInstance();
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        return signOut(auth);
    },
    watchAdminAuth: async (cb) => {
        try {
            const auth = await getAuthInstance();
            const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            onAuthStateChanged(auth, cb);
            // If already initialized, call back immediately with current state
            if (authInitialized) cb(window.nooraniAdminUser);
        } catch (err) {
            console.error('[Firebase] watchAdminAuth FAILED:', err);
            // Fallback: Notify with null user if auth system fails
            cb(null);
        }
    },

    // --- Profile & Access Control ---
    getCurrentAdminUser: () => window.nooraniAdminUser || null,
    getCurrentAdminProfile: async () => {
        const user = window.nooraniAdminUser;
        if (!user) return null;
        try {
            const profile = await apiFetch(`/users/profile/${user.email}`);
            return {
                uid: String(profile.id),
                email: profile.email,
                role: profile.role || 'employee',
                branchCode: profile.branchCode || 'HQ',
                status: profile.status || 'enabled',
                permissions: profile.permissions ? JSON.parse(profile.permissions) : {}
            };
        } catch (e) {
            console.warn('[Profile] Failed to fetch profile, using fallback:', e);
            return {
                uid: user.uid,
                email: user.email,
                role: 'admin',
                status: 'enabled',
                permissions: {}
            };
        }
    },
    profileHasPermission: perms.profileHasPermission,
    roleLabel: perms.roleLabel,
    PERMISSION_KEYS: perms.PERMISSION_KEYS,
    PERMISSION_LABELS: perms.PERMISSION_LABELS,

    // --- Logistics (REST Endpoints) ---
    saveShipment: (id, data) => apiFetch(`/shipments/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteShipment: (id) => apiFetch(`/shipments/${id}`, { method: 'DELETE' }),
    getShipmentByTracking: (id) => apiFetch(`/shipments/${id}`),
    queryShipments: (o = {}) => apiFetch(`/shipments?${new URLSearchParams(o).toString()}`),
    getDashboardStats: () => apiFetch('/stats/dashboard'),

    // --- Metadata & Assets ---
    getTimelineForShipment: (id) => apiFetch(`/shipments/${id}/timeline`),
    saveShipmentTimelineEntry: (id, data) => apiFetch(`/shipments/${id}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
    getShipmentNotesForShipment: (id) => apiFetch(`/shipments/${id}/notes`),
    saveShipmentNote: (id, data) => apiFetch(`/shipments/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    getShipmentAssetsForShipment: (id) => apiFetch(`/shipments/${id}/assets`),

    uploadShipmentDocument: async (id, file) => {
        const fd = new FormData(); fd.append('file', file); fd.append('type', 'document');
        const res = await fetch(`${API_BASE}/shipments/${id}/assets`, { method: 'POST', body: fd });
        return res.json();
    },
    uploadShipmentPhoto: async (id, file) => {
        const fd = new FormData(); fd.append('file', file); fd.append('type', 'photo');
        const res = await fetch(`${API_BASE}/shipments/${id}/assets`, { method: 'POST', body: fd });
        return res.json();
    },

    uploadManifestFile: async (file) => {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch(`${API_BASE}/manifests/upload`, { method: 'POST', body: fd });
        return res.json();
    },

    queryManifests: () => apiFetch('/manifests'),
    getManifestDownloadUrl: (filename) => `${API_BASE}/manifests/download/${filename}`,
    getManifestViewUrl: (filename) => `${API_BASE}/manifests/view/${filename}`,

    // --- Finance & System ---
    queryTransactions: (o = {}) => apiFetch(`/transactions?${new URLSearchParams(o).toString()}`),
    saveTransaction: (d) => apiFetch('/transactions', { method: 'POST', body: JSON.stringify(d) }),
    deleteTransaction: (id) => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),
    getFinanceStats: async () => {
        const s = await apiFetch('/stats/dashboard');
        return { totalRevenue: s.totalRevenue, totalExpenses: s.totalExpenses, netProfit: s.profit };
    },
    queryAuditLogs: () => apiFetch('/audit-logs'),
    watchNotifications: (uid, cb) => {
        const poll = async () => { try { const res = await apiFetch(`/notifications?uid=${uid}`); cb(res); } catch (e) {} };
        poll(); const itv = setInterval(poll, 10000); return () => clearInterval(itv);
    },
    clearNotifications: (uid) => apiFetch(`/notifications?uid=${uid}`, { method: 'DELETE' }),
    getSystemSettings: (cat) => apiFetch(`/settings/${cat}`),
    saveSystemSettings: (cat, data) => apiFetch(`/settings/${cat}`, { method: 'POST', body: JSON.stringify(data) }),
    getUserAccounts: () => apiFetch('/users'),
    saveUserAccount: (d) => apiFetch('/users', { method: 'POST', body: JSON.stringify(d) }),
    deleteUserAccount: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' })
};

// Start initialization
getAuthInstance().catch(console.error);

// Re-exports for compatibility
export const signInAdmin = nooraniDb.signInAdmin;
export const signOutAdmin = nooraniDb.signOutAdmin;
export const watchAdminAuth = nooraniDb.watchAdminAuth;

window.nooraniDb = nooraniDb;
