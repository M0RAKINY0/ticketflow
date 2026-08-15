export function formatCurrency(value: string | number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
}
