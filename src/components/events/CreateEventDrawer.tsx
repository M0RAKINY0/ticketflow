import { CreateEventForm } from "@/components/events/CreateEventForm"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { EventDraft } from "@/types/events"

type CreateEventDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (draft: EventDraft) => void
}

export function CreateEventDrawer({
  open,
  onOpenChange,
  onCreate,
}: CreateEventDrawerProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="drawer-content w-full sm:max-w-[480px]" side="right">
        <SheetHeader className="drawer-header px-6 pt-7">
          <SheetTitle className="drawer-title">Create an event</SheetTitle>
          <SheetDescription className="drawer-description">
            Give people the useful details and a picture that makes them want to show up.
          </SheetDescription>
        </SheetHeader>
        <CreateEventForm
          className="px-6"
          onComplete={() => onOpenChange(false)}
          onCreate={onCreate}
        />
        <SheetFooter className="px-6 pb-7 pt-5">
          <p className="text-xs text-muted-foreground">This demo keeps new events in memory until refresh.</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
