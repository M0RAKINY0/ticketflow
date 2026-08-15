import type { DiscoveryFilters, EventCategory } from './event-types';

const categories = new Set<EventCategory>(['MUSIC', 'BUSINESS', 'TECHNOLOGY', 'ARTS_CULTURE', 'FOOD_DRINK', 'SPORTS_FITNESS', 'COMMUNITY', 'EDUCATION', 'OTHER']);

export function readDiscoveryFilters(params: URLSearchParams): DiscoveryFilters {
  const category = params.get('category') as EventCategory | null;
  const page = Number(params.get('page'));
  return {
    ...(params.get('q')?.trim() ? { q: params.get('q')!.trim() } : {}),
    ...(category && categories.has(category) ? { category } : {}),
    ...(params.get('from') ? { from: params.get('from')! } : {}),
    ...(params.get('to') ? { to: params.get('to')! } : {}),
    ...(params.get('country')?.trim() ? { country: params.get('country')!.trim().toUpperCase() } : {}),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function eventQueryString(filters: DiscoveryFilters): string {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: '12' });
  if (filters.q) params.set('query', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.country) params.set('countryCode', filters.country);
  return params.toString();
}
