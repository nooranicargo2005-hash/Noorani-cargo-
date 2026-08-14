/**
 * Noorani Cargo | UI Utilities
 */

/**
 * Normalizes a tracking number / serial for consistency.
 */
function normalizeTrackingNo(value) {
    if (!value) return '';
    return String(value).trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * Formats currency values in USD.
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

/**
 * Formats dates for display.
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

/**
 * Truncates long text with an ellipsis.
 */
function truncateText(str, len = 20) {
    if (!str || str.length <= len) return str || '';
    return str.substring(0, len) + '...';
}

/**
 * Copies text to the clipboard and shows a brief notification if available.
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy', err);
        return false;
    }
}

/**
 * Formats file sizes for display.
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global Exports
window.nooraniUtils = { normalizeTrackingNo, formatCurrency, formatDate, truncateText, copyToClipboard, formatSize };
// Legacy Alias
window.normalizeSwbSerial = normalizeTrackingNo;
