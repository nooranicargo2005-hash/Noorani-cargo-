export const PERMISSION_KEYS = [
  'viewDashboard',
  'createShipments', 'viewShipments', 'editShipments', 'deleteShipments', 'printShipments',
  'viewFinance', 'addFinance', 'editFinance', 'deleteFinance',
  'viewReports', 'exportReports',
  'viewSettings', 'editSettings',
  'manageRoles', 'manageUsers'
];

export const PERMISSION_LABELS = {
  viewDashboard: 'View Dashboard',
  createShipments: 'Create Shipments',
  viewShipments: 'View Shipments',
  editShipments: 'Edit Shipments',
  deleteShipments: 'Delete Shipments',
  printShipments: 'Print Shipments',
  viewFinance: 'View Finance',
  addFinance: 'Add Finance',
  editFinance: 'Edit Finance',
  deleteFinance: 'Delete Finance',
  viewReports: 'View Reports',
  exportReports: 'Export Reports',
  viewSettings: 'View Settings',
  editSettings: 'Edit Settings',
  manageRoles: 'Manage Roles',
  manageUsers: 'Manage Users'
};

export const APPROVED_FULL_ADMIN_EMAILS = Object.freeze([
  'arafatnoorani00966@gmail.com',
  'nooranicargo2005@gmail.com'
]);

export const DEFAULT_ROLE_PERMISSIONS = {
    superadmin: PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    admin: {
        viewDashboard: true,
        viewShipments: true, createShipments: true, editShipments: true, printShipments: true,
        viewFinance: true, addFinance: true,
        viewReports: true, exportReports: true,
        viewSettings: true
    },
    branchmanager: {
        viewDashboard: true,
        viewShipments: true, createShipments: true, editShipments: true,
        viewFinance: true,
        viewReports: true
    },
    employee: {
        viewDashboard: true,
        viewShipments: true, createShipments: true
    },
    customer: {
        viewShipments: true
    }
};

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  if (['superadmin', 'super_admin', 'fulladmin'].includes(role)) return 'superadmin';
  if (['admin', 'administrator'].includes(role)) return 'admin';
  if (['branchadmin', 'branchmanager', 'branch_admin', 'branch_manager'].includes(role)) return 'branchmanager';
  if (role === 'employee' || role === 'staff') return 'employee';
  return 'customer';
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  const labels = {
      superadmin: 'Super Admin',
      admin: 'Administrator',
      branchmanager: 'Branch Manager',
      employee: 'Employee / Staff',
      customer: 'Customer'
  };
  return labels[normalized] || 'Guest';
}

export function buildAdminProfilePermissions(profile, isSuperAdmin = false) {
  const role = normalizeRole(profile.role);
  const permissions = Object.assign({}, DEFAULT_ROLE_PERMISSIONS[role] || {});

  if (profile.permissions && typeof profile.permissions === 'object') {
      Object.assign(permissions, profile.permissions);
  }

  if (isSuperAdmin) {
      PERMISSION_KEYS.forEach(key => permissions[key] = true);
  }

  return permissions;
}

export function profileHasPermission(profile, permission) {
  if (!profile || profile.status === 'disabled') return false;
  const role = normalizeRole(profile.role);

  // Super Admin bypass
  if (role === 'superadmin' && APPROVED_FULL_ADMIN_EMAILS.includes(normalizeEmail(profile.email))) {
      return true;
  }

  const perms = buildAdminProfilePermissions(profile, false);
  return perms[permission] === true;
}

export function isApprovedFullAdminEmail(value) {
  return APPROVED_FULL_ADMIN_EMAILS.includes(normalizeEmail(value));
}

export function isApprovedFullAdminProfile(profile) {
  return Boolean(profile) &&
    normalizeRole(profile.role) === 'superadmin' &&
    isApprovedFullAdminEmail(profile.email);
}
