const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

export type EventImageValidation = {
  valid: boolean
  error: string | null
}

export function validateEventImage(file: File | null): EventImageValidation {
  if (!file) {
    return { valid: false, error: "Choose a JPG, PNG, or WebP image." }
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, error: "Use a JPG, PNG, or WebP image." }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { valid: false, error: "Images must be 5 MB or smaller." }
  }

  return { valid: true, error: null }
}

