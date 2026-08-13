import { firebaseConfig } from './shared-firebase-config.js';
import * as perms from './permissions.js';

/**
 * Noorani Cargo Enterprise | Robust API Bridge
 */

const getApiBase = () => {
    // Check URL parameters for explicit override
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('api')) return urlParams.get('api');

    const h = window.location.hostname;
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(h);

    // If local, try to use the current hostname but port 3000
    if (isLocal) return `http://${h}:3000/api`;

    // Production Endpoint
    return 'https://noorani-cargo-api.onrender.com/api';
};

const API_BASE = getApiBase();
console.log(`%c[Noorani System] Connectivity Node: ${API_BASE}`, 'background: #111; color: #d4af37; font-weight: bold; padding: 4px;');

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
        console.error('[Firebase] Connection Failed', err);
        throw new Error('Firebase Security Shield Active: Unable to verify credentials.');
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

        if (!response.ok) {
            let errorText = `HTTP Error ${response.status}`;
            try {
                const body = await response.json();
                errorText = body.error || errorText;
            } catch(e){}
            throw new Error(errorText);
        }
        return await response.json();
    } catch (err) {
        console.error(`%c[Connectivity Failure] ${endpoint}`, 'color: #ff4444; font-weight: bold;', err);

        // Detailed troubleshooting for the user
        if (err.message.includes('Failed to fetch') || err.message === 'API Unreachable') {
            const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            const msg = isLocal
                ? 'CRITICAL: Local API server is not running. Please open a terminal in the "server" directory and run: npm start'
                : 'CRITICAL: Production API endpoint is unreachable. Please check server logs on Render.';
            throw new Error(msg);
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
    saveSwb: (id, data) => apiFetch(`/swbs/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteSwb: (id) => apiFetch(`/swbs/${id}`, { method: 'DELETE' }),
    getSwbBySerial: (id) => apiFetch(`/swbs/${id}`),
    getSwbHistory: (id) => apiFetch(`/swbs/${id}/history`),
    bulkUpdateStatus: (ids, status, remarks) => apiFetch('/swbs/bulk/status', {
        method: 'POST',
        body: JSON.stringify({ ids, status, remarks, actorEmail: window.nooraniAdminUser?.email })
    }),
    querySwbs: (o = {}) => apiFetch(`/swbs?${new URLSearchParams(o).toString()}`),
    getDashboardStats: () => apiFetch('/stats/dashboard'),
    getUserAccounts: () => apiFetch('/users'),
    saveUserAccount: (d) => apiFetch('/users', { method: 'POST', body: JSON.stringify(d) }),
    deleteUserAccount: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    getManifests: () => apiFetch('/manifests'),
    saveManifest: (d) => apiFetch('/manifests', { method: 'POST', body: JSON.stringify(d) })
};

getAuthInstance().catch(console.error);
window.nooraniDb = nooraniDb;
