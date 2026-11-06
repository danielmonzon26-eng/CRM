/** Money is added in whole cents, so totals can't pick up floating-point errors. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function addCents(values: number[]): number {
  return values.reduce((sum, value) => sum + toCents(value), 0);
}

export function sumMoney(values: number[]): number {
  return fromCents(addCents(values));
}

const formatter = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const wholeFormatter = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function formatMoney(value: number): string {
  return Number.isInteger(value) ? wholeFormatter.format(value) : formatter.format(value);
}
