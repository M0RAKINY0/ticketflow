import { useState } from 'react';

import type { EventCategory } from './event-types';

const labels: Record<EventCategory, string> = { MUSIC: 'Music', BUSINESS: 'Business', TECHNOLOGY: 'Technology', ARTS_CULTURE: 'Arts & culture', FOOD_DRINK: 'Food & drink', SPORTS_FITNESS: 'Sports & fitness', COMMUNITY: 'Community', EDUCATION: 'Education', OTHER: 'Event' };

export function EventCover({ category, title, url }: { category: EventCategory; title: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <div className={`event-cover event-cover--${category.toLowerCase()}`} aria-label={`${labels[category]} event cover`}><span>{labels[category]}</span></div>;
  return <div className="event-cover"><img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /><span className="sr-only">Cover for {title}</span></div>;
}
