import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HowItWorksCarousel } from "@/components/events/HowItWorksCarousel"
import { howItWorksSteps } from "@/data/events"

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  },
)

describe("HowItWorksCarousel", () => {
  it("keeps guide cards static when clicked", () => {
    render(<HowItWorksCarousel steps={howItWorksSteps} />)

    const cardTitle = screen.getByText(howItWorksSteps[0].title)
    const card = cardTitle.closest(".how-guide-card")
    expect(card).not.toBeNull()

    fireEvent.click(card as HTMLElement)

    expect(cardTitle.closest("button")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
