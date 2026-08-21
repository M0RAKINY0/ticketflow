import { describe, expect, it } from "vitest"
import { buildEventFromDraft } from "@/lib/event-draft"
import type { EventDraft } from "@/types/events"

const draft: EventDraft = {
  title: "Open Studio",
  category: "Workshop",
  date: "Saturday, 12 Sep",
  time: "2:00 PM - 4:00 PM",
  venue: "The Yard",
  city: "Lagos",
  description: "A low-pressure afternoon for making things.",
  priceLabel: "Free entry",
  imageFile: null,
  imagePreviewUrl: "blob:http://localhost/event-image",
}

describe("buildEventFromDraft", () => {
  it("turns a complete draft into an event", () => {
    expect(buildEventFromDraft(draft, "event-open-studio")).toEqual({
      id: "event-open-studio",
      title: "Open Studio",
      category: "Workshop",
      date: "Saturday, 12 Sep",
      time: "2:00 PM - 4:00 PM",
      venue: "The Yard",
      city: "Lagos",
      description: "A low-pressure afternoon for making things.",
      priceLabel: "Free entry",
      imageSrc: "blob:http://localhost/event-image",
    })
  })

  it("requires an image preview before creating an event", () => {
    expect(() =>
      buildEventFromDraft({ ...draft, imagePreviewUrl: null }, "event-missing-image"),
    ).toThrow("Add an event image before publishing.")
  })
})

