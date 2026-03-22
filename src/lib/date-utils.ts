// Parse 19hz date strings like "Sat: Mar 21" or "Fri: Apr 3" into Date objects
// Also handles multi-day like "Fri: Apr 10-Sun: Apr 12" (uses start date)
// And recurring like "1st Fridays" (not parseable to a specific date)

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function parseEventDate(dateStr: string): Date | null {
  // Handle multi-day: take the first date
  const firstPart = dateStr.split("-")[0].trim();

  // Match patterns like "Sat: Mar 21" or "Mar 21"
  const match = firstPart.match(/(?:\w+:\s*)?(\w{3})\s+(\d{1,2})/);
  if (!match) return null;

  const month = MONTHS[match[1]];
  if (month === undefined) return null;
  const day = parseInt(match[2]);

  const now = new Date();
  const year = now.getFullYear();

  // If the date would be more than 2 months in the past, assume next year
  const date = new Date(year, month, day);
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  if (date < twoMonthsAgo) {
    date.setFullYear(year + 1);
  }

  return date;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export function isWithinDays(eventDate: Date, fromDate: Date, days: number): boolean {
  const end = new Date(fromDate);
  end.setDate(end.getDate() + days);
  // Include events from today (start of day) through the end
  const startOfToday = new Date(fromDate);
  startOfToday.setHours(0, 0, 0, 0);
  return eventDate >= startOfToday && eventDate <= end;
}

export function formatDateHeader(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) return "today";
  if (isSameDay(date, tomorrow)) return "tomorrow";

  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}
