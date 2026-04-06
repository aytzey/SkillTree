"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { EdgeType } from "@/types";

interface EdgeStyleDef {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
  glowColor?: string;
  glowWidth?: number;
  animated?: boolean;
  particleColor?: string;
}

const edgeStyles: Record<EdgeType, EdgeStyleDef> = {
  prerequisite: {
    stroke: "#c4941a",
    strokeWidth: 2.5,
    opacity: 0.85,
    glowColor: "rgba(196, 148, 26, 0.25)",
    glowWidth: 10,
    animated: true,
    particleColor: "#f5d060",
  },
  recommended: {
    stroke: "#818cf8",
    strokeWidth: 1.8,
    strokeDasharray: "8 4",
    opacity: 0.5,
    glowColor: "rgba(129, 140, 248, 0.15)",
    glowWidth: 6,
    animated: true,
    particleColor: "#a5b4fc",
  },
  optional: {
    stroke: "#404050",
    strokeWidth: 1.2,
    strokeDasharray: "4 4",
    opacity: 0.3,
  },
};

function SkillEdgeComponent(props: EdgeProps) {
  const {
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data,
  } = props;
  const edgeType = (data?.type as EdgeType) || "prerequisite";
  const style = edgeStyles[edgeType];

  const [edgePath] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  return (
    <>
      {/* Outer glow layer */}
      {style.glowColor && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.glowColor,
            strokeWidth: style.strokeWidth + (style.glowWidth || 8),
            opacity: 0.4,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Main edge line */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />

      {/* Energy flow particles — layer 1 */}
      {style.animated && (
        <>
          <BaseEdge
            path={edgePath}
            style={{
              stroke: style.particleColor || "#e8b828",
              strokeWidth: 2,
              strokeDasharray: "3 20",
              opacity: 0.8,
              animation: "edge-energy 1.5s linear infinite",
            }}
          />
          {/* Energy flow particles — layer 2 (offset) */}
          <BaseEdge
            path={edgePath}
            style={{
              stroke: style.particleColor || "#e8b828",
              strokeWidth: 1.5,
              strokeDasharray: "2 26",
              opacity: 0.5,
              animation: "edge-energy-slow 2.5s linear infinite",
            }}
          />
        </>
      )}

      {/* Invisible interaction area for clicking */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: "transparent",
          strokeWidth: 20,
          cursor: "pointer",
        }}
      />
    </>
  );
}

export const SkillEdge = memo(SkillEdgeComponent);
