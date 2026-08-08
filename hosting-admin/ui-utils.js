// UI utilities: non-blocking alerts/toasts and safe HTML escape helpers
(function(){
  if (window.__noorani_ui_utils_installed) return; window.__noorani_ui_utils_installed = true;
  function escapeHtmlSimple(value){
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":"&#39;"}[c]));
  }
  function normalizeTrackingCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  const container = document.createElement('div'); container.id = 'noorani-toast-container'; document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));

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