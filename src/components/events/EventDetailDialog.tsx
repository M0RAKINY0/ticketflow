import { X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useId, useRef } from "react"
import { useOutsideClick } from "@/hooks/use-outside-click"
import { EventBadge } from "@/components/events/EventBadge"
import { EventMedia } from "@/components/events/EventMedia"
import { EventMeta } from "@/components/events/EventMeta"
import { eventBadgeTone } from "@/components/events/event-badge-tone"
import type { Event } from "@/types/events"

type EventDetailDialogProps = {
  event: Event | null
  onClose: () => void
}

export function EventDetailDialog({ event, onClose }: EventDetailDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const close = useCallback(() => onClose(), [onClose])

  useOutsideClick(modalRef, close)

  useEffect(() => {
    if (!event) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") close()
    }
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [close, event])

  return (
    <AnimatePresence>
      {event ? (
        <div className="event-detail-overlay" role="presentation">
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-labelledby={titleId}
            aria-modal="true"
            className="event-detail-modal"
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            ref={modalRef}
            role="dialog"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="event-detail-image">
              <EventMedia alt={`${event.title} event`} src={event.imageSrc} />
            </div>
            <div className="event-detail-content">
              <button
                aria-label="Close event details"
                className="event-detail-close"
                onClick={close}
                ref={closeButtonRef}
                title="Close details"
                type="button"
              >
                <X aria-hidden="true" size={17} />
              </button>
              <EventBadge tone={eventBadgeTone(event.category)}>{event.category}</EventBadge>
              <h3 id={titleId}>{event.title}</h3>
              <p className="event-detail-description">{event.description}</p>
              <EventMeta className="event-detail-meta" event={event} includePrice />
              <div className="event-card-footer">
                <span className="event-price">Ready when you are.</span>
                <button className="event-action-button" onClick={close} type="button">
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
