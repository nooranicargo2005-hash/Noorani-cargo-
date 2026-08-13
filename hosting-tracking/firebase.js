/**
 * Noorani Cargo | Public SWB Tracking API Bridge
 */

const getApiBase = () => {
    const h = window.location.hostname;
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(h);
    if (isLocal) return `http://${h}:10000/api`;
    return 'https://noorani-cargo-api.onrender.com/api';
};

const API_BASE = getApiBase();

async function apiFetch(endpoint) {
    const cleanBase = API_BASE.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const url = `${cleanBase}/${cleanEndpoint}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('API Request failed');
    return response.json();
}

export async function getSwbBySerial(id) {
    try {
        return await apiFetch(`/swbs/${id}`);
    } catch (e) {
        return null;
    }
}

export async function getSwbHistory(id) {
    try {
        return await apiFetch(`/swbs/${id}/history`);
    } catch (e) {
        return [];
    }
}

window.nooraniDb = { getSwbBySerial, getSwbHistory };
