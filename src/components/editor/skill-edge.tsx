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
    strokeWidth: 3.5,
    opacity: 1.0,
    glowColor: "rgba(196, 148, 26, 0.35)",
    glowWidth: 12,
    animated: true,
    particleColor: "#f5d060",
  },
  recommended: {
    stroke: "#818cf8",
    strokeWidth: 1.5,
    strokeDasharray: "8 5",
    opacity: 0.35,
  },
  optional: {
    stroke: "#404050",
    strokeWidth: 1.2,
    strokeDasharray: "4 4",
    opacity: 0.3,
  },
};

// Unique-enough marker ID prefix to avoid SVG namespace collisions
const PREREQ_ARROW_ID = "skill-edge-prereq-arrow";

function SkillEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data,
    markerEnd,
  } = props;
  const edgeType = (data?.type as EdgeType) || "prerequisite";
  const style = edgeStyles[edgeType];

  const [edgePath] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  // Per-edge unique marker ID so concurrent edges don't share state
  const arrowMarkerId = `${PREREQ_ARROW_ID}-${id}`;
  const isPrerequisite = edgeType === "prerequisite";

  return (
    <>
      {/* Inline arrowhead definition for prerequisite edges */}
      {isPrerequisite && (
        <defs>
          <marker
            id={arrowMarkerId}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={style.stroke}
              opacity={style.opacity}
            />
          </marker>
        </defs>
      )}

      {/* Outer glow layer */}
      {style.glowColor && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.glowColor,
            strokeWidth: style.strokeWidth + (style.glowWidth || 8),
            opacity: 0.45,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Main edge line */}
      <BaseEdge
        path={edgePath}
        markerEnd={isPrerequisite ? `url(#${arrowMarkerId})` : markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />

      {/* Energy flow particles — prerequisite only */}
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
