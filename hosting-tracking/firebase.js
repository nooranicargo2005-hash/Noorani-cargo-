/**
 * Noorani Cargo | Public Tracking API Bridge
 * Standardized: 2026-08-14
 */

const getApiBase = () => {
    const h = window.location.hostname;
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(h);
    if (isLocal) return `http://${h}:10000/api`;
    return 'https://noorani-cargo-api.onrender.com/api';
};

const API_BASE = getApiBase();

/**
 * Generic fetch wrapper for public tracking calls.
 */
async function apiFetch(endpoint) {
    const cleanBase = API_BASE.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const url = `${cleanBase}/${cleanEndpoint}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Tracking service unavailable');
    return response.json();
}

/**
 * Retrieves a shipment record for public tracking.
 */
export async function getShipmentBySerial(id) {
    try {
        const res = await apiFetch(`/tracking/${id}`);
        return res;
    } catch (e) {
        return null;
    }
}

/**
 * Retrieves shipment history for public tracking.
 */
export async function getShipmentHistory(id) {
    try {
        const res = await apiFetch(`/tracking/${id}`);
        return res.history || [];
    } catch (e) {
        return [];
    }
}

// Legacy Aliases for compatibility
export const getSwbBySerial = getShipmentBySerial;
export const getSwbHistory = getShipmentHistory;

window.nooraniTracking = { getShipmentBySerial, getShipmentHistory };
