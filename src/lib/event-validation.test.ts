import { describe, expect, it } from "vitest"
import { validateEventImage } from "@/lib/event-validation"

const createFile = (type: string, size: number) =>
  new File([new Uint8Array(size)], "event-image.png", { type })

describe("validateEventImage", () => {
  it("accepts a supported image below the size limit", () => {
    expect(validateEventImage(createFile("image/png", 1024))).toEqual({
      valid: true,
      error: null,
    })
  })

  it("rejects unsupported image formats", () => {
    expect(validateEventImage(createFile("image/gif", 1024))).toEqual({
      valid: false,
      error: "Use a JPG, PNG, or WebP image.",
    })
  })

  it("rejects images larger than five megabytes", () => {
    expect(validateEventImage(createFile("image/jpeg", 5 * 1024 * 1024 + 1))).toEqual({
      valid: false,
      error: "Images must be 5 MB or smaller.",
    })
  })
})
