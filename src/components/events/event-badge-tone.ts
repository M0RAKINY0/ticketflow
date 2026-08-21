export function eventBadgeTone(category: string) {
  if (category === "Film" || category === "Walks") return "primary" as const
  if (category === "Music + Food" || category === "Markets") return "accent" as const
  return "default" as const
}

