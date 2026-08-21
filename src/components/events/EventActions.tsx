import { ArrowUpRight } from "lucide-react"
import type { Event } from "@/types/events"

type EventActionsProps = {
  event: Event
  onOpen: (event: Event) => void
  label?: string
}

export function EventActions({ event, onOpen, label = "Open details" }: EventActionsProps) {
  return (
    <div className="event-card-actions">
      <button
        className="event-action-button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation()
          onOpen(event)
        }}
        type="button"
      >
        {label} <ArrowUpRight aria-hidden="true" size={14} />
      </button>
    </div>
  )
}
