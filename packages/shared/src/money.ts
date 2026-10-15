/** All amounts are stored as integer cents to avoid floating point errors. */
export type Cents = number;

export function formatCents(amount: Cents, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100);
}

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}
