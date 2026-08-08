import { firebaseConfig } from './shared-firebase-config.js';

/**
 * Noorani Cargo | Public Tracking API Bridge
 * Environment-aware connector for SQLite REST Backend.
 * Version: 2026-08-08 v8 (Production Resilience)
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PROD_API_URL = 'https://noorani-cargo-api.onrender.com/api';

const urlParams = new URLSearchParams(window.location.search);
const API_BASE = urlParams.get('api') || (isLocal ? 'http://127.0.0.1:3000/api' : PROD_API_URL);

console.log(`%c[Noorani System] Tracking Connected to: ${API_BASE}`, 'background: #222; color: #bada55; padding: 4px;');

async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, options));
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Network response was not ok' }));
            throw new Error(err.error || 'API Request failed');
        }
        return response.json();
    } catch (err) {
        console.error('[API] Fetch Error:', endpoint, err);
        throw err;
    }
}

export async function getShipmentByTracking(id) {
    try {
        return await apiFetch(`/shipments/${id}`);
    } catch (e) {
        console.warn('[Tracking] Shipment not found:', id);
        return null;
    }
}

export function watchPublicShipment(id, callback) {
    const poll = async () => {
        try {
            const res = await apiFetch(`/shipments/${id}`);
            if (res && res.data) callback(res);
        } catch (e) {}
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
}

window.nooraniDb = { getShipmentByTracking, watchPublicShipment };
