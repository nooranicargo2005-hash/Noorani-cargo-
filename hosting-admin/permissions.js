/**
 * Noorani Cargo | Role-Based Access Control
 */

export const PERMISSIONS = [
    'createShipments', 'viewShipments', 'editShipments', 'deleteShipments',
    'viewUsers', 'manageUsers',
    'viewManifests', 'manageManifests',
    'viewDashboard'
];

export const permissionLabels = {
    createShipments: 'Create Shipment',
    viewShipments: 'View Inventory',
    editShipments: 'Edit Shipment',
    deleteShipments: 'Delete Shipment',
    viewUsers: 'View Accounts',
    manageUsers: 'Manage Accounts',
    viewManifests: 'View Manifests',
    manageManifests: 'Manage Manifests',
    viewDashboard: 'View Dashboard'
};

export const ROLE_DEFINITIONS = {
    admin: {
        label: 'Administrator',
        permissions: {
            viewDashboard: true,
            viewShipments: true, createShipments: true, editShipments: true, deleteShipments: true,
            viewManifests: true, manageManifests: true,
            viewUsers: true, manageUsers: true
        }
    },
    manager: {
        label: 'Operations Manager',
        permissions: {
            viewDashboard: true,
            viewShipments: true, editShipments: true,
            viewManifests: true, manageManifests: true
        }
    },
    employee: {
        label: 'Logistics Staff',
        permissions: {
            viewDashboard: true,
            viewShipments: true, createShipments: true
        }
    },
    agent: {
        label: 'Regional Agent',
        permissions: {
            viewDashboard: true,
            viewShipments: true, createShipments: true
        }
    },
    viewer: {
        label: 'Guest / Viewer',
        permissions: {
            viewDashboard: true, viewShipments: true
        }
    }
};

export function profileHasPermission(profile, permission) {
    if (!profile || !profile.role) return false;
    const def = ROLE_DEFINITIONS[profile.role];
    if (!def) return false;
    return !!def.permissions[permission];
}

export function roleLabel(role) {
    return ROLE_DEFINITIONS[role]?.label || 'Guest';
}
