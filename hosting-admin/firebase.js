import { firebaseConfig } from './shared-firebase-config.js';
import * as perms from './permissions.js';

/**
 * Noorani Cargo Enterprise | Unified API Bridge & Firebase Controller
 * Environment-aware connector for SQLite REST Backend.
 * Version: 2026-08-08 v10 (Production Resilience)
 */

// --- API Configuration ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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
            getAuthInstance().catch(console.error);
            authReadyQueue.push(() => resolve(true));
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
        const auth = await getAuthInstance();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        onAuthStateChanged(auth, cb);
        // If already initialized, call back immediately with current state
        if (authInitialized) cb(window.nooraniAdminUser);
    },

    // --- Profile & Access Control ---
    getCurrentAdminUser: () => window.nooraniAdminUser || null,
    getCurrentAdminProfile: async () => {
        const user = window.nooraniAdminUser;
        return {
            uid: user?.uid || 'admin',
            email: user?.email || 'admin@nooranicargo.com',
            role: 'superadmin',
            status: 'enabled',
            permissions: {}
        };
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
    saveShipmentNote: (id, content) => apiFetch(`/shipments/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
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

    // --- Operations & Fleet ---
    saveCustomer: (d) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(d) }),
    queryCustomers: (o = {}) => apiFetch(`/customers?${new URLSearchParams(o).toString()}`),
    getCustomerDetails: (id) => apiFetch(`/customers/${id}`),
    deleteCustomer: (id) => apiFetch(`/customers/${id}`, { method: 'DELETE' }),

    saveDriver: (d) => apiFetch('/drivers', { method: 'POST', body: JSON.stringify(d) }),
    queryDrivers: () => apiFetch('/drivers'),
    getDriverDetails: (id) => apiFetch(`/drivers/${id}`),
    deleteDriver: (id) => apiFetch(`/drivers/${id}`, { method: 'DELETE' }),

    saveVehicle: (d) => apiFetch('/vehicles', { method: 'POST', body: JSON.stringify(d) }),
    queryVehicles: () => apiFetch('/vehicles'),
    getVehicleDetails: (id) => apiFetch(`/vehicles/${id}`),
    deleteVehicle: (id) => apiFetch(`/vehicles/${id}`, { method: 'DELETE' }),

    saveBranch: (d) => apiFetch('/branches', { method: 'POST', body: JSON.stringify(d) }),
    queryBranches: () => apiFetch('/branches'),
    getBranchDetails: (id) => apiFetch(`/branches/${id}`),
    deleteBranch: (id) => apiFetch(`/branches/${id}`, { method: 'DELETE' }),

    saveEmployee: (d) => apiFetch('/employees', { method: 'POST', body: JSON.stringify(d) }),
    queryEmployees: () => apiFetch('/employees'),
    getEmployeeDetails: (id) => apiFetch(`/employees/${id}`),
    deleteEmployee: (id) => apiFetch(`/employees/${id}`, { method: 'DELETE' }),

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
        const poll = async () => { try { const res = await apiFetch('/notifications'); cb(res); } catch (e) {} };
        poll(); const itv = setInterval(poll, 10000); return () => clearInterval(itv);
    },
    clearNotifications: () => apiFetch('/notifications', { method: 'DELETE' }),
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
