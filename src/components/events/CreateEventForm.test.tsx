import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CreateEventForm } from "@/components/events/CreateEventForm"

describe("CreateEventForm layout groups", () => {
  it("keeps basics and timing in compact paired groups", () => {
    render(<CreateEventForm onCreate={vi.fn()} />)

    const basics = screen.getByRole("group", { name: "Event basics" })
    const timing = screen.getByRole("group", { name: "Event timing" })

    expect(basics.contains(screen.getByLabelText("Category"))).toBe(true)
    expect(basics.contains(screen.getByLabelText("Price label"))).toBe(true)
    expect(timing.contains(screen.getByRole("listbox", { name: "Date weekday" }))).toBe(true)
    expect(timing.contains(screen.getByRole("listbox", { name: "Time hour" }))).toBe(true)
  })
})
