import { Clock3 } from "lucide-react"
import { useMemo } from "react"
import { WheelColumn, type WheelOption } from "@/components/events/WheelColumn"

type ScrollableTimePickerProps = {
  value: string
  onChange: (value: string) => void
}

type TimeParts = {
  hour: string
  minute: string
  period: string
}

const DEFAULT_TIME: TimeParts = {
  hour: "12",
  minute: "00",
  period: "PM",
}

function parseTime(value: string): TimeParts {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return DEFAULT_TIME

  const hour = Number(match[1])
  const minute = Number(match[2])
  const roundedMinute = Math.round(minute / 5) * 5

  return {
    hour: hour >= 1 && hour <= 12 ? String(hour) : DEFAULT_TIME.hour,
    minute: String(roundedMinute === 60 ? 0 : roundedMinute).padStart(2, "0"),
    period: match[3].toUpperCase(),
  }
}

function formatTime(parts: TimeParts) {
  return `${parts.hour}:${parts.minute} ${parts.period}`
}

export function ScrollableTimePicker({ value, onChange }: ScrollableTimePickerProps) {
  const hours = useMemo<WheelOption[]>(
    () => Array.from({ length: 12 }, (_, index) => ({ label: String(index + 1), value: String(index + 1) })),
    [],
  )
  const minutes = useMemo<WheelOption[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const minute = String(index * 5).padStart(2, "0")
        return { label: minute, value: minute }
      }),
    [],
  )
  const periods = useMemo<WheelOption[]>(
    () => [
      { label: "AM", value: "AM" },
      { label: "PM", value: "PM" },
    ],
    [],
  )

  const parts = parseTime(value)
  const displayValue = formatTime(parts)
  const updatePart = (key: keyof TimeParts, nextValue: string) => {
    onChange(formatTime({ ...parts, [key]: nextValue }))
  }

  return (
    <div
      className="time-picker wheel-picker"
      data-empty={!value}
      role="group"
      aria-label="Choose an event time"
    >
      <div className="wheel-picker-frame">
        <div aria-hidden="true" className="wheel-picker-highlight" />
        <div className="wheel-picker-columns">
          <WheelColumn
            label="Time hour"
            onChange={(nextValue) => updatePart("hour", nextValue)}
            options={hours}
            value={parts.hour}
          />
          <WheelColumn
            label="Time minute"
            onChange={(nextValue) => updatePart("minute", nextValue)}
            options={minutes}
            value={parts.minute}
          />
          <WheelColumn
            label="Time period"
            onChange={(nextValue) => updatePart("period", nextValue)}
            options={periods}
            value={parts.period}
          />
        </div>
      </div>
      <p className="time-picker-selection">
        <Clock3 aria-hidden="true" size={14} />
        {value ? displayValue : "Choose a time from the clock"}
      </p>
    </div>
  )
}
