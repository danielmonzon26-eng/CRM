/** Budgets run on calendar quarters. Months are first-of-month dates, like 2027-01-01. */
export function quarterOf(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${year}-Q${Math.ceil(m / 3)}`;
}

export function quarterLabel(quarter: string): string {
  const [year, q] = quarter.split("-");
  return `${q} ${year}`;
}

export function nextMonth(month: string): string {
  const date = new Date(`${month}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.toISOString().slice(0, 7)}-01`;
}

export function quarterMonths(quarter: string): string[] {
  const [year, q] = quarter.split("-Q").map(Number);
  return [0, 1, 2].map((i) => `${year}-${String((q - 1) * 3 + 1 + i).padStart(2, "0")}-01`);
}

/** The months that complete the next quarter after a budget's last month. */
export function monthsToAddForNextQuarter(lastMonth: string): { quarter: string; months: string[] } {
  const first = nextMonth(lastMonth);
  const quarter = quarterOf(first);
  return { quarter, months: quarterMonths(quarter).filter((m) => m >= first) };
}

/** Quarters from the start of last year through three years ahead, for building a budget. */
export function quarterOptions(year: number): string[] {
  return Array.from({ length: 5 }, (_, y) => [1, 2, 3, 4].map((q) => `${year - 1 + y}-Q${q}`)).flat();
}
