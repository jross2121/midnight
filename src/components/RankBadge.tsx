import React from "react";
import Svg, { Circle, Line, Path, Polygon, Rect } from "react-native-svg";
import { HOME_GOLD } from "@/src/styles";
import { getRankFromDR, type DisciplineRank } from "@/src/utils/rank";
import { useTheme } from "@/src/utils/themeContext";

interface RankBadgeProps {
  rank?: DisciplineRank;
  rankTier?: number;
  size?: number;
  color?: string;
  active?: boolean;
}

function rankFromTier(rankTier: number): DisciplineRank {
  switch (rankTier) {
    case 1:
      return "Foundation";
    case 2:
      return "Consistent";
    case 3:
      return "Focused";
    case 4:
      return "Driven";
    case 5:
      return "Relentless";
    case 6:
      return "Elite";
    case 7:
      return "Grand Discipline";
    default:
      return getRankFromDR(0);
  }
}

export function RankBadge({ rank, rankTier, size = 24, color, active = true }: RankBadgeProps) {
  const { colors } = useTheme();
  const resolvedRank = rank ?? rankFromTier(rankTier ?? 1);
  const strokeColor = color ?? (active ? HOME_GOLD : colors.border);
  const strokeWidth = Math.max(1.45, size * 0.07);
  const thinStrokeWidth = Math.max(1, size * 0.045);
  const markOpacity = active ? 1 : 0.56;

  const commonStroke = {
    stroke: strokeColor,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
  };
  const thinStroke = {
    ...commonStroke,
    strokeWidth: thinStrokeWidth,
  };
  const softFill = {
    fill: strokeColor,
    opacity: active ? 0.16 : 0.08,
  };

  const renderMark = () => {
    switch (resolvedRank) {
      case "Foundation":
        return (
          <>
            <Rect x="7" y="16.7" width="10" height="3.1" rx="1.5" {...softFill} />
            <Line x1="6.5" y1="20" x2="17.5" y2="20" {...commonStroke} />
            <Line x1="8.5" y1="16" x2="15.5" y2="16" {...thinStroke} />
            <Line x1="12" y1="5" x2="12" y2="16" {...commonStroke} />
            <Circle cx="12" cy="4.4" r="1.2" fill={strokeColor} opacity={markOpacity} />
          </>
        );
      case "Consistent":
        return (
          <>
            <Line x1="7.5" y1="19" x2="16.5" y2="19" {...thinStroke} />
            <Line x1="8.5" y1="7" x2="8.5" y2="18" {...commonStroke} />
            <Line x1="15.5" y1="7" x2="15.5" y2="18" {...commonStroke} />
            <Line x1="8.5" y1="7" x2="15.5" y2="7" {...thinStroke} />
            <Path d="M8.5 12 H15.5" {...thinStroke} />
          </>
        );
      case "Focused":
        return (
          <>
            <Circle cx="12" cy="12" r="7.1" {...thinStroke} />
            <Circle cx="12" cy="12" r="2.6" {...commonStroke} />
            <Line x1="12" y1="3.8" x2="12" y2="7" {...thinStroke} />
            <Line x1="12" y1="17" x2="12" y2="20.2" {...thinStroke} />
            <Line x1="3.8" y1="12" x2="7" y2="12" {...thinStroke} />
            <Line x1="17" y1="12" x2="20.2" y2="12" {...thinStroke} />
          </>
        );
      case "Driven":
        return (
          <>
            <Polygon points="12,3.5 20.5,12 12,20.5 3.5,12" {...commonStroke} />
            <Path d="M10 16 L12.5 12 H9.7 L14 7.7 L12.2 11.2 H15" {...commonStroke} />
          </>
        );
      case "Relentless":
        return (
          <>
            <Path d="M12 3 L18.8 6.7 L18.8 13.6 C18.8 17.7 15.8 20.2 12 21.3 C8.2 20.2 5.2 17.7 5.2 13.6 L5.2 6.7 Z" {...commonStroke} />
            <Path d="M8.8 13.4 L11 15.6 L15.7 9.1" {...commonStroke} />
            <Line x1="12" y1="5.7" x2="12" y2="18.4" {...thinStroke} />
          </>
        );
      case "Elite":
        return (
          <>
            <Polygon points="12,3.4 14.1,9.2 20.2,9.4 15.4,13.1 17.1,19.1 12,15.7 6.9,19.1 8.6,13.1 3.8,9.4 9.9,9.2" {...commonStroke} />
            <Circle cx="12" cy="12.2" r="2.3" fill={strokeColor} opacity={active ? 0.2 : 0.1} />
          </>
        );
      case "Grand Discipline":
        return (
          <>
            <Path d="M4.5 18.2 L4.5 7.2 L9 13.1 L12 5.4 L15 13.1 L19.5 7.2 L19.5 18.2 Z" {...commonStroke} />
            <Line x1="7.2" y1="18.2" x2="16.8" y2="18.2" {...thinStroke} />
            <Circle cx="12" cy="4.8" r="1.4" fill={strokeColor} opacity={markOpacity} />
            <Circle cx="4.6" cy="7.2" r="1.1" fill={strokeColor} opacity={markOpacity} />
            <Circle cx="19.4" cy="7.2" r="1.1" fill={strokeColor} opacity={markOpacity} />
          </>
        );
      default:
        return <Rect x="11" y="4" width="2" height="16" rx="1" fill={strokeColor} />;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={`${resolvedRank} emblem`}>
      {renderMark()}
    </Svg>
  );
}
