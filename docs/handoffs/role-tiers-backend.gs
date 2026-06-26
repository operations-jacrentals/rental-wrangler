/* Role-system redesign — backend additions (deployed 2026-06-26)
 * ------------------------------------------------------------------
 * Secret-free record of the Code.gs changes that made the backend
 * tier-aware (Code.gs is gitignored; this is the tracked copy per the
 * /clasp rules). Mirrors app.js config.js ROLE_TIERS/BUILTIN_ROLE_TIERS.
 * Spec: docs/superpowers/specs/2026-06-26-role-system-redesign-design.md
 *
 * WHY: roles are customizable, so server-side gates must key off a TIER,
 * not a role name. Tiers are set by an admin via settings.roleMeta
 * (setConfig is admin-gated) → a non-admin can't escalate their own tier.
 */

/* ── added: the tier layer (place after the ADMIN_ROLES/MONEY_ROLES vars,
 *    which are now SUPERSEDED and kept only as a comment/seed reference) ── */
var ROLE_TIER_RANK = { staff: 1, money: 2, manager: 3, admin: 4, developer: 5 };
var BUILTIN_ROLE_TIERS = {
  mechanic: 'staff', mtech: 'staff', driver: 'staff', office: 'money', sales: 'money',
  manager: 'manager', admin: 'admin', developer: 'developer', owner: 'admin'
};
function roleTierRank_(role, cfg) {
  if (!role) return 0;
  var id = String(role).trim().toLowerCase();
  cfg = cfg || getConfigObj();
  var meta = (cfg.settings && cfg.settings.roleMeta) || {};
  var keys = Object.keys(meta);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === id && meta[keys[i]] && meta[keys[i]].tier) return ROLE_TIER_RANK[String(meta[keys[i]].tier).toLowerCase()] || 0;
  }
  if (BUILTIN_ROLE_TIERS[id]) return ROLE_TIER_RANK[BUILTIN_ROLE_TIERS[id]] || 0;
  return 0;
}
function roleMoneyOk_(role) { return roleTierRank_(role) >= ROLE_TIER_RANK.money; }

/* ── changed gates (all switched from name-maps to tiers) ──
 *  auth:  money: roleMoneyOk_(r0)                         (was !!MONEY_ROLES[r0])
 *  stripe gate:  if (!roleMoneyOk_(role)) return forbidden (was !MONEY_ROLES[role])
 *  membershipActivate / recordManualPayment / recordManualRefund:
 *                roleMoneyOk_(role) ? ... : forbidden     (was MONEY_ROLES[role] ? ...)
 */
function isAdmin(pw) { return roleTierRank_(roleForPassword(pw)) >= ROLE_TIER_RANK.admin; }   // tier >= admin

/* ── changed: saveConfigFromBody — accept ARBITRARY role keys (the fix that
 *    lets Developer + custom roles persist; the old version iterated only
 *    DEFAULT_CONFIG.roles keys and silently dropped new ones). ── */
function saveConfigFromBody(cfg) {
  if (!cfg || typeof cfg !== 'object' || !cfg.roles || !cfg.admin) return { ok: false, error: 'bad-config' };
  var clean = { roles: {}, admin: String(cfg.admin) };
  Object.keys(cfg.roles).forEach(function (role) {
    var v = cfg.roles[role]; if (v == null || String(v) === '') return;
    clean.roles[String(role).slice(0, 60)] = String(v).slice(0, 200);
  });
  if (!Object.keys(clean.roles).length) { Object.keys(DEFAULT_CONFIG.roles).forEach(function (role) { clean.roles[role] = DEFAULT_CONFIG.roles[role]; }); }
  if (cfg.settings && typeof cfg.settings === 'object') clean.settings = cfg.settings;
  var lock = tryLock_(15000); if (!lock) return { ok: false, error: 'busy' };
  try { saveConfigObj(clean); } finally { lock.releaseLock(); }
  return { ok: true, saved: true };
}

/* ── changed: backfillRoles_ — seed defaults ONLY when a config has zero roles
 *    (so a removed/renamed role no longer gets resurrected). ── */
function backfillRoles_(c) {
  if (!c.roles || !Object.keys(c.roles).length) {
    c.roles = JSON.parse(JSON.stringify(DEFAULT_CONFIG.roles));
    try { saveConfigObj(c); } catch (e) {}
  }
  return c;
}
