"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react"

export type AnimatedTestimonial = {
  quote: string
  name: string
  designation: string
  src: string
}

type AnimatedTestimonialsProps = {
  testimonials: AnimatedTestimonial[]
  autoplay?: boolean
  autoplayDelay?: number
  activeIndex?: number
  onActiveChange?: (index: number) => void
  pauseOnHover?: boolean
  className?: string
  ariaLabel?: string
}

export const AnimatedTestimonials = ({
  testimonials,
  autoplay = false,
  autoplayDelay = 5000,
  activeIndex,
  onActiveChange,
  pauseOnHover = true,
  className = "",
  ariaLabel = "Animated testimonials",
}: AnimatedTestimonialsProps) => {
  const [internalActive, setInternalActive] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const reducedMotion = useReducedMotion()
  const rotations = useMemo(
    () => testimonials.map((_, index) => ((index * 7) % 17) - 8),
    [testimonials],
  )

  const active = activeIndex === undefined
    ? Math.min(internalActive, Math.max(testimonials.length - 1, 0))
    : Math.min(activeIndex, Math.max(testimonials.length - 1, 0))

  const updateActive = useCallback(
    (next: number) => {
      if (testimonials.length === 0) return
      const normalized = (next + testimonials.length) % testimonials.length
      if (activeIndex === undefined) setInternalActive(normalized)
      onActiveChange?.(normalized)
    },
    [activeIndex, onActiveChange, testimonials.length],
  )

  const handleNext = useCallback(() => {
    updateActive(active + 1)
  }, [active, updateActive])

  const handlePrev = useCallback(() => {
    updateActive(active - 1)
  }, [active, updateActive])

  useEffect(() => {
    if (!autoplay || isPaused || reducedMotion || testimonials.length < 2) {
      return undefined
    }

    const interval = window.setInterval(handleNext, autoplayDelay)
    return () => window.clearInterval(interval)
  }, [autoplay, autoplayDelay, handleNext, isPaused, reducedMotion, testimonials.length])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault()
      handleNext()
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      handlePrev()
    }
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (
      pauseOnHover &&
      !(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
    ) {
      setIsPaused(false)
    }
  }

  if (testimonials.length === 0) return null

  return (
    <div
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={`mx-auto max-w-sm px-4 py-20 font-sans antialiased md:max-w-4xl md:px-8 lg:px-12 ${className}`}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      onBlur={handleBlur}
      onFocus={() => pauseOnHover && setIsPaused(true)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      role="region"
      tabIndex={0}
    >
      <div className="relative grid grid-cols-1 gap-20 md:grid-cols-2">
        <div>
          <div className="event-testimonial-image-wrap relative h-80 w-full">
            <AnimatePresence initial={false}>
              {testimonials.map((testimonial, index) => (
                <motion.div
                  animate={{
                    opacity: index === active ? 1 : 0.7,
                    scale: index === active ? 1 : 0.95,
                    z: index === active ? 0 : -100,
                    rotate: index === active ? 0 : rotations[index],
                    zIndex: index === active ? 40 : testimonials.length + 2 - index,
                    y: reducedMotion || index !== active ? 0 : [0, -12, 0],
                  }}
                  className="event-testimonial-image-layer absolute inset-0 origin-bottom"
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    z: 100,
                    rotate: reducedMotion ? 0 : rotations[index],
                  }}
                  initial={{
                    opacity: 0,
                    scale: reducedMotion ? 1 : 0.9,
                    z: reducedMotion ? 0 : -100,
                    rotate: reducedMotion ? 0 : rotations[index],
                  }}
                  key={testimonial.src}
                  transition={{
                    duration: reducedMotion ? 0 : 0.4,
                    ease: "easeInOut",
                  }}
                >
                  <img
                    alt={testimonial.name}
                    className="event-testimonial-image h-full w-full rounded-3xl object-cover object-center"
                    draggable={false}
                    height={500}
                    src={testimonial.src}
                    width={500}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <div className="event-testimonial-copy flex flex-col justify-between py-4">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: reducedMotion ? 0 : -20, opacity: 0 }}
              initial={{ y: reducedMotion ? 0 : 20, opacity: 0 }}
              key={active}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeInOut" }}
            >
              <h3 className="event-testimonial-title text-2xl font-bold text-black dark:text-white">
                {testimonials[active].name}
              </h3>
              <p className="event-testimonial-meta text-sm text-gray-500 dark:text-neutral-500">
                {testimonials[active].designation}
              </p>
              <motion.p className="event-testimonial-description mt-8 text-lg text-gray-500 dark:text-neutral-300">
                {testimonials[active].quote.split(" ").map((word, index) => (
                  <motion.span
                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                    className="inline-block"
                    initial={{
                      filter: reducedMotion ? "blur(0px)" : "blur(10px)",
                      opacity: 0,
                      y: reducedMotion ? 0 : 5,
                    }}
                    key={`${word}-${index}`}
                    transition={{
                      duration: reducedMotion ? 0 : 0.2,
                      ease: "easeInOut",
                      delay: reducedMotion ? 0 : 0.02 * index,
                    }}
                  >
                    {word}{" "}
                  </motion.span>
                ))}
              </motion.p>
            </motion.div>
          </AnimatePresence>
          <div className="event-hero-controls flex gap-4 pt-12 md:pt-0">
            <button
              aria-label="Previous event"
              className="hero-arrow group/button flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800"
              onClick={handlePrev}
              type="button"
            >
              <ArrowLeft className="h-5 w-5 transition-transform duration-300 group-hover/button:rotate-12" />
            </button>
            <button
              aria-label="Next event"
              className="hero-arrow group/button flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800"
              onClick={handleNext}
              type="button"
            >
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover/button:-rotate-12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
