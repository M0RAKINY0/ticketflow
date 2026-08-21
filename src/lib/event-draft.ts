import type { Event, EventDraft } from "@/types/events"

export function buildEventFromDraft(draft: EventDraft, id: string): Event {
  if (!draft.imagePreviewUrl) {
    throw new Error("Add an event image before publishing.")
  }

  return {
    id,
    title: draft.title,
    category: draft.category,
    date: draft.date,
    time: draft.time,
    venue: draft.venue,
    city: draft.city,
    description: draft.description,
    priceLabel: draft.priceLabel,
    imageSrc: draft.imagePreviewUrl,
  }
}

