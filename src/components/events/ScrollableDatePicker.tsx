import { CalendarDays } from "lucide-react"
import { useMemo } from "react"
import { WheelColumn, type WheelOption } from "@/components/events/WheelColumn"

type ScrollableDatePickerProps = {
  value: string
  onChange: (value: string) => void
}

type DateOption = {
  value: string
  weekday: string
  day: string
  month: string
  monthKey: string
}

export function ScrollableDatePicker({ value, onChange }: ScrollableDatePickerProps) {
  const options = useMemo<DateOption[]>(() => {
    const start = new Date()
    start.setHours(12, 0, 0, 0)

    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)

      return {
        value: new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "short",
          weekday: "long",
        }).format(date),
        weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
        day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
        month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      }
    })
  }, [])

  const displayValue = value || options[0]?.value || ""
  const selectedDate = options.find((option) => option.value === displayValue) ?? options[0]
  if (!selectedDate) return null

  const weekdayOptions: WheelOption[] = options.map((option) => ({
    label: option.weekday,
    value: option.value,
  }))
  const dayOptions: WheelOption[] = options.map((option) => ({
    label: option.day,
    value: option.value,
  }))
  const monthOptions: WheelOption[] = Array.from(
    new Map(
      options.map((option) => [
        option.monthKey,
        { label: option.month, value: option.monthKey },
      ]),
    ).values(),
  )

  const handleMonthChange = (monthKey: string) => {
    const matchingDay = options.find(
      (option) => option.monthKey === monthKey && option.day === selectedDate.day,
    )
    const fallback = options.find((option) => option.monthKey === monthKey)
    onChange((matchingDay ?? fallback ?? selectedDate).value)
  }

  return (
    <div
      className="date-picker wheel-picker"
      data-empty={!value}
      role="group"
      aria-label="Choose an event date"
    >
      <div className="wheel-picker-frame">
        <div aria-hidden="true" className="wheel-picker-highlight" />
        <div className="wheel-picker-columns">
          <WheelColumn
            label="Date weekday"
            onChange={onChange}
            options={weekdayOptions}
            value={displayValue}
          />
          <WheelColumn
            label="Date day"
            onChange={onChange}
            options={dayOptions}
            value={displayValue}
          />
          <WheelColumn
            label="Date month"
            onChange={handleMonthChange}
            options={monthOptions}
            value={selectedDate.monthKey}
          />
        </div>
      </div>
      <p className="date-picker-selection">
        <CalendarDays aria-hidden="true" size={14} />
        {value || "Choose a date from the calendar"}
      </p>
    </div>
  )
}
