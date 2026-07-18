export type CategoryArt = {
  glyph: string;
  color: string;
  label: string;
};

const CATEGORY_ART_BY_ID: Record<string, CategoryArt> = {
  health: { glyph: "💚", color: "#3BCF9E", label: "Health" },
  money: { glyph: "💵", color: "#F4B95E", label: "Money" },
  career: { glyph: "💼", color: "#25C9D8", label: "Career" },
  social: { glyph: "💬", color: "#A78BFA", label: "Social" },
  home: { glyph: "🏠", color: "#F59E0B", label: "Home" },
  fun: { glyph: "✨", color: "#F472B6", label: "Personal" },
};

const FALLBACK_CATEGORY_ART: CategoryArt = {
  glyph: "◇",
  color: "#8EA0B2",
  label: "Category",
};

export function getCategoryArtById(categoryId: string): CategoryArt {
  return CATEGORY_ART_BY_ID[categoryId.trim().toLowerCase()] ?? FALLBACK_CATEGORY_ART;
}
