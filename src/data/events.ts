import type { Event, HowItWorksStep } from "@/types/events"

export const demoEvents: Event[] = [
  {
    id: "night-market-after-dark",
    title: "Night Market After Dark",
    category: "Markets",
    date: "Friday, 28 Aug",
    time: "6:30 PM - 10:00 PM",
    venue: "Harbor Square",
    city: "Lagos",
    description:
      "A late-night loop of small plates, independent makers, and warm live sets by the water.",
    priceLabel: "Free entry",
    imageSrc: "/events/night-market.png",
  },
  {
    id: "rooftop-cinema-sunlit",
    title: "Rooftop Cinema: Sunlit",
    category: "Film",
    date: "Saturday, 29 Aug",
    time: "7:00 PM - 10:15 PM",
    venue: "Skyline House",
    city: "Lagos",
    description:
      "An open-air film night with city views, shared snacks, and a hand-picked summer double bill.",
    priceLabel: "From NGN 8,000",
    imageSrc: "/events/rooftop-cinema.png",
  },
  {
    id: "clay-after-hours",
    title: "Clay After Hours",
    category: "Workshop",
    date: "Sunday, 30 Aug",
    time: "11:00 AM - 1:30 PM",
    venue: "Makers Yard",
    city: "Lagos",
    description:
      "Shape a small set of hand-built ceramics with a patient guide and a room full of curious people.",
    priceLabel: "From NGN 18,500",
    imageSrc: "/events/ceramics-club.png",
  },
  {
    id: "street-sessions",
    title: "Street Sessions",
    category: "Music + Food",
    date: "Saturday, 05 Sep",
    time: "4:00 PM - 9:00 PM",
    venue: "Palm Grove Lane",
    city: "Lagos",
    description:
      "A neighbourhood block party with rotating DJs, smoky grills, and the kind of dancing that starts early.",
    priceLabel: "Free entry",
    imageSrc: "/events/street-sessions.png",
  },
  {
    id: "draw-the-city",
    title: "Draw the City",
    category: "Walks",
    date: "Sunday, 06 Sep",
    time: "9:00 AM - 12:00 PM",
    venue: "Marina Gate",
    city: "Lagos",
    description:
      "A slow sketch walk through changing streets, with prompts for first-timers and a coffee stop at the end.",
    priceLabel: "NGN 3,500",
    imageSrc: "/events/sketch-walk.png",
  },
]

export const howItWorksSteps: HowItWorksStep[] = [
  {
    id: "discover",
    stepLabel: "01 / Discover",
    title: "Find a plan that fits your day",
    description:
      "Scan the hero for what is happening now, then browse a fuller list when you want more choice.",
    imageSrc: "/events/night-market.png",
    imageAlt: "Friends gathering under lights at a night market",
  },
  {
    id: "details",
    stepLabel: "02 / Details",
    title: "Open the details before you commit",
    description:
      "Every event keeps the practical bits together: time, place, price, and the feeling of the room.",
    imageSrc: "/events/rooftop-cinema.png",
    imageAlt: "A rooftop cinema setup overlooking the city",
  },
  {
    id: "create",
    stepLabel: "03 / Create",
    title: "Put your own plan on the map",
    description:
      "Share the next gathering with a clear image and the details people need to show up.",
    imageSrc: "/events/ceramics-club.png",
    imageAlt: "People making ceramics together in a bright studio",
  },
]

