import { createContext } from "react"

export const CarouselContext = createContext<{
  onCardClose: (index: number) => void
  currentIndex: number
}>({
  onCardClose: () => undefined,
  currentIndex: 0,
})

