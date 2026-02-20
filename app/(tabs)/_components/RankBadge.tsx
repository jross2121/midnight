import React from "react";
import Svg, { Line, Path, Polygon, Rect } from "react-native-svg";
import { getRankFromDR, type DisciplineRank } from "../_utils/rank";
import { useTheme } from "../_utils/themeContext";

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
  const strokeColor = color ?? (active ? colors.accentPrimary : colors.border);
  const strokeWidth = Math.max(1.6, size * 0.09);

  const commonStroke = {
    stroke: strokeColor,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
  };

  const renderMark = () => {
    switch (resolvedRank) {
      case "Foundation":
        return <Line x1="12" y1="4" x2="12" y2="20" {...commonStroke} />;
      case "Consistent":
        return (
          <>
            <Line x1="9" y1="4" x2="9" y2="20" {...commonStroke} />
            <Line x1="15" y1="4" x2="15" y2="20" {...commonStroke} />
          </>
        );
      case "Focused":
        return <Polygon points="12,5 19,18 5,18" {...commonStroke} />;
      case "Driven":
        return <Polygon points="12,3 21,12 12,21 3,12" {...commonStroke} />;
      case "Relentless":
        return (
          <>
            <Polygon points="12,2.5 21.5,12 12,21.5 2.5,12" {...commonStroke} />
            <Polygon points="12,6.5 17.5,12 12,17.5 6.5,12" {...commonStroke} />
          </>
        );
      case "Elite":
        return <Path d="M4 17 L9 7 L12 11 L15 7 L20 17" {...commonStroke} />;
      case "Grand Discipline":
        return (
          <Path
            d="M4 18 L4 6 L9 13 L12 7 L15 13 L20 6 L20 18"
            {...commonStroke}
          />
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
