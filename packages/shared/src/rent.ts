/**
 * Returns the due date (YYYY-MM-DD) for a lease's rent in a given month.
 * A due day past the end of a short month falls on that month's last day,
 * so a lease due on the 31st is due on Feb 28 (or 29).
 */
export function rentDueDate(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(dueDay, 1), lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A charge is late once the grace period after its due date has passed. */
export function isRentLate(dueDate: string, graceDays: number, today: string): boolean {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return now > due + graceDays * 86_400_000;
}
