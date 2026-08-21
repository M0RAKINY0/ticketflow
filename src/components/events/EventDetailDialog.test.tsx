import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EventDetailDialog } from "@/components/events/EventDetailDialog"
import { demoEvents } from "@/data/events"

describe("EventDetailDialog", () => {
  it("sends the selected event to the reserve action", () => {
    const onReserve = vi.fn()

    render(
      <EventDetailDialog
        event={demoEvents[0]}
        onClose={vi.fn()}
        onReserve={onReserve}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Reserve event" }))

    expect(onReserve).toHaveBeenCalledWith(demoEvents[0])
  })
})
