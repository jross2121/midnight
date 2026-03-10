type CategoryLike = {
  id?: string;
  name?: string;
};

const CATEGORY_LABEL_BY_ID: Record<string, string> = {
  health: "Health",
  money: "Money",
  career: "Career",
  social: "Social",
  home: "Home",
  fun: "Personal",
};

export function getCategoryDisplayNameById(categoryId: string, fallback?: string): string {
  const normalizedId = categoryId.trim().toLowerCase();
  if (CATEGORY_LABEL_BY_ID[normalizedId]) {
    return CATEGORY_LABEL_BY_ID[normalizedId];
  }
  return fallback && fallback.trim().length > 0 ? fallback : "Category";
}

export function getCategoryDisplayName(category: CategoryLike): string {
  const rawName = category.name?.trim();
  if (category.id) {
    return getCategoryDisplayNameById(category.id, rawName);
  }

  if (!rawName) {
    return "Category";
  }
  if (rawName.toLowerCase() === "fun") {
    return "Personal";
  }
  return rawName;
}

export function getMainCategoryDisplayEntries() {
  return [
    { id: "health", label: getCategoryDisplayNameById("health") },
    { id: "money", label: getCategoryDisplayNameById("money") },
    { id: "career", label: getCategoryDisplayNameById("career") },
    { id: "social", label: getCategoryDisplayNameById("social") },
    { id: "home", label: getCategoryDisplayNameById("home") },
    { id: "fun", label: getCategoryDisplayNameById("fun") },
  ] as const;
}
