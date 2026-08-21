import { CalendarDays, Clock3, MapPin, Ticket } from "lucide-react"
import type { Event } from "@/types/events"

type EventMetaProps = {
  event: Event
  includePrice?: boolean
  className?: string
}

export function EventMeta({ event, includePrice = false, className = "" }: EventMetaProps) {
  return (
    <ul className={`event-meta-list ${className}`}>
      <li className="event-meta-item">
        <CalendarDays aria-hidden="true" size={14} />
        <span>{event.date}</span>
      </li>
      <li className="event-meta-item">
        <Clock3 aria-hidden="true" size={14} />
        <span>{event.time}</span>
      </li>
      <li className="event-meta-item">
        <MapPin aria-hidden="true" size={14} />
        <span>
          <strong>{event.venue}</strong>, {event.city}
        </span>
      </li>
      {includePrice ? (
        <li className="event-meta-item">
          <Ticket aria-hidden="true" size={14} />
          <span>{event.priceLabel}</span>
        </li>
      ) : null}
    </ul>
  )
}

