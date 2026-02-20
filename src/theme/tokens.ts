export const midnightTokens = {
  colors: {
    dark: {
      bg0: "#0a0f14",
      bg1: "#101722",
      surface: "#141d28",
      border: "#253243",
      textPrimary: "#e6edf4",
      textSecondary: "#8ea0b2",
      accent: "#25c9d8",
      positive: "#3bcf9e",
      negative: "#d06a74",
    },
    light: {
      bg0: "#EEF2F6",
      bg1: "#FFFFFF",
      surface: "#FFFFFF",
      border: "#CBD5E1",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#24b6d3",
      positive: "#2fbf8c",
      negative: "rgba(239, 68, 68, 0.75)",
    },
  },
  spacing: {
    s0: 4,
    s1: 8,
    s2: 16,
    s3: 24,
    s4: 32,
  },
  radius: {
    r1: 10,
    r2: 14,
    r3: 18,
  },
  typography: {
    h1: {
      fontSize: 44,
      lineHeight: 48,
      fontWeight: "900" as const,
      letterSpacing: 0.3,
    },
    h2: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "800" as const,
      letterSpacing: 0.2,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500" as const,
    },
    label: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "700" as const,
      letterSpacing: 0.7,
      textTransform: "uppercase" as const,
    },
    mono: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700" as const,
      letterSpacing: 0.35,
    },
  },
  shadows: {
    subtle: {
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    raised: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
  },
} as const;
