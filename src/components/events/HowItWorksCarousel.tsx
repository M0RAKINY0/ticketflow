import { Carousel, Card } from "@/components/ui/apple-cards-carousel"
import type { HowItWorksStep } from "@/types/events"

type HowItWorksCarouselProps = {
  steps: HowItWorksStep[]
}

export function HowItWorksCarousel({ steps }: HowItWorksCarouselProps) {
  const items = steps.map((step, index) => (
    <Card
      card={{
        category: step.stepLabel,
        content: (
          <div className="how-card-content">
            <p>{step.description}</p>
            <p>
              Keep the useful details close, then return to the guide when you are
              ready for the next plan.
            </p>
          </div>
        ),
        src: step.imageSrc,
        title: step.title,
      }}
      index={index}
      key={step.id}
      layout
    />
  ))

  return <Carousel items={items} />
}

