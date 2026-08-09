/**
 * Noorani Cargo Enterprise | Multi-Page Engine
 * Optimized for strict execution order and SQLite sync.
 */

(function () {
  'use strict';

  console.log('[App Shell] Initializing Engine...');

  const pageConfigs = {
    'dashboard': {
      navKey: 'dashboard', title: 'Operational Command Center', intro: 'Live fleet metrics and shipment performance analytics.', breadcrumbs: ['Admin', 'Dashboard'],
      showRegisterShipment: false, showDatabase: true, databaseTitle: 'Real-Time Inventory', enterpriseCards: ['enterpriseAnalyticsCard', 'enterpriseActivityCard']
    },
    'create-shipment': {
      navKey: 'create-shipment', title: 'Register New Shipment', intro: 'Register cargo and sync milestones to Database.', breadcrumbs: ['Admin', 'Operations', 'Create'],
      showRegisterShipment: true, showDatabase: true, enterpriseCards: []
    },
    'shipment-management': {
      navKey: 'shipment-management', title: 'Inventory Control', intro: 'Manage lifecycle of all active shipments.', breadcrumbs: ['Admin', 'Operations', 'Shipments'],
      showRegisterShipment: false, showDatabase: true, databaseTitle: 'Shipment Master Database', enterpriseCards: []
    },
    'customers': {
      navKey: 'customers', title: 'Customer CRM', intro: 'Maintain relationships and history.', breadcrumbs: ['Admin', 'Management', 'Customers'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseCustomersCard']
    },
    'branches': {
      navKey: 'branches', title: 'Branch Network', intro: 'Global office directory and performance.', breadcrumbs: ['Admin', 'Management', 'Branches'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseBranchesCard']
    },
    'employees': {
      navKey: 'employees', title: 'Workforce Management', intro: 'Manage team members and assigned branch permissions.', breadcrumbs: ['Admin', 'Management', 'Employees'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseEmployeesCard']
    },
    'drivers': {
      navKey: 'drivers', title: 'Dispatch & Drivers', intro: 'Manage registered fleet operators.', breadcrumbs: ['Admin', 'Management', 'Drivers'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseDriversCard']
    },
    'vehicles-warehouses': {
      navKey: 'vehicles-warehouses', title: 'Fleet & Assets', intro: 'Vehicle tracking and facility assets.', breadcrumbs: ['Admin', 'Management', 'Assets'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseFleetCard']
    },
    'reports': {
      navKey: 'reports', title: 'Reporting Studio', intro: 'Operational summaries and exports.', breadcrumbs: ['Admin', 'Business', 'Reports'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseReportsCard']
    },
    'finance': {
      navKey: 'finance', title: 'Financial Ledger', intro: 'Revenue, expenses, and net profit tracking.', breadcrumbs: ['Admin', 'Business', 'Finance'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseFinanceCard']
    },
    'invoices': {
      navKey: 'invoices', title: 'Billing Center', intro: 'Customer invoicing and payment reconciliation.', breadcrumbs: ['Admin', 'Business', 'Invoices'],
      showRegisterShipment: false, showDatabase: false, enterpriseCards: ['enterpriseInvoicesCard']
    },
    'user-management': {
      navKey: 'user-management', title: 'Access Control', intro: 'System roles and login provisioning.', breadcrumbs: ['Admin', 'System', 'Users'],
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
    'settings': {
      navKey: 'settings', title: 'Global Settings', intro: 'Company info and platform configuration.', breadcrumbs: ['Admin', 'System', 'Settings'],
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
      <section class="enterprise-dashboard-welcome enterprise-card">
        <div>
          <span class="enterprise-kicker">Logistics Intelligence</span>
          <h1>Operational Command Center</h1>
          <p>Real-time analytics and management of the global Noorani Cargo network.</p>
        </div>
        <div class="enterprise-btn-row mt-20">
          <button class="btn-primary-action" onclick="window.location.href='?page=create-shipment'"><i class="fa-solid fa-plus"></i>New shipment</button>
          <button class="btn-action" onclick="window.openImportModal()"><i class="fa-solid fa-file-import"></i>Import Data</button>
          <button class="btn-action" onclick="window.refreshDashboard()"><i class="fa-solid fa-sync"></i>Refresh</button>
        </div>
      </section>

      <section class="enterprise-kpi-grid mt-20">
        <article class="enterprise-kpi-card"><span class="enterprise-kpi-icon"><i class="fa-solid fa-boxes-stacked"></i></span><div><small>Total</small><strong id="stat-total-shipments">0</strong></div></article>
        <article class="enterprise-kpi-card"><span class="enterprise-kpi-icon status-delivered"><i class="fa-solid fa-check"></i></span><div><small>Delivered</small><strong id="stat-delivered">0</strong></div></article>
        <article class="enterprise-kpi-card"><span class="enterprise-kpi-icon status-transit"><i class="fa-solid fa-truck"></i></span><div><small>In Transit</small><strong id="stat-transit">0</strong></div></article>
        <article class="enterprise-kpi-card"><span class="enterprise-kpi-icon"><i class="fa-solid fa-clock"></i></span><div><small>Pending</small><strong id="stat-pending">0</strong></div></article>
        <article class="enterprise-kpi-card"><span class="enterprise-kpi-icon"><i class="fa-solid fa-dollar-sign"></i></span><div><small>Revenue</small><strong id="stat-revenue">$0</strong></div></article>
        <article class="enterprise-kpi-card"><span class="enterprise-kpi-icon"><i class="fa-solid fa-users"></i></span><div><small>Clients</small><strong id="stat-customers">0</strong></div></article>
      </section>

      <section class="grid-3 mt-20">
        <article class="enterprise-card">
          <header class="enterprise-card-heading"><h3>Daily Trends</h3></header>
          <div class="chart-container"><canvas id="dailyChart"></canvas></div>
        </article>
        <article class="enterprise-card">
          <header class="enterprise-card-heading"><h3>Revenue</h3></header>
          <div class="chart-container"><canvas id="revenueChart"></canvas></div>
        </article>
        <article class="enterprise-card">
          <header class="enterprise-card-heading"><h3>Distribution</h3></header>
          <div class="chart-container-pie"><canvas id="statusChart"></canvas></div>
        </article>
      </section>

      <section class="grid-3 mt-20">
        <article class="enterprise-card">
          <header class="enterprise-card-heading"><h3>Activity</h3></header>
          <div id="recent-activity-list" class="enterprise-list"></div>
        </article>
        <article class="enterprise-card">
          <header class="enterprise-card-heading"><h3>Alerts</h3></header>
          <div id="dashboard-notifications" class="enterprise-list"></div>
        </article>
        <article class="enterprise-card">
          <header class="enterprise-card-heading"><h3>Quick Actions</h3></header>
          <div class="enterprise-btn-row">
            <a class="enterprise-btn" href="?page=customers">Add Customer</a>
            <a class="enterprise-btn" href="?page=drivers">Add Driver</a>
            <a class="enterprise-btn" href="?page=vehicles-warehouses">Add Vehicle</a>
          </div>
        </article>
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

    document.title = `Noorani Admin — ${config.title}`;

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
      const cards = ['enterpriseAnalyticsCard', 'enterpriseReportsCard', 'enterpriseCustomersCard', 'enterpriseBranchesCard', 'enterpriseEmployeesCard', 'enterpriseDriversCard', 'enterpriseFleetCard', 'enterpriseFinanceCard', 'enterpriseInvoicesCard', 'enterpriseUsersCard', 'enterpriseActivityCard', 'enterpriseNotificationsCard', 'enterpriseProfileCard', 'enterpriseSettingsCard', 'enterpriseBackupCard'];
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
