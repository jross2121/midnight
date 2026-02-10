import React from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import type { Category } from "../utils/types";

interface StatWheelProps {
  categories: Category[];
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategory: string | null;
}

export function StatWheel({ categories, onSelectCategory, selectedCategory }: StatWheelProps) {
  // Get screen width and add padding constraints
  const screenWidth = Dimensions.get("window").width;
  // Account for container padding (20px each side = 40px total) and some breathing room
  const maxWheelWidth = screenWidth - 60;

  // Scale the wheel based on screen width - use a larger base proportion
  const baseSize = 360;
  const scale = maxWheelWidth / baseSize;
  const svgWidth = baseSize * scale;
  const svgHeight = 400 * scale;

  // Scale all measurements proportionally
  const wheelRadius = 100 * scale;
  // Center is in viewBox coordinates (not scaled)
  const centerX = 180;
  const centerY = 200;
  const maxLevel = Math.max(...categories.map((c) => c.level), 1);

  // Calculate angles for each category (evenly distributed around circle)
  const angleStep = (Math.PI * 2) / categories.length;

  // Get color for category
  const getCategoryColor = (categoryId: string): string => {
    const colorMap: { [key: string]: string } = {
      // health: use cyan/teal (distinct from money green)
      health: "#00bcd4",
      money: "#00ff00",
      career: "#ff9800",
      social: "#ff6b9d",
      home: "#ff4444",
      fun: "#9d4edd",
    };
    return colorMap[categoryId] || "#00d9ff";
  };

  // Calculate point on circle
  const getPoint = (index: number, radius: number) => {
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  // Get label position (further out than the data point)
  const getLabelPoint = (index: number) => {
    // push labels further out to avoid overlap with radar area, scale with wheel
    return getPoint(index, wheelRadius + 60 * scale);
  };

  // Create the radar area path
  const createRadarPath = (levels: number[]) => {
    let pathData = "";
    levels.forEach((level, i) => {
      const radius = (level / maxLevel) * wheelRadius;
      const point = getPoint(i, radius);
      pathData += `${i === 0 ? "M" : "L"} ${point.x} ${point.y} `;
    });
    pathData += "Z";
    return pathData;
  };

  const radarPath = createRadarPath(categories.map((c) => c.level));

  return (
    <View style={{ alignItems: "center", marginVertical: 20 }}>
      <Svg width={svgWidth} height={svgHeight} viewBox="0 0 360 400">
        {/* Background grid lines */}
        {[1, 2, 3, 4, 5].map((level) => {
          const radius = (level / 5) * wheelRadius;
          return (
            <Circle
              key={`grid-${level}`}
              cx={centerX}
              cy={centerY}
              r={radius}
              stroke="#26343f"
              strokeWidth="1"
              fill="none"
              opacity="0.6"
            />
          );
        })}

        {/* Axis lines from center to each category */}
        {categories.map((_, i) => {
          const point = getPoint(i, wheelRadius);
          return (
            <Line
              key={`axis-${i}`}
              x1={centerX}
              y1={centerY}
              x2={point.x}
              y2={point.y}
              stroke="#26343f"
              strokeWidth="1"
              opacity="0.45"
            />
          );
        })}

        {/* Radar area (filled) */}
        <Path
          d={radarPath}
          fill="#00d9ff"
          fillOpacity="0.16"
          stroke="#00d9ff"
          strokeWidth={2.5 * scale}
        />

        {/* Data points and labels */}
        {categories.map((category, i) => {
          const radius = (category.level / maxLevel) * wheelRadius;
          const dataPoint = getPoint(i, radius);
          const labelPoint = getLabelPoint(i);
          const color = getCategoryColor(category.id);
          const isSelected = selectedCategory === category.id;

          return (
            <G key={category.id}>
              {/* Data point circle */}
              <Circle
                cx={dataPoint.x}
                cy={dataPoint.y}
                r={isSelected ? 10 * scale : 6 * scale}
                fill={color}
                stroke="#080c12"
                strokeWidth={2 * scale}
                opacity={isSelected ? 1 : 0.8}
              />

              {/* Category label with level */}
              <SvgText
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize={14 * scale}
                fontWeight="900"
                fill={color}
                textAnchor="middle"
                opacity={isSelected ? 1 : 0.7}
              >
                {category.name}
              </SvgText>

              {/* Level indicator */}
              <SvgText
                x={labelPoint.x}
                y={labelPoint.y + 16 * scale}
                fontSize={12 * scale}
                fontWeight="700"
                fill={color}
                textAnchor="middle"
                opacity={0.8}
              >
                Lv {category.level}
              </SvgText>
            </G>
          );
        })}

        {/* Center circle with label */}
        <Circle cx={centerX} cy={centerY} r={28 * scale} fill="#141d2a" stroke="#00d9ff" strokeWidth={2 * scale} />
        <SvgText
          x={centerX}
          y={centerY + 6 * scale}
          fontSize={16 * scale}
          fontWeight="900"
          fill="#00d9ff"
          textAnchor="middle"
        >
          Stats
        </SvgText>
      </Svg>

      {/* Interactive category buttons below wheel */}
      <View style={{ marginTop: 20, gap: 12, width: "100%" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {categories.map((category) => {
            const isSelected = selectedCategory === category.id;
            const color = getCategoryColor(category.id);

            return (
              <Pressable
                key={category.id}
                onPress={() => onSelectCategory(isSelected ? null : category.id)}
                style={[
                  {
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: color,
                    backgroundColor: isSelected ? color : "transparent",
                    opacity: isSelected ? 1 : 0.6,
                  },
                ]}
              >
                <Text
                  style={[
                    {
                      fontWeight: "700",
                      fontSize: 12,
                      color: isSelected ? "#0a0e14" : color,
                    },
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
