import { ArrowUpRight } from "lucide-react"
import { useMemo } from "react"
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials"
import type { Event } from "@/types/events"

type AnimatedEventHeroProps = {
  events: Event[]
  activeEventId: string
  onActiveChange: (eventId: string) => void
  onOpen: (event: Event) => void
  autoplay?: boolean
}

export function AnimatedEventHero({
  events,
  activeEventId,
  onActiveChange,
  onOpen,
  autoplay = true,
}: AnimatedEventHeroProps) {
  const activeIndex = Math.max(
    events.findIndex((event) => event.id === activeEventId),
    0,
  )
  const activeEvent = events[activeIndex]
  const testimonials = useMemo(
    () =>
      events.map((event) => ({
        quote: event.description,
        name: event.title,
        designation: `${event.category} / ${event.city}`,
        src: event.imageSrc,
      })),
    [events],
  )

  if (!activeEvent) return null

  return (
    <div className="event-hero-panel">
      <AnimatedTestimonials
        activeIndex={activeIndex}
        ariaLabel="Featured events"
        autoplay={autoplay}
        className="event-animated-testimonials"
        onActiveChange={(index) => onActiveChange(events[index].id)}
        testimonials={testimonials}
      />
      <div className="hero-indicators" role="tablist" aria-label="Featured events">
        {events.map((event, index) => (
          <button
            aria-label={`Show ${event.title}`}
            aria-selected={index === activeIndex}
            className="hero-dot"
            data-active={index === activeIndex}
            key={event.id}
            onClick={() => onActiveChange(event.id)}
            role="tab"
            type="button"
          />
        ))}
      </div>
      <div className="hero-utility">
        <span>
          <strong>{activeEvent.date}</strong> · {activeEvent.time}
        </span>
        <button
          className="event-action-button"
          onClick={() => onOpen(activeEvent)}
          type="button"
        >
          View details <ArrowUpRight aria-hidden="true" size={14} />
        </button>
      </div>
      <div className="hero-utility">
        <span className="hero-utility-status">
          {activeEvent.venue}, {activeEvent.city}
        </span>
        <span>
          {String(activeIndex + 1).padStart(2, "0")} / {String(events.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  )
}

