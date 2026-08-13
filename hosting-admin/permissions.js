export const PERMISSION_KEYS = [
  'viewDashboard',
  'createSwbs', 'viewSwbs', 'editSwbs', 'deleteSwbs',
  'manageUsers', 'manageManifests', 'viewReports'
];

export const PERMISSION_LABELS = {
  viewDashboard: 'View Dashboard',
  createSwbs: 'Create SWB',
  viewSwbs: 'View SWB Inventory',
  editSwbs: 'Edit SWB',
  deleteSwbs: 'Delete SWB',
  manageUsers: 'Manage Users',
  manageManifests: 'Manage Manifests',
  viewReports: 'View Reports'
};

export const APPROVED_FULL_ADMIN_EMAILS = Object.freeze([
  'arafatnoorani00966@gmail.com',
  'nooranicargo2005@gmail.com'
]);

export const DEFAULT_ROLE_PERMISSIONS = {
    superadmin: PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    admin: {
        viewDashboard: true,
        viewSwbs: true, createSwbs: true, editSwbs: true,
        manageManifests: true, viewReports: true
    },
    operations: {
        viewDashboard: true,
        viewSwbs: true, editSwbs: true,
        manageManifests: true
    },
    dataentry: {
        viewSwbs: true, createSwbs: true
    },
    employee: {
        viewDashboard: true,
        viewSwbs: true, createSwbs: true
    },
    viewer: {
        viewDashboard: true, viewSwbs: true
    }
};

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  const valid = ['superadmin', 'admin', 'operations', 'dataentry', 'employee', 'viewer'];
  if (valid.includes(role)) return role;
  return 'viewer';
}

export function roleLabel(role) {
  const labels = {
      superadmin: 'Super Admin',
      admin: 'Administrator',
      operations: 'Operations Lead',
      dataentry: 'Data Entry Clerk',
      employee: 'Employee / Staff',
      viewer: 'Guest Viewer'
  };
  return labels[role] || 'Guest';
}

export function profileHasPermission(profile, permission) {
  if (!profile || profile.status === 'disabled') return false;
  const role = normalizeRole(profile.role);
  if (role === 'superadmin') return true;
  const perms = DEFAULT_ROLE_PERMISSIONS[role] || {};
  return perms[permission] === true;
}
