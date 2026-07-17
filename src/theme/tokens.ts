export const midnightTokens = {
  colors: {
    dark: {
      bg0: "#0a0f14",
      bg1: "#101722",
      surface: "#141d28",
      border: "#253243",
      textPrimary: "#e6edf4",
      textSecondary: "#8ea0b2",
      accent: "#F5B84B",
      positive: "#4ADE80",
      negative: "#d06a74",
    },
    light: {
      bg0: "#F1F4F8",
      bg1: "#FFFFFF",
      surface: "#F8FAFC",
      border: "#B8C3D0",
      textPrimary: "#111827",
      textSecondary: "#526173",
      accent: "#A86410",
      positive: "#147A3D",
      negative: "#B4232A",
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
    r1: 8,
    r2: 10,
    r3: 12,
  },
  typography: {
    h1: {
      fontSize: 44,
      lineHeight: 48,
      fontWeight: "900" as const,
      letterSpacing: 0,
    },
    h2: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "800" as const,
      letterSpacing: 0,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500" as const,
    },
    label: {
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700" as const,
      letterSpacing: 0,
      textTransform: "uppercase" as const,
    },
    mono: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700" as const,
      letterSpacing: 0,
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
