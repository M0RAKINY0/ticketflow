import { ArrowDown, ArrowUpRight, Plus } from "lucide-react"
import { useState } from "react"
import "./App.css"
import { AnimatedEventHero } from "@/components/events/AnimatedEventHero"
import { CreateEventDrawer } from "@/components/events/CreateEventDrawer"
import { EventDetailDialog } from "@/components/events/EventDetailDialog"
import { ExpandableEventCard } from "@/components/events/ExpandableEventCard"
import { HowItWorksCarousel } from "@/components/events/HowItWorksCarousel"
import { howItWorksSteps, demoEvents } from "@/data/events"
import { buildEventFromDraft } from "@/lib/event-draft"
import type { Event, EventDraft } from "@/types/events"

function App() {
  const [events, setEvents] = useState<Event[]>(demoEvents)
  const [activeEventId, setActiveEventId] = useState(demoEvents[0].id)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const handleCreate = (draft: EventDraft) => {
    const event = buildEventFromDraft(draft, `event-${crypto.randomUUID()}`)
    setEvents((previousEvents) => [...previousEvents, event])
    setActiveEventId(event.id)
  }

  return (
    <div className="events-app" id="top">
      <header className="site-header">
        <div className="nav-wrap">
          <a className="brand-lockup" href="#top" aria-label="Events home">
            <span aria-hidden="true" className="brand-mark" />
            <span>Events</span>
          </a>
          <nav aria-label="Primary navigation" className="nav-links">
            <a className="nav-link" href="#browse-plans">
              Browse plans
            </a>
            <a className="nav-link" href="#how-it-works">
              How it works
            </a>
            <button
              aria-label="Create event"
              className="nav-create"
              onClick={() => setIsCreateOpen(true)}
              title="Create event"
              type="button"
            >
              <Plus aria-hidden="true" size={15} />
              <span className="nav-create-label">Create event</span>
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-title" className="main-shell hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Your city, in motion</p>
            <h1 className="hero-title" id="hero-title">
              Find a good <span className="title-accent">plan.</span>
            </h1>
            <p className="hero-lede">
              A bright, local guide to the gatherings worth leaving the house for.
              Browse what is next, open the useful bits, and make the next plan yours.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#browse-plans">
                See what is on <ArrowDown aria-hidden="true" size={16} />
              </a>
              <button className="secondary-button" onClick={() => setIsCreateOpen(true)} type="button">
                Bring a plan <Plus aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="hero-proof">
              <span aria-hidden="true" className="proof-dots">
                <span className="proof-dot" />
                <span className="proof-dot" />
                <span className="proof-dot" />
              </span>
              <span>Local plans, clear details, no endless scrolling.</span>
            </div>
          </div>

          <div className="hero-stage">
            <AnimatedEventHero
              activeEventId={activeEventId}
              autoplay
              events={events}
              onActiveChange={setActiveEventId}
              onOpen={setSelectedEvent}
            />
          </div>
        </section>

        <section className="section-band" id="browse-plans">
          <div className="main-shell section-shell">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Browse more plans</p>
                <h2 className="section-title">Make room for something different.</h2>
              </div>
              <p className="section-intro">
                Small gatherings, good streets, and a reason to put the phone down. Open a card for the full picture.
              </p>
            </div>
            <div className="event-grid">
              {events.map((event) => (
                <ExpandableEventCard event={event} key={event.id} />
              ))}
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="main-shell section-shell">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">How it works</p>
                <h2 className="section-title">Three moves from curious to committed.</h2>
              </div>
              <p className="section-intro how-intro">
                The path is short on purpose. Discover the feeling, check the details, then share what you know.
              </p>
            </div>
            <div className="how-carousel-shell">
              <HowItWorksCarousel steps={howItWorksSteps} />
            </div>
            <div className="how-carousel-note">
              <span>
                <strong>Swipe or use the arrows</strong> to move through the guide.
              </span>
              <span>Tap a card to see the step in full.</span>
            </div>
          </div>
        </section>

        <section className="create-band" id="create-event">
          <div className="main-shell section-shell create-layout">
            <div className="create-copy">
              <p className="section-kicker">Put it on the map</p>
              <h2 className="section-title">Your next good idea deserves a place to land.</h2>
              <p>
                Add the image, name the place, and make it easy for the right people to find you. Your new event appears in this guide immediately.
              </p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => setIsCreateOpen(true)} type="button">
                  Create an event <ArrowUpRight aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
            <div aria-label="Events overview" className="create-stats">
              <div className="stat-tile">
                <strong>{events.length}</strong>
                <span>plans in this local guide</span>
              </div>
              <div className="stat-tile">
                <strong>01</strong>
                <span>clear next step from every card</span>
              </div>
              <div className="stat-tile">
                <strong>05MB</strong>
                <span>image size for a quick publish</span>
              </div>
              <div className="stat-tile">
                <strong>∞</strong>
                <span>reasons to leave the house</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="main-shell footer-row">
          <div>
            <h2 className="footer-title">Events</h2>
            <p className="footer-note">A local guide for plans worth making.</p>
          </div>
          <div className="footer-links">
            <a className="footer-link" href="#browse-plans">
              Browse
            </a>
            <a className="footer-link" href="#how-it-works">
              How it works
            </a>
            <button className="footer-link" onClick={() => setIsCreateOpen(true)} type="button">
              Create
            </button>
          </div>
        </div>
      </footer>

      <CreateEventDrawer
        onCreate={handleCreate}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />
      <EventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}

export default App
