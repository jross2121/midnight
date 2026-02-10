import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";
import type { Category } from "../utils/types";

interface CategoryDetailsProps {
  category: Category;
}

const getCategoryColor = (categoryId: string): string => {
  const colorMap: { [key: string]: string } = {
    health: "#00bcd4",
    money: "#00ff00",
    career: "#ff9800",
    social: "#ff6b9d",
    home: "#ff4444",
    fun: "#9d4edd",
  };
  return colorMap[categoryId] || "#00d9ff";
};

const getCategoryDescription = (categoryId: string): string => {
  const descriptions: { [key: string]: string } = {
    health: "Physical and mental wellbeing",
    money: "Financial growth and management",
    career: "Professional development and growth",
    social: "Relationships and connections",
    home: "Living space and domestic life",
    fun: "Leisure and personal enjoyment",
  };
  return descriptions[categoryId] || "";
};

export function CategoryDetails({ category }: CategoryDetailsProps) {
  const color = getCategoryColor(category.id);
  const description = getCategoryDescription(category.id);

  // Calculate XP progress to next level
  const xpPercent = Math.min((category.xp / category.xpToNext) * 100, 100);

  // Calculate next milestone
  const xpNeeded = category.xpToNext - category.xp;

  // Calculate estimated days to next level (assuming ~50 XP per day average)
  const estimatedDaysToNextLevel = Math.ceil(xpNeeded / 50);

  return (
    <View style={[styles.card, { borderColor: color, borderWidth: 2 }]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <View>
          <Text style={[styles.cardTitle, { color }]}>{category.name}</Text>
          <Text style={[styles.questMeta, { marginTop: 4 }]}>{description}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.level, { color, fontSize: 24 }]}>Lv {category.level}</Text>
        </View>
      </View>

      {/* XP Progress */}
      <View style={{ gap: 8, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.xpText}>Progress to Lv {category.level + 1}</Text>
          <Text style={[styles.xpText, { color }]}>
            {category.xp} / {category.xpToNext} XP
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                backgroundColor: color,
                width: `${xpPercent}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Stats Grid */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0a0e14",
            borderRadius: 10,
            padding: 12,
            borderWidth: 1.5,
            borderColor: color,
            opacity: 0.7,
          }}
        >
          <Text style={[styles.questMeta, { fontSize: 11, color: "#8fa3b0" }]}>XP Needed</Text>
          <Text style={[styles.pillValue, { color, fontSize: 14, marginTop: 4 }]}>
            {xpNeeded}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: "#0a0e14",
            borderRadius: 10,
            padding: 12,
            borderWidth: 1.5,
            borderColor: color,
            opacity: 0.7,
          }}
        >
          <Text style={[styles.questMeta, { fontSize: 11, color: "#8fa3b0" }]}>Est. Days</Text>
          <Text style={[styles.pillValue, { color, fontSize: 14, marginTop: 4 }]}>
            ~{estimatedDaysToNextLevel}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: "#0a0e14",
            borderRadius: 10,
            padding: 12,
            borderWidth: 1.5,
            borderColor: color,
            opacity: 0.7,
          }}
        >
          <Text style={[styles.questMeta, { fontSize: 11, color: "#8fa3b0" }]}>Mastery</Text>
          <Text style={[styles.pillValue, { color, fontSize: 14, marginTop: 4 }]}>
            {Math.min(Math.round((category.level / 10) * 100), 100)}%
          </Text>
        </View>
      </View>

      {/* Achievement milestones */}
      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#1f2a3c" }}>
        <Text style={[styles.smallLabel, { color, marginBottom: 8 }]}>Next Milestones</Text>
        <View style={{ gap: 8 }}>
          {[category.level + 1, category.level + 2, category.level + 3].map((lvl) => {
            const isCurrent = lvl === category.level + 1;
            return (
              <View
                key={lvl}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  backgroundColor: isCurrent ? "#141d2a" : "transparent",
                  borderRadius: 8,
                  borderWidth: isCurrent ? 1.5 : 0,
                  borderColor: color,
                }}
              >
                <Text style={[styles.questMeta, { color: isCurrent ? color : "#8fa3b0" }]}>
                  Level {lvl}
                </Text>
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    backgroundColor: color,
                    borderRadius: 6,
                    opacity: isCurrent ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: "#0a0e14", fontWeight: "700", fontSize: 11 }}>
                    {isCurrent ? "Next" : "Upcoming"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
