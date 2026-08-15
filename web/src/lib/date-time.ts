export function formatEventDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
