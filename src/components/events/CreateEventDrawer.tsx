import { FilePlus2 } from "lucide-react"
import { useState } from "react"
import { FileUpload } from "@/components/ui/file-upload"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { validateEventImage } from "@/lib/event-validation"
import type { EventDraft } from "@/types/events"

type CreateEventDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (draft: EventDraft) => void
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

export function CreateEventDrawer({
  open,
  onOpenChange,
  onCreate,
}: CreateEventDrawerProps) {
  const [draft, setDraft] = useState<EventDraft>(emptyDraft)
  const [imageError, setImageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const releasePreview = () => {
    if (draft.imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(draft.imagePreviewUrl)
    }
  }

  const resetDraft = (revokePreview: boolean) => {
    if (revokePreview) releasePreview()
    setDraft(emptyDraft())
    setImageError(null)
    setFormError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDraft(true)
    onOpenChange(nextOpen)
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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
    onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetContent className="drawer-content w-full sm:max-w-[480px]" side="right">
        <SheetHeader className="drawer-header px-6 pt-7">
          <SheetTitle className="drawer-title">Create an event</SheetTitle>
          <SheetDescription className="drawer-description">
            Give people the useful details and a picture that makes them want to show up.
          </SheetDescription>
        </SheetHeader>
        <form className="event-form px-6" onSubmit={handleSubmit}>
          <div className="event-form-grid">
            <label className="event-form-field event-form-field-full">
              <span className="event-form-label">Title</span>
              <Input
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="e.g. Sunday Sketch Club"
                value={draft.title}
              />
            </label>
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
            <label className="event-form-field">
              <span className="event-form-label">Date</span>
              <Input
                onChange={(event) => updateDraft("date", event.target.value)}
                placeholder="Saturday, 12 Sep"
                value={draft.date}
              />
            </label>
            <label className="event-form-field">
              <span className="event-form-label">Time</span>
              <Input
                onChange={(event) => updateDraft("time", event.target.value)}
                placeholder="4:00 PM - 8:00 PM"
                value={draft.time}
              />
            </label>
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
            Publish event
          </button>
        </form>
        <SheetFooter className="px-6 pb-7 pt-5">
          <p className="text-xs text-muted-foreground">This demo keeps new events in memory until refresh.</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

