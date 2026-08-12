// UI utilities: non-blocking alerts/toasts and safe HTML escape helpers
(function(){
  if (window.__noorani_ui_utils_installed) return; window.__noorani_ui_utils_installed = true;
  function escapeHtmlSimple(value){
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":"&#39;"}[c]));
  }
  function normalizeTrackingCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  function cleanDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof v === 'number') {
        try {
            const date = new Date(Math.round((v - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        } catch (e) {}
    }
    const str = String(v).trim();
    if (!str || str.length < 5) return null;
    const numericMatch = str.match(/(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
    if (numericMatch) {
        let p1 = numericMatch[1], p2 = numericMatch[2], p3 = numericMatch[3];
        let y, m, d;
        if (p1.length === 4) { y = p1; m = p2; d = p3; }
        else {
            y = p3.length === 2 ? "20" + p3 : p3;
            let v1 = parseInt(p1, 10), v2 = parseInt(p2, 10);
            if (v1 > 12) { d = v1; m = v2; }
            else if (v2 > 12) { m = v1; d = v2; }
            else { d = v1; m = v2; }
        }
        if (y && m && d && y.length === 4) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
        const date = new Date(parsed);
        if (date.getFullYear() > 2000) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
    }
    return null;
  }

  const container = document.createElement('div');
 container.id = 'noorani-toast-container'; document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));

  function showToast(message, opts){
    opts = opts || {};
    const el = document.createElement('div'); el.className = 'noorani-toast' + (opts.warn ? ' noorani-toast--warn' : '');
    el.innerHTML = escapeHtmlSimple(typeof message === 'string' ? message : JSON.stringify(message));
    if (opts.actions && Array.isArray(opts.actions)){
      const actions = document.createElement('div'); actions.className = 'noorani-toast-actions';
      opts.actions.forEach(a => { const b = document.createElement('button'); b.textContent = a.label; b.addEventListener('click', () => { try{ a.onClick && a.onClick(); } catch(e){console.error(e);} if (!a.sticky) el.remove(); }); actions.appendChild(b); });
      el.appendChild(actions);
    }
    // ensure container present
    if (!document.body.contains(container)) document.body.appendChild(container);
    container.appendChild(el);
    if (!opts.sticky) setTimeout(()=>{ try{ el.remove(); } catch(e){} }, opts.duration || 4500);
    return el;
  }

  window.safeAlert = function(msg, opts){ return showToast(msg, opts); };
  try{ window.alert = window.safeAlert; } catch(e) { /* ignore */ }

  // Programmatic confirm (non-blocking). Callback-based
  window.safeConfirm = function(message, onConfirm, onCancel, opts){
    opts = opts || {}; const el = showToast(message, { sticky: true, warn: !!opts.warn });
    const actions = el.querySelector('.noorani-toast-actions') || (()=>{ const d=document.createElement('div'); d.className='noorani-toast-actions'; el.appendChild(d); return d; })();
    actions.innerHTML = '';
    const btnYes = document.createElement('button'); btnYes.textContent = opts.confirmLabel || 'Confirm';
    const btnNo = document.createElement('button'); btnNo.textContent = opts.cancelLabel || 'Cancel';
    btnYes.addEventListener('click', () => { try{ onConfirm && onConfirm(); } finally { el.remove(); } });
    btnNo.addEventListener('click', () => { try{ onCancel && onCancel(); } finally { el.remove(); } });
    actions.appendChild(btnNo); actions.appendChild(btnYes);
    return el;
  };

  if (!window.escapeHtml) window.escapeHtml = escapeHtmlSimple;
  if (!window.normalizeTrackingCode) window.normalizeTrackingCode = normalizeTrackingCode;
})();