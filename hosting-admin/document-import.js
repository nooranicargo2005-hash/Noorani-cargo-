import { nooraniDb } from './firebase.js';

/**
 * Noorani Cargo Enterprise | Data Import Engine
 * Optimized for local SQLite synchronization with automatic field mapping.
 * Version: 2026-08-08 v12 (Production Ready | Precise Extraction)
 */

(function () {
  'use strict';

  // Constants for pattern matching (Logistics parsing)
  const patterns = {
    // Tracking IDs: NC, NB, NM, NCS, NJ followed by numbers
    tracking: /\b(NC|NB|NM|NCS|NJ)[-/]?\d+\b/gi,

    // Dates: Support M/D/YYYY, MM/DD/YYYY, YYYY-MM-DD
    date: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b|\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,

    // Measurements
    weight: /\b(\d+(?:\.\d+)?)\s*(?:KG|KILOGRAMS|KGS)\b/i,
    quantity: /\b(\d+)\s*(?:PCS|PIECES|QTY|QUANTITY)\b/i,

    // Financials
    payment: /\b(PAID|UNPAID|PARTIAL|COLLECT|CASH|CREDIT)\b/i,
    invoice: /\b(?:INV|INV-|INVOICE|Manifest|REF)[:\s]*([A-Z0-9_-]+)\b/i,

    // Logistics
    service: /\b(AIR FREIGHT|SEA FREIGHT|LAND TRANSPORT|EXPRESS|AIR|SEA|LAND)\b/i,

    // Contact Info (Heuristic)
    phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}\b/g
  };

  const getDb = () => nooraniDb || window.nooraniDb;

  function normalizeTracking(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  /**
   * Converts various date formats to ISO YYYY-MM-DD
   */
  function parsePdfDate(raw) {
    if (!raw) return null;
    const parts = raw.split(/[-/]/);
    if (parts.length !== 3) return null;

    let m, d, y;
    if (parts[0].length === 4) { // YYYY-MM-DD
      y = parts[0]; m = parts[1]; d = parts[2];
    } else { // M/D/YYYY
      m = parts[0]; d = parts[1]; y = parts[2];
      if (y.length === 2) y = "20" + y;
      if (parseInt(m) > 12) { const t = m; m = d; d = t; } // D/M/YYYY fallback
    }

    if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function loadScript(url, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url; script.async = true;
      script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error(`Unable to load ${globalName}`));
      script.onerror = () => reject(new Error(`Network error loading ${globalName}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Extracts data from a single line of text
   */
  function extractFieldsFromLine(text) {
    const data = {
      status: 'Picked Up',
      source: 'pdf',
      public: true,
      author: 'PDF Import'
    };

    // 1. Extract Tracking
    const trackMatch = text.match(patterns.tracking);
    if (!trackMatch) return null;
    data.trackingId = normalizeTracking(trackMatch[0]);

    // 2. Extract Date
    const dateMatches = text.match(patterns.date);
    if (dateMatches) data.date = parsePdfDate(dateMatches[0]);

    // 3. Extract Weight
    const weightMatch = text.match(patterns.weight);
    if (weightMatch) data.weight = parseFloat(weightMatch[1]);

    // 4. Extract Quantity
    const qtyMatch = text.match(patterns.quantity);
    if (qtyMatch) data.quantity = parseInt(qtyMatch[1]);

    // 5. Extract Payment Status
    const payMatch = text.match(patterns.payment);
    if (payMatch) data.paymentStatus = payMatch[1].charAt(0).toUpperCase() + payMatch[1].slice(1).toLowerCase();

    // 6. Extract Service Type
    const svcMatch = text.match(patterns.service);
    if (svcMatch) data.shipmentType = svcMatch[1].toUpperCase();

    // 7. Extract Invoice / Reference
    const invMatch = text.match(patterns.invoice);
    if (invMatch) data.ref = invMatch[1];

    // 8. Extract Phones
    const phoneMatches = text.match(patterns.phone);
    if (phoneMatches) {
        if (phoneMatches[0]) data.senderPhone = phoneMatches[0];
        if (phoneMatches[1]) data.receiverPhone = phoneMatches[1];
    }

    // 9. Extract Names & Address (Heuristic segments)
    // Remove the patterns already matched to isolate names/address
    let clean = text.replace(patterns.tracking, '').replace(patterns.date, '').replace(patterns.phone, '').replace(patterns.weight, '').replace(patterns.quantity, '').replace(patterns.invoice, '');
    const segments = clean.split(/\s{3,}/).map(s => s.trim()).filter(s => s.length > 2);

    if (segments[0]) data.sender = segments[0];
    if (segments[1]) data.receiver = segments[1];
    if (segments[2]) data.receiverAddress = segments[2];
    if (segments[3]) data.destination = segments[3];

    return data;
  }

  async function parsePdf(file) {
    console.log('[Import] Processing Manifest:', file.name);
    const pdfjsLib = await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const shipments = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const rows = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!rows[y]) rows[y] = [];
        rows[y].push(item);
      });
      const sortedY = Object.keys(rows).sort((a, b) => b - a);
      sortedY.forEach(y => {
        const lineText = rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ');
        const record = extractFieldsFromLine(lineText);
        if (record && record.trackingId) shipments.push({ tracking: record.trackingId, data: record });
      });
    }
    return shipments;
  }

  async function parseExcel(file) {
    const XLSX = await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
    const workbook = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    return rows.map(r => {
      const id = normalizeTracking(r.Tracking || r.ID || r['Tracking #'] || r['Tracking Number']);
      let sDate = r.Date || r.shipmentDate || r['Shipment Date'];
      if (typeof sDate === 'number') sDate = new Date((sDate - 25569) * 86400 * 1000).toISOString().split('T')[0];

      return {
        tracking: id,
        data: {
          trackingId: id, date: sDate || null, status: r.Status || 'Pending',
          sender: r.Sender || r['Sender Name'] || '', senderPhone: r.SenderPhone || '',
          receiver: r.Receiver || r.Consignee || '', receiverPhone: r.ReceiverPhone || '',
          receiverAddress: r.Address || r['Delivery Address'] || '',
          destination: r.Destination || r['Destination City'] || '',
          weight: r.Weight || 0, quantity: r.Quantity || r.Pieces || 1,
          shippingCost: r.Cost || 0, paymentStatus: r.Payment || 'Unpaid',
          shipmentType: r.Service || 'Air Freight', source: 'excel', public: true, author: 'Excel Import'
        }
      };
    }).filter(s => s.tracking);
  }

  async function handleImport(file, type) {
    const statusEl = document.getElementById('importStatus');
    const setStatus = (msg, isErr = false) => {
        if (statusEl) {
            statusEl.style.display = 'block'; statusEl.textContent = msg;
            statusEl.style.color = isErr ? '#fca5a5' : '#ffd34e';
        }
    };

    try {
      const db = getDb(); if (!db) throw new Error('System bridge not ready.');
      setStatus(`Parsing ${type.toUpperCase()}...`);
      const shipments = type === 'pdf' ? await parsePdf(file) : await parseExcel(file);

      if (!shipments.length) { setStatus('No valid tracking codes found.', true); return; }

      let success = 0, failed = 0, duplicates = 0, missingFields = 0;
      setStatus(`Syncing ${shipments.length} records...`);

      // Dupe prevention logic
      const existingIds = (typeof enterpriseAdminState !== 'undefined') ? enterpriseAdminState.currentItems.map(x => x.trackingId) : [];

      for (const s of shipments) {
          try {
              if (existingIds.includes(s.tracking)) { duplicates++; continue; }
              const d = s.data;
              if (!d.date || !d.sender || !d.receiver) missingFields++;
              await db.saveShipment(s.tracking, d);
              success++;
          } catch (e) {
              console.error(`[Import] Sync Error: ${s.tracking}`, e);
              failed++;
          }
      }

      const summary = `Result: ${success} Synced | ${duplicates} Dupes Skipped | ${failed} Failed | ${missingFields} Uncertain.`;
      setStatus(summary);
      console.log('[Import] Summary:', summary);

      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 15000);
      if (typeof window.loadDashboard === 'function') window.loadDashboard();

    } catch (error) {
      console.error('[Import] Fatal Error:', error);
      setStatus('System Error: ' + error.message, true);
    }
  }

  function initialize() {
    const pdfIn = document.getElementById('pdfImportInput');
    let xlsIn = document.getElementById('excelImportInput');
    if (!xlsIn) {
        xlsIn = document.createElement('input');
        xlsIn.type = 'file'; xlsIn.id = 'excelImportInput'; xlsIn.accept = '.xlsx, .xls'; xlsIn.hidden = true;
        document.body.appendChild(xlsIn);
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, a');
        if (!btn) return;
        if (btn.id === 'pdfImportBtn' || btn.innerHTML.includes('fa-file-import')) {
            if (pdfIn) { e.preventDefault(); e.stopPropagation(); pdfIn.click(); }
        }
        if (btn.id === 'excelImportBtn' || btn.id === 'dashXlsBtn') {
            if (xlsIn) { e.preventDefault(); e.stopPropagation(); xlsIn.click(); }
        }
    });

    if (pdfIn) pdfIn.onchange = () => pdfIn.files[0] && handleImport(pdfIn.files[0], 'pdf');
    if (xlsIn) xlsIn.onchange = () => xlsIn.files[0] && handleImport(xlsIn.files[0], 'excel');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
