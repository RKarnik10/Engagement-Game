/**
 * Append-only event log (README 6.3).
 *
 * Every record has `t_ms` (milliseconds from the trigger, one decimal) and
 * `event` (trigger, volume, target_on, an outcome code, or run_end), followed
 * by whatever fields the caller passes. Records are never edited or removed.
 * Pure: no DOM, no clock; the caller supplies every timestamp.
 */

const round1 = (x) => +x.toFixed(1);

export function createLogger() {
  const events = [];
  const listeners = new Set();

  return {
    /**
     * Append one record.
     * @param {string} event
     * @param {object} data    Extra fields (trial, hole, rt_ms, ...).
     * @param {number} tMs     Time from trigger in ms.
     * @returns {object}       The appended record.
     */
    log(event, data, tMs) {
      if (typeof event !== 'string' || !event) throw new Error('logger: event name required');
      if (!Number.isFinite(tMs)) throw new Error(`logger: t_ms must be finite, got ${tMs}`);
      const record = { t_ms: round1(tMs), event, ...(data || {}) };
      events.push(record);
      for (const fn of listeners) fn(record);
      return record;
    },

    /** Register a callback for each appended record. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Number of records so far. */
    get length() {
      return events.length;
    },

    /** Shallow copy of all records, in order. */
    toArray() {
      return events.slice();
    },
  };
}
