/** Old (puppy) food fraction by transition day index 0..13 (days 1–14). */
export const OLD_FOOD_FRACTIONS = [
  0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.0,
];

function roundCups(n) {
  return Math.round(n * 100) / 100;
}

function roundGrams(n) {
  return Math.round(n * 10) / 10;
}

function parseLocalDate(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Build the 14-day puppy → adult food transition schedule.
 * @param {string} startDate ISO date (YYYY-MM-DD)
 * @param {number|null|undefined} dailyCups total daily food intake in cups
 * @param {number|null|undefined} dailyGrams total daily food intake in grams
 * @returns {Array<{day:number,date:string,oldPct:number,newPct:number,puppyCups:number|null,adultCups:number|null,puppyGrams:number|null,adultGrams:number|null}>}
 */
export function buildTransitionSchedule(startDate, dailyCups, dailyGrams) {
  const start = parseLocalDate(startDate);
  const cups = positiveNumber(dailyCups);
  const grams = positiveNumber(dailyGrams);
  if (!start || (cups == null && grams == null)) return [];

  return OLD_FOOD_FRACTIONS.map((oldFrac, i) => {
    const day = i + 1;
    const date = addDays(start, i);
    const newFrac = 1 - oldFrac;
    return {
      day,
      date: formatLocalDate(date),
      oldPct: Math.round(oldFrac * 100),
      newPct: Math.round(newFrac * 100),
      puppyCups: cups == null ? null : roundCups(cups * oldFrac),
      adultCups: cups == null ? null : roundCups(cups * newFrac),
      puppyGrams: grams == null ? null : roundGrams(grams * oldFrac),
      adultGrams: grams == null ? null : roundGrams(grams * newFrac),
    };
  });
}

/**
 * @returns {'not_configured'|'not_started'|'in_progress'|'complete'}
 */
export function getTransitionStatus(startDate, todayIso = formatLocalDate(new Date())) {
  const start = parseLocalDate(startDate);
  const today = parseLocalDate(todayIso);
  if (!start || !today) return 'not_configured';

  const end = addDays(start, 13);
  if (today < start) return 'not_started';
  if (today > end) return 'complete';
  return 'in_progress';
}

/** 1–14 if today is within the schedule, otherwise null. */
export function getTransitionDayNumber(startDate, todayIso = formatLocalDate(new Date())) {
  const start = parseLocalDate(startDate);
  const today = parseLocalDate(todayIso);
  if (!start || !today) return null;
  const diffMs = today.getTime() - start.getTime();
  const day = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  if (day < 1 || day > 14) return null;
  return day;
}

export function formatCups(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function formatGrams(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toFixed(1).replace(/\.0$/, '');
}
