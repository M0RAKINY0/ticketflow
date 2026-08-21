import { useCallback, useState } from "react"
import { EventActions } from "@/components/events/EventActions"
import { EventBadge } from "@/components/events/EventBadge"
import { EventDetailDialog } from "@/components/events/EventDetailDialog"
import { EventMedia } from "@/components/events/EventMedia"
import { EventMeta } from "@/components/events/EventMeta"
import { eventBadgeTone } from "@/components/events/event-badge-tone"
import type { Event } from "@/types/events"

type ExpandableEventCardProps = {
  event: Event
  onOpen?: (event: Event) => void
}

export function ExpandableEventCard({ event, onOpen }: ExpandableEventCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const close = useCallback(() => setIsOpen(false), [])
  const open = useCallback(() => {
    setIsOpen(true)
    onOpen?.(event)
  }, [event, onOpen])

  return (
    <>
      <article className="event-card">
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

      <EventDetailDialog event={isOpen ? event : null} onClose={close} />
    </>
  )
}
