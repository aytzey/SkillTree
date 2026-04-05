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
  animated?: boolean;
}

const edgeStyles: Record<EdgeType, EdgeStyleDef> = {
  prerequisite: {
    stroke: "#c4941a",
    strokeWidth: 2.5,
    opacity: 0.85,
    glowColor: "rgba(196, 148, 26, 0.3)",
    animated: true,
  },
  recommended: {
    stroke: "#818cf8",
    strokeWidth: 1.8,
    strokeDasharray: "8 4",
    opacity: 0.45,
  },
  optional: {
    stroke: "#404050",
    strokeWidth: 1.2,
    strokeDasharray: "4 4",
    opacity: 0.25,
  },
};

function SkillEdgeComponent(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  } = props;
  const edgeType = (data?.type as EdgeType) || "prerequisite";
  const style = edgeStyles[edgeType];

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      {style.glowColor && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.glowColor,
            strokeWidth: style.strokeWidth + 6,
            opacity: 0.4,
            filter: "blur(4px)",
          }}
        />
      )}

      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />

      {style.animated && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: "#e8b828",
            strokeWidth: 2,
            strokeDasharray: "6 18",
            opacity: 0.7,
            animation: "edge-energy 2s linear infinite",
          }}
        />
      )}
    </>
  );
}

export const SkillEdge = memo(SkillEdgeComponent);
