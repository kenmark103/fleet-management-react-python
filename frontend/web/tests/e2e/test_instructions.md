 * ── Route notes ──────────────────────────────────────────────────────────────
 * /maintenance and /fuel are index pages with tabs — they have no sub-path
 * index routes for work-orders, schedules, logs, expenses etc.
 * Safe _auth-guarded index routes to use in tests: /trips, /drivers,
 * /fleet/trucks, /fleet/trailers, /maintenance, /dashboard.
 *
 * ── Role access (from constants.ts NAV_ITEMS) ────────────────────────────────
 * MECHANIC  : dashboard, fleet/trucks, fleet/trailers, maintenance,
 *             settings/profile
 *             ✗ drivers, trips, fuel, settings/users, settings/system
 * ADMIN     : everything
 * DISPATCHER: dashboard, fleet, drivers, trips, maintenance, settings/profile
 * DRIVER    : dashboard, drivers, trips, fuel, settings/profile
 * FINANCE   : dashboard, fleet, trips, fuel, settings/profile