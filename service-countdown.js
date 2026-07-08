/**
 * service-countdown.js — Rental Wrangler recurring-service countdown
 * ------------------------------------------------------------------
 * Each unit runs a set of recurring maintenance tasks, each with its own
 * HOUR interval. As a unit's hours approach an interval the task flags
 * yellow (due-soon); past the interval it flags red (past-due). Completing a
 * task does NOT archive it — it resets the countdown and logs the event to
 * History (SPEC v6 §7.7 / §12.7).
 *
 * IMPORTANT — this is the REAL logic, not a port of the prototype.
 * jactec-frontend-v2.html's `svcForUnit()` fabricated a "due" value with
 * synthetic math `((hours*7 + i*53 + svcBase) % round(interval*1.18))` purely
 * to populate the mockup. That is throwaway demo code. The real countdown,
 * per Core-Spec §6 and SPEC v6, is:
 *
 *     elapsed   = currentHours − lastServicedHours
 *     remaining = intervalHours − elapsed
 *     pct       = elapsed / intervalHours
 *     status    = remaining < 0      → 'past-due'   (red)
 *                 pct >= DUE_SOON_AT → 'due-soon'   (yellow)
 *                 else               → 'ok'         (green)
 *
 * Pure functions, no DOM/framework coupling.
 *
 * FIELD MAP (prototype → v6):
 *   unit.hours         → unit.currentHours
 *   unit.purchaseHours → unit.purchaseHours   (used as the baseline when a
 *                        task has never been completed for that unit)
 * ------------------------------------------------------------------
 */

/** Flag yellow once the unit has used >= 90% of the interval. */
export const DUE_SOON_AT = 0.9;

/**
 * Default recurring tasks (intervals in HOURS).
 * v1 placeholder — REPLACE with real per-equipment manufacturer schedules
 * (likely keyed by Category) before production. `parts` lists the catalog
 * part names this task consumes.
 */
export const SERVICE_TASKS = [
  { taskId: 'svc-safety',    name: 'Safety Equipment Check',        intervalHours: 250,  parts: [] },
  { taskId: 'svc-grease',    name: 'Grease All Fittings',           intervalHours: 250,  parts: ['Multipurpose Grease'] },
  { taskId: 'svc-oil',       name: 'Engine Oil & Filter',          intervalHours: 250,  parts: ['Engine Oil 15W-40', 'Oil Filter'] },
  { taskId: 'svc-belt',      name: 'Drive Chain / Belt Inspection', intervalHours: 250,  parts: ['Drive Belt'] },
  { taskId: 'svc-air',       name: 'Air Filter',                    intervalHours: 500,  parts: ['Air Filter'] },
  { taskId: 'svc-tire',      name: 'Tire / Track Inspection',       intervalHours: 500,  parts: [] },
  { taskId: 'svc-battery',   name: 'Battery Check',                 intervalHours: 500,  parts: ['Battery'] },
  { taskId: 'svc-fuel',      name: 'Fuel Filter',                   intervalHours: 500,  parts: ['Fuel Filter'] },
  { taskId: 'svc-annual',    name: 'Annual Full Inspection',        intervalHours: 1000, parts: [] },
  { taskId: 'svc-hydraulic', name: 'Hydraulic Oil & Filter',        intervalHours: 1000, parts: ['Hydraulic Oil AW-46', 'Hydraulic Filter'] },
];

/**
 * Compute the countdown status for a single task.
 * @param {number} currentHours       the unit's current hour meter
 * @param {number} lastServicedHours  unit hours at the task's last completion
 *                                     (use the unit's baseline/purchaseHours
 *                                     if the task has never been completed)
 * @param {number} intervalHours      the task interval
 * @returns {{elapsed:number, remaining:number, pct:number, status:('ok'|'due-soon'|'past-due')}}
 */
export function serviceStatus(currentHours, lastServicedHours, intervalHours) {
  const cur = Number(currentHours) || 0;
  const last = Number(lastServicedHours) || 0;
  const interval = Number(intervalHours) || 0;

  const elapsed = cur - last;
  const remaining = interval - elapsed;
  const pct = interval > 0 ? elapsed / interval : 0;

  let status;
  if (remaining < 0) status = 'past-due';
  else if (pct >= DUE_SOON_AT) status = 'due-soon';
  else status = 'ok';

  return { elapsed, remaining, pct, status };
}

/** Map a status to a UI color token (SPEC v6 §6.2 #7). */
export function serviceColor(status) {
  return status === 'past-due' ? 'red'
       : status === 'due-soon' ? 'yellow'
       : 'green';
}

/** Human-readable countdown pill text (SPEC v6 §12.7 Row 2). */
export function serviceLabel({ remaining, status }) {
  if (status === 'past-due') return `${Math.abs(remaining)} HRS overdue`;
  return `${remaining} HRS remaining`;
}

/**
 * Build the full set of service-order rows for a unit.
 * @param {object} unit                 unit record (needs current hours + a baseline)
 * @param {object} [completions]        { [taskId]: hoursAtLastCompletion } — most recent
 *                                       completion per task; omit/blank tasks fall back
 *                                       to the unit's baseline hours.
 * @param {object} [opts] { tasks, hoursField, baselineField }
 * @returns {Array<{taskId,name,intervalHours,parts,elapsed,remaining,pct,status,color,label}>}
 *          one row per task, sorted most-urgent first (past-due → due-soon → ok).
 */
export function serviceOrdersForUnit(unit, completions = {}, opts = {}) {
  const tasks = opts.tasks || SERVICE_TASKS;
  const hoursField = opts.hoursField || 'hours';            // v6: 'currentHours'
  const baselineField = opts.baselineField || 'purchaseHours';
  const currentHours = Number(unit?.[hoursField]) || 0;
  const baseline = Number(unit?.[baselineField]) || 0;

  const rows = tasks.map((t) => {
    const lastServiced = completions[t.taskId] != null ? Number(completions[t.taskId]) : baseline;
    const st = serviceStatus(currentHours, lastServiced, t.intervalHours);
    return {
      // Spread the whole task first so extra fields a caller carries on the task
      // object (e.g. `source` / `sourceUrl`, the manual-page citation added
      // Jac 2026-07-07) ride through untouched — this must stay a superset of
      // the task, never a hand-picked allowlist of keys.
      ...t,
      ...st,
      color: serviceColor(st.status),
      label: serviceLabel(st),
    };
  });

  // Most urgent first: smallest remaining (most negative = most overdue) on top.
  return rows.sort((a, b) => a.remaining - b.remaining);
}

/**
 * Apply a completion: returns the new completions map with this task reset to
 * the hours at which it was completed. (Pure — caller persists + logs to History.)
 * @returns {object} updated completions map
 */
export function completeService(completions, taskId, hoursAtCompletion) {
  return { ...completions, [taskId]: Number(hoursAtCompletion) || 0 };
}

export default { SERVICE_TASKS, DUE_SOON_AT, serviceStatus, serviceColor, serviceLabel, serviceOrdersForUnit, completeService };
