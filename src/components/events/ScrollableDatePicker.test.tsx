import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ScrollableDatePicker } from "@/components/events/ScrollableDatePicker"

afterEach(cleanup)

describe("ScrollableDatePicker", () => {
  it("offers linked date wheels instead of a text field", () => {
    const onChange = vi.fn()

    render(<ScrollableDatePicker onChange={onChange} value="" />)

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getAllByRole("listbox")).toHaveLength(3)

    const dayWheel = screen.getByRole("listbox", { name: "Date day" })
    const choices = within(dayWheel).getAllByRole("option")
    expect(choices.length).toBeGreaterThan(20)

    fireEvent.click(choices[4])

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("shows each month once instead of repeating the same month for every date", () => {
    render(<ScrollableDatePicker onChange={vi.fn()} value="" />)

    const monthWheel = screen.getByRole("listbox", { name: "Date month" })
    const monthLabels = within(monthWheel)
      .getAllByRole("option")
      .map((option) => option.textContent)

    expect(new Set(monthLabels).size).toBe(monthLabels.length)
  })
})
