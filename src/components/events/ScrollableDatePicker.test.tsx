import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScrollableDatePicker } from "@/components/events/ScrollableDatePicker"

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
})
