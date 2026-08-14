import { firebaseConfig } from './shared-firebase-config.js';
import * as perms from './permissions.js';

/**
 * Noorani Cargo Enterprise | Robust API Bridge
 * Version: 2.9.0
 */

const getApiBase = () => {
    // 1. Manual override
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('api')) return urlParams.get('api');

    const h = window.location.hostname;
    const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(h) || h.startsWith('192.168.') || h.startsWith('10.');

    // 2. Production detection
    if (!isLocal || h.includes('firebaseapp.com') || h.includes('web.app')) {
        return 'https://noorani-cargo-api.onrender.com/api';
    }

    // 3. Local fallback (Primary port 10000)
    return `http://${h || 'localhost'}:10000/api`;
};

const API_BASE = getApiBase();
console.log(`%c[Noorani System] Gateway: ${API_BASE}`, 'background: #111; color: #d4af37; font-weight: bold; padding: 4px;');

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
        if (!firebaseApp) firebaseApp = initializeApp(firebaseConfig);
        if (!firebaseAuth) {
            firebaseAuth = getAuth(firebaseApp);
            onAuthStateChanged(firebaseAuth, (user) => {
                window.nooraniAdminUser = user;
                authInitialized = true;
                while(authReadyQueue.length) authReadyQueue.shift()(user);
                window.dispatchEvent(new CustomEvent('noorani:admin-auth-state', { detail: { user } }));
            });
        }
        return firebaseAuth;
    } catch (err) {
        console.error('[Firebase] Init Failed', err);
        throw new Error('Security Shield Error: Authentication service unavailable.');
    }
}

async function apiFetch(endpoint, options = {}) {
    const cleanBase = API_BASE.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const url = `${cleanBase}/${cleanEndpoint}`;

    try {
        const response = await fetch(url, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, options));

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            // Extract the most descriptive error message possible
            let msg = body.message || body.error || `HTTP ${response.status}`;
            if (response.status === 404) msg = `Endpoint not found at ${url}. Check API deployment.`;
            throw new Error(msg);
        }
        return body;
    } catch (err) {
        console.error(`%c[Gateway Failure] ${endpoint}`, 'color: #ff4444; font-weight: bold;', err);
        if (err.message.includes('Failed to fetch')) {
             throw new Error(`API Offline: Unable to reach ${API_BASE}. Ensure backend is active.`);
        }
        throw err;
    }
}

export const nooraniDb = {
    isReady: true,
    waitForReady: () => new Promise(resolve => {
        if (authInitialized) resolve(true);
        else { getAuthInstance().then(() => authReadyQueue.push(() => resolve(true))).catch(() => resolve(false)); }
    }),

    // Auth
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
        const auth = await getAuthInstance();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        onAuthStateChanged(auth, cb);
        if (authInitialized) cb(window.nooraniAdminUser);
    },
    getCurrentAdminProfile: async () => {
        const user = window.nooraniAdminUser;
        if (!user) return null;
        try {
            const profile = await apiFetch(`/users/profile/${user.email}`);
            return { uid: String(profile.id), email: profile.email, role: profile.role || 'employee', status: profile.status || 'enabled' };
        } catch (e) { return { uid: user.uid, email: user.email, role: 'admin', status: 'enabled' }; }
    },
    profileHasPermission: perms.profileHasPermission,
    roleLabel: perms.roleLabel,

    // Core Shipments
    saveShipment: (id, data) => apiFetch(`/shipments/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteShipment: (id) => apiFetch(`/shipments/${id}`, { method: 'DELETE' }),
    getShipmentBySerial: (id) => apiFetch(`/shipments/${id}`),
    getShipmentHistory: (id) => apiFetch(`/shipments/${id}/history`),
    bulkImportShipments: (items) => apiFetch('/shipments/bulk/import', {
        method: 'POST',
        body: JSON.stringify({ items })
    }),
    bulkUpdateStatus: (ids, status, remarks) => apiFetch('/shipments/bulk/status', {
        method: 'POST',
        body: JSON.stringify({ ids, status, remarks, actorEmail: window.nooraniAdminUser?.email })
    }),
    queryShipments: (o = {}) => {
        // Clean filters to avoid empty param pollution
        const clean = {};
        for(const [k,v] of Object.entries(o)) { if(v !== '' && v !== null && v !== undefined) clean[k] = v; }
        const params = new URLSearchParams(clean).toString();
        return apiFetch(`/shipments${params ? `?${params}` : ''}`);
    },

    // Legacy Support
    saveSwb: (id, data) => apiFetch(`/shipments/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    getSwbBySerial: (id) => apiFetch(`/shipments/${id}`),

    // Extensions
    getManifests: () => apiFetch('/manifests'),
    saveManifest: (d) => apiFetch('/manifests', { method: 'POST', body: JSON.stringify(d) }),
    getUserAccounts: () => apiFetch('/users'),
    saveUserAccount: (d) => apiFetch('/users', { method: 'POST', body: JSON.stringify(d) }),
    deleteUserAccount: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    getDashboardStats: () => apiFetch('/stats/dashboard')
};

getAuthInstance().catch(console.error);
window.nooraniDb = nooraniDb;
