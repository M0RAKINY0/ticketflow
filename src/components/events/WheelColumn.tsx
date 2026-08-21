import { useEffect, useRef, useId } from "react"

export const WHEEL_ROW_HEIGHT = 40

export type WheelOption = {
  value: string
  label: string
}

type WheelColumnProps = {
  label: string
  onChange: (value: string) => void
  options: WheelOption[]
  value: string
}

export function WheelColumn({ label, onChange, options, value }: WheelColumnProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const optionId = useId()
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  )

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const top = index * WHEEL_ROW_HEIGHT
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ behavior, top })
    } else {
      scroller.scrollTop = top
    }
  }

  useEffect(() => {
    scrollToIndex(selectedIndex, "auto")
  }, [selectedIndex])

  const handleChange = (index: number) => {
    const option = options[index]
    if (!option) return

    onChange(option.value)
    scrollToIndex(index)
  }

  const handleScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(scroller.scrollTop / WHEEL_ROW_HEIGHT)),
    )
    const nextOption = options[nextIndex]
    if (nextOption && nextOption.value !== value) {
      onChange(nextOption.value)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null

    if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, selectedIndex + 1)
    if (event.key === "ArrowUp") nextIndex = Math.max(0, selectedIndex - 1)
    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = options.length - 1

    if (nextIndex === null || nextIndex === selectedIndex) return

    event.preventDefault()
    handleChange(nextIndex)
  }

  return (
    <div className="wheel-column">
      <div
        aria-label={label}
        aria-orientation="vertical"
        className="wheel-scroller"
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        ref={scrollerRef}
        role="listbox"
        tabIndex={0}
      >
        <div aria-hidden="true" className="wheel-spacer" />
        {options.map((option, index) => (
          <button
            aria-selected={index === selectedIndex}
            className="wheel-option"
            data-selected={index === selectedIndex}
            id={`${optionId}-${index}`}
            key={`${option.value}-${index}`}
            onClick={() => handleChange(index)}
            role="option"
            tabIndex={index === selectedIndex ? 0 : -1}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <div aria-hidden="true" className="wheel-spacer" />
      </div>
    </div>
  )
}
