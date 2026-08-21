import { FilePlus2 } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { ScrollableDatePicker } from "@/components/events/ScrollableDatePicker"
import { ScrollableTimePicker } from "@/components/events/ScrollableTimePicker"
import { FileUpload } from "@/components/ui/file-upload"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { validateEventImage } from "@/lib/event-validation"
import type { EventDraft } from "@/types/events"

type CreateEventFormProps = {
  className?: string
  onComplete?: () => void
  onCreate: (draft: EventDraft) => void
  submitLabel?: string
}

function emptyDraft(): EventDraft {
  return {
    title: "",
    category: "Markets",
    date: "",
    time: "",
    venue: "",
    city: "Lagos",
    description: "",
    priceLabel: "Free entry",
    imageFile: null,
    imagePreviewUrl: null,
  }
}

export function CreateEventForm({
  className = "",
  onComplete,
  onCreate,
  submitLabel = "Publish event",
}: CreateEventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(emptyDraft)
  const [imageError, setImageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    return () => {
      const previewUrl = draftRef.current.imagePreviewUrl
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

  const releasePreview = () => {
    if (draft.imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(draft.imagePreviewUrl)
    }
  }

  const updateDraft = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }))
    setFormError(null)
  }

  const handleFiles = (files: File[]) => {
    const file = files[0]
    if (!file) return

    const validation = validateEventImage(file)
    if (!validation.valid) {
      setImageError(validation.error)
      return
    }

    releasePreview()
    setDraft((previous) => ({
      ...previous,
      imageFile: file,
      imagePreviewUrl: URL.createObjectURL(file),
    }))
    setImageError(null)
    setFormError(null)
  }

  const handleRemoveImage = () => {
    releasePreview()
    setDraft((previous) => ({ ...previous, imageFile: null, imagePreviewUrl: null }))
    setImageError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const requiredFields: Array<[keyof EventDraft, string]> = [
      ["title", "Add a title."],
      ["date", "Add a date."],
      ["time", "Add a time."],
      ["venue", "Add a venue."],
      ["description", "Add a short description."],
    ]
    const missingField = requiredFields.find(([key]) => !draft[key])

    if (missingField) {
      setFormError(missingField[1])
      return
    }

    const imageValidation = validateEventImage(draft.imageFile)
    if (!imageValidation.valid || !draft.imagePreviewUrl) {
      setImageError(imageValidation.error ?? "Add an event image before publishing.")
      return
    }

    onCreate(draft)
    setDraft(emptyDraft())
    setImageError(null)
    setFormError(null)
    onComplete?.()
  }

  return (
    <form className={`event-form ${className}`} onSubmit={handleSubmit}>
      <div className="event-form-grid">
        <label className="event-form-field event-form-field-full">
          <span className="event-form-label">Title</span>
          <Input
            onChange={(event) => updateDraft("title", event.target.value)}
            placeholder="e.g. Sunday Sketch Club"
            value={draft.title}
          />
        </label>
        <fieldset aria-label="Event basics" className="event-form-paired-fields event-form-field-full">
          <label className="event-form-field">
            <span className="event-form-label">Category</span>
            <select
              aria-label="Category"
              onChange={(event) => updateDraft("category", event.target.value)}
              value={draft.category}
            >
              <option>Markets</option>
              <option>Film</option>
              <option>Workshop</option>
              <option>Music + Food</option>
              <option>Walks</option>
              <option>Other</option>
            </select>
          </label>
          <label className="event-form-field">
            <span className="event-form-label">Price label</span>
            <Input
              onChange={(event) => updateDraft("priceLabel", event.target.value)}
              placeholder="Free entry"
              value={draft.priceLabel}
            />
          </label>
        </fieldset>
        <fieldset aria-label="Event timing" className="event-form-paired-fields event-form-field-full">
          <div className="event-form-field">
            <span className="event-form-label">Date</span>
            <ScrollableDatePicker onChange={(value) => updateDraft("date", value)} value={draft.date} />
          </div>
          <div className="event-form-field">
            <span className="event-form-label">Time</span>
            <ScrollableTimePicker onChange={(value) => updateDraft("time", value)} value={draft.time} />
          </div>
        </fieldset>
        <label className="event-form-field event-form-field-full">
          <span className="event-form-label">Venue</span>
          <Input
            onChange={(event) => updateDraft("venue", event.target.value)}
            placeholder="The name of the place"
            value={draft.venue}
          />
        </label>
        <label className="event-form-field">
          <span className="event-form-label">City</span>
          <Input
            onChange={(event) => updateDraft("city", event.target.value)}
            placeholder="Lagos"
            value={draft.city}
          />
        </label>
        <label className="event-form-field event-form-field-full">
          <span className="event-form-label">Description</span>
          <Textarea
            onChange={(event) => updateDraft("description", event.target.value)}
            placeholder="What should people know about the feeling of this event?"
            value={draft.description}
          />
        </label>
      </div>

      <div className="event-form-field">
        <span className="event-form-label">Event image</span>
        <FileUpload
          error={imageError}
          files={draft.imageFile ? [draft.imageFile] : []}
          onChange={handleFiles}
          onRemove={handleRemoveImage}
          previewUrl={draft.imagePreviewUrl}
        />
      </div>

      {formError ? <p className="form-error">{formError}</p> : null}

      <button className="primary-button form-submit" type="submit">
        <FilePlus2 aria-hidden="true" size={16} />
        {submitLabel}
      </button>
    </form>
  )
}
