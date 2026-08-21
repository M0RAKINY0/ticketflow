type EventBadgeProps = {
  children: string
  tone?: "default" | "accent" | "primary"
  className?: string
}

export function EventBadge({
  children,
  tone = "default",
  className = "",
}: EventBadgeProps) {
  return (
    <span className={`event-badge ${className}`} data-tone={tone}>
      {children}
    </span>
  )
}
