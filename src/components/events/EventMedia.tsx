type EventMediaProps = {
  src: string
  alt: string
  className?: string
}

export function EventMedia({ src, alt, className = "" }: EventMediaProps) {
  return (
    <img
      alt={alt}
      className={`event-media-image ${className}`}
      height={640}
      loading="lazy"
      src={src}
      width={860}
    />
  )
}

