# UI/UX Redesign: Premium Noorani Logistics System

Redesign the entire Noorani Cargo system (Admin and Public Tracking) with a premium dark/charcoal and gold aesthetic, while preserving all existing functionality and backend integrations.

## User Review Required

> [!IMPORTANT]
> This redesign modifies `core.css` files and slightly adjusts `index.html` structures to improve layout consistency. No functional JavaScript or backend logic will be changed.

## Proposed Changes

### Shared Design System
- **Colors**: Deep Charcoal (`#0a0a0b`), Surface (`#141417`), Noorani Gold (`#f4b400`), Muted Blue-Grey (`#94a3b8`).
- **Typography**: Inter for UI/Body, Merriweather for Headings (Gold accents).
- **Components**:
  - Ultra-modern cards with subtle borders and deep shadows.
  - Sidebar with refined glassmorphism effects.
  - High-performance data tables with improved spacing and readability.
  - Buttons with premium hover states and gold glows.

### [hosting-admin](file:///C:/noorani-cargo-tracking/hosting-admin)

#### [MODIFY] [core.css](file:///C:/noorani-cargo-tracking/hosting-admin/core.css)
- Implement the new charcoal/gold variables.
- Refine the sidebar/topbar layout for better professional feel.
- Optimize table density and typography for high-information density.

#### [MODIFY] [index.html](file:///C:/noorani-cargo-tracking/hosting-admin/index.html)
- Minor structural tweaks to support the refined sidebar and topbar if needed.
- Ensure all functional IDs remain intact.

### [hosting-tracking](file:///C:/noorani-cargo-tracking/hosting-tracking)

#### [MODIFY] [core.css](file:///C:/noorani-cargo-tracking/hosting-tracking/core.css)
- Apply the same premium design language as the admin panel.
- Enhance the "Tracking Search" hero section for a more "Elite Logistics" impact.
- Improve the shipment timeline visualization with gold accents and smoother transitions.

#### [MODIFY] [index.html](file:///C:/noorani-cargo-tracking/hosting-tracking/index.html)
- Align the branding elements (emblem, titles) with the admin panel for 100% consistency.

## Verification Plan

### Manual Verification
- **Visual Audit**: Navigate through all admin pages (Dashboard, Shipment Management, Customers, etc.) and the public tracking page to ensure design consistency.
- **Responsiveness Test**: Verify layout on Desktop (1920x1080), Tablet (iPad Air), and Mobile (iPhone 14) using browser developer tools.
- **Functional Check**: Verify that Excel import, tracking search, and form submissions still work exactly as before.
