import { EventActions } from "@/components/events/EventActions"
import { EventBadge } from "@/components/events/EventBadge"
import { EventMedia } from "@/components/events/EventMedia"
import { EventMeta } from "@/components/events/EventMeta"
import { eventBadgeTone } from "@/components/events/event-badge-tone"
import type { Event } from "@/types/events"

type ExpandableEventCardProps = {
  event: Event
  onOpen: (event: Event) => void
}

export function ExpandableEventCard({ event, onOpen }: ExpandableEventCardProps) {
  const open = () => onOpen(event)
  const handleKeyDown = (keyboardEvent: React.KeyboardEvent<HTMLElement>) => {
    if (keyboardEvent.target !== keyboardEvent.currentTarget) return
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault()
      open()
    }
  }

  return (
    <article
      aria-label={`Open details for ${event.title}`}
      className="event-card"
      onClick={open}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
        <div className="event-card-media">
          <EventMedia alt={`${event.title} event`} src={event.imageSrc} />
          <EventBadge className="event-card-badge" tone={eventBadgeTone(event.category)}>
            {event.category}
          </EventBadge>
        </div>
        <div className="event-card-body">
          <h3 className="event-card-title">{event.title}</h3>
          <EventMeta event={event} />
          <div className="event-card-footer">
            <span className="event-price">{event.priceLabel}</span>
            <EventActions event={event} onOpen={open} />
          </div>
        </div>
    </article>
  )
}
