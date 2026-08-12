/**
 * Noorani Cargo Enterprise | Multi-Page Engine
 * Optimized for strict execution order and Supabase sync.
 */

(function () {
  'use strict';

  console.log('[App Shell] Initializing Engine...');

  const pageConfigs = {
    'dashboard': {
      navKey: 'dashboard', title: 'Dashboard', intro: 'Live fleet metrics and shipment performance analytics.', breadcrumbs: ['Admin', 'Dashboard'],
      showRegisterShipment: false, showDatabase: false, databaseTitle: 'Real-Time Inventory', enterpriseCards: []
    },
    'create-shipment': {
      navKey: 'create-shipment', title: 'Cargo Registration', intro: 'Register cargo and sync milestones to Database.', breadcrumbs: ['Admin', 'Operations', 'Create'],
      showRegisterShipment: true, showDatabase: false, enterpriseCards: []
    },
    'shipment-management': {
      navKey: 'shipment-management', title: 'Shipment Inventory', intro: 'Manage lifecycle of all active shipments.', breadcrumbs: ['Admin', 'Operations', 'Shipments'],
      showRegisterShipment: false, showDatabase: true, databaseTitle: 'Shipment Master Database', enterpriseCards: []
    },
    'reports': {
      navKey: 'reports', title: 'Reports', intro: 'Operational summaries and exports.', breadcrumbs: ['Admin', 'Business', 'Reports'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseReportsCard']
    },
    'finance': {
      navKey: 'finance', title: 'Finance', intro: 'Revenue, expenses, and net profit tracking.', breadcrumbs: ['Admin', 'Business', 'Finance'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseFinanceCard']
    },
    'invoices': {
      navKey: 'invoices', title: 'Billing Center', intro: 'Customer invoicing and payment reconciliation.', breadcrumbs: ['Admin', 'Business', 'Invoices'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseInvoicesCard']
    },
    'user-management': {
      navKey: 'user-management', title: 'User Access', intro: 'System roles and login provisioning.', breadcrumbs: ['Admin', 'System', 'Users'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseUsersCard']
    },
    'activity-log': {
      navKey: 'activity-log', title: 'Security Audit', intro: 'Transparent log of all administrative actions.', breadcrumbs: ['Admin', 'System', 'Logs'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseActivityCard']
    },
    'notifications': {
      navKey: 'notifications', title: 'System Notifications', intro: 'Full history of automated alerts and system messages.', breadcrumbs: ['Admin', 'Communications', 'Alerts'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseNotificationsCard']
    },
    'profile': {
      navKey: 'profile', title: 'User Profile', intro: 'Manage your account settings.', breadcrumbs: ['Admin', 'Profile'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseProfileCard']
    },
    'settings': {
      navKey: 'settings', title: 'Settings', intro: 'Company info and platform configuration.', breadcrumbs: ['Admin', 'System', 'Settings'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseSettingsCard']
    }
  };

  function getPageName() {
    const p = new URLSearchParams(window.location.search).get('page');
    return (p && pageConfigs[p]) ? p : 'dashboard';
  }

  function $id(i) { return document.getElementById(i); }
  function setVisible(e, v) { if (e) { e.hidden = !v; e.style.display = v ? '' : 'none'; } }

  function ensureDashboardExperience() {
    let dashboard = $id('premiumDashboardExperience');
    const mainContent = $id('dashboardMainContent');
    if (dashboard || !mainContent) return dashboard;
    dashboard = document.createElement('section');
    dashboard.id = 'premiumDashboardExperience';
    dashboard.className = 'premium-dashboard-experience';
    dashboard.innerHTML = `
      <section class="dashboard-hero n-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:24px; background:linear-gradient(135deg, var(--n-surface), #000); border-color:var(--n-border-accent);">
        <div>
          <span class="text-muted" style="text-transform:uppercase; letter-spacing:3px; font-weight:900; font-size:0.7rem; color:var(--n-gold);">Command Center</span>
          <h1 style="margin-top:12px; font-size:2.5rem; letter-spacing:-1.5px;">Network Overview</h1>
          <p class="text-muted" style="margin-top:8px; font-size:1.1rem; max-width:600px;">Real-time intelligence and global fleet synchronization.</p>
        </div>
        <div style="display:flex; gap:16px;">
          <button class="n-btn primary" onclick="window.location.href='?page=create-shipment'"><i class="fa-solid fa-plus-circle"></i> Register Cargo</button>
          <button class="n-btn" onclick="window.openImportModal()"><i class="fa-solid fa-file-import"></i> Data Manifest</button>
          <button class="n-btn" onclick="window.refreshDashboard()"><i class="fa-solid fa-sync"></i></button>
        </div>
      </section>

      <section class="kpi-grid">
        <article class="kpi-card"><div class="kpi-icon"><i class="fa-solid fa-boxes-stacked"></i></div><div class="kpi-data"><span>Total Operations</span><strong id="stat-total-shipments">0</strong></div></article>
        <article class="kpi-card"><div class="kpi-icon" style="color:var(--n-success); background:rgba(16,185,129,0.1);"><i class="fa-solid fa-circle-check"></i></div><div class="kpi-data"><span>Delivered</span><strong id="stat-delivered">0</strong></div></article>
        <article class="kpi-card"><div class="kpi-icon" style="color:var(--n-gold); background:var(--n-gold-glow);"><i class="fa-solid fa-truck-fast"></i></div><div class="kpi-data"><span>In Transit</span><strong id="stat-transit">0</strong></div></article>
        <article class="kpi-card"><div class="kpi-icon" style="color:var(--n-warning); background:rgba(245,158,11,0.1);"><i class="fa-solid fa-clock-rotate-left"></i></div><div class="kpi-data"><span>Pending</span><strong id="stat-pending">0</strong></div></article>
      </section>
    `;
    mainContent.appendChild(dashboard);
    return dashboard;
  }

  function buildEnterpriseStructure() {
    if ($id('enterpriseAppShell')) return;
    const header = document.querySelector('.header-bar');
    const sidebar = document.querySelector('.sidebar');
    const adminMain = document.querySelector('.admin-main');
    const footer = document.querySelector('.app-footer');
    if (!header || !sidebar || !adminMain) return;

    const authOverlay = $id('adminAuthOverlay');
    const splashOverlay = $id('nooraniSplashOverlay');

    const modals = document.querySelectorAll('.enterprise-modal-backdrop, .notification-drawer');
    const modalsArray = Array.from(modals);

    const shell = document.createElement('div');
    shell.id = 'enterpriseAppShell';
    shell.className = 'enterprise-app';

    const side = document.createElement('aside');
    side.className = 'enterprise-side';

    const main = document.createElement('main');
    main.className = 'enterprise-main';

    header.classList.add('enterprise-topbar');

    // Check if utility nav already exists
    if (!header.querySelector('.enterprise-utility-nav')) {
        const utilityNav = document.createElement('nav');
        utilityNav.className = 'enterprise-utility-nav';
        utilityNav.innerHTML = `<a href="?page=notifications" title="Notifications"><i class="fa-solid fa-bell"></i></a><a href="?page=profile" title="Profile"><i class="fa-solid fa-user-circle"></i></a>`;
        header.appendChild(utilityNav);
    }

    document.body.innerHTML = '';
    document.body.appendChild(shell);

    if (authOverlay) document.body.appendChild(authOverlay);
    if (splashOverlay) document.body.appendChild(splashOverlay);

    modalsArray.forEach(m => document.body.appendChild(m));

    shell.append(header, side, main);
    if (footer) main.appendChild(footer);

    side.appendChild(sidebar);
    setVisible(sidebar, true);
    main.appendChild(adminMain);
    setVisible(adminMain, true);

    applyLayout();
  }

  function applyLayout() {
    const name = getPageName();
    const config = pageConfigs[name];
    if (!config) return;

    const contentArea = document.querySelector('.enterprise-main');
    if (contentArea) contentArea.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    document.title = `NOORANI CARGO — ${config.title}`;

    document.querySelectorAll('.sidebar .nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.navKey === config.navKey);

        const applyVisibility = () => {
            const perm = i.dataset.permission;
            const db = window.nooraniDb;
            const profile = window.nooraniAdminProfile;
            if (perm && db && db.profileHasPermission && profile) {
                const hasAccess = db.profileHasPermission(profile, perm);
                i.style.display = hasAccess ? 'flex' : 'none';
            }
        };

        if (window.nooraniAdminProfile) applyVisibility();
        else window.addEventListener('noorani:admin-auth-state', applyVisibility, { once: true });
    });

    setVisible($id('dashboardMainContent'), true);
    setVisible($id('registerShipment'), config.showRegisterShipment);
    setVisible($id('databaseSection'), config.showDatabase);

    const dashboardExperience = name === 'dashboard' ? ensureDashboardExperience() : $id('premiumDashboardExperience');
    setVisible(dashboardExperience, name === 'dashboard');

    if (window.checkAccess) window.checkAccess();

    if (name === 'dashboard' && typeof window.refreshDashboard === 'function') {
      window.refreshDashboard().catch(err => console.error('Dashboard refresh failed', err));
    } else if (config.showDatabase && typeof window.loadDashboard === 'function') {
      window.loadDashboard().catch(err => console.error('Table load failed', err));
    }

    const ep = $id('enterprise-admin-panel');
    if (ep) {
      const cards = ['enterpriseAnalyticsCard', 'enterpriseReportsCard', 'enterpriseFinanceCard', 'enterpriseInvoicesCard', 'enterpriseUsersCard', 'enterpriseActivityCard', 'enterpriseNotificationsCard', 'enterpriseProfileCard', 'enterpriseSettingsCard', 'enterpriseBackupCard'];
      cards.forEach(id => {
        const c = $id(id);
        if (c) setVisible(c, config.enterpriseCards.includes(id));
      });
      setVisible(ep, config.enterpriseCards.length > 0);
    }
  }

  function init() {
    document.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('?page=')) {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (window.location.search !== url) {
          history.pushState(null, '', url);
          applyLayout();
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          const contentArea = document.querySelector('.enterprise-main');
          if (contentArea) contentArea.scrollTop = 0;
        }
      }
    });

    const timer = window.setInterval(() => {
      if ($id('enterprise-admin-panel') || $id('adminView')) {
        window.clearInterval(timer);
        buildEnterpriseStructure();
      }
    }, 100);

    window.addEventListener('noorani:admin-auth-state', () => applyLayout());
    window.addEventListener('popstate', applyLayout);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
