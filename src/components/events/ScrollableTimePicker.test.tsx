import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ScrollableTimePicker } from "@/components/events/ScrollableTimePicker"

afterEach(cleanup)

describe("ScrollableTimePicker", () => {
  it("composes a wheel time instead of a text field", () => {
    const onChange = vi.fn()

    render(<ScrollableTimePicker onChange={onChange} value="" />)

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getAllByRole("listbox")).toHaveLength(3)

    const hourWheel = screen.getByRole("listbox", { name: "Time hour" })
    fireEvent.click(within(hourWheel).getByRole("option", { name: "4" }))

    expect(onChange).toHaveBeenLastCalledWith("4:00 PM")
  })

  it("responds to keyboard movement", () => {
    const onChange = vi.fn()

    render(<ScrollableTimePicker onChange={onChange} value="4:00 PM" />)

    fireEvent.keyDown(screen.getByRole("listbox", { name: "Time minute" }), {
      key: "ArrowDown",
    })

    expect(onChange).toHaveBeenLastCalledWith("4:05 PM")
  })
})
