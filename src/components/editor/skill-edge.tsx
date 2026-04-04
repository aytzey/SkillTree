"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { EdgeType } from "@/types";

const edgeStyles: Record<
  EdgeType,
  { stroke: string; strokeDasharray?: string; opacity: number }
> = {
  prerequisite: { stroke: "#818cf8", opacity: 0.8 },
  recommended: { stroke: "#818cf8", strokeDasharray: "8 4", opacity: 0.4 },
  optional: { stroke: "#475569", strokeDasharray: "4 4", opacity: 0.3 },
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
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: edgeType === "prerequisite" ? 2.5 : 1.5,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />
      {edgeType === "prerequisite" && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.stroke,
            strokeWidth: 2.5,
            strokeDasharray: "12 12",
            opacity: 0.6,
            animation: "flow 2s linear infinite",
          }}
        />
      )}
    </>
  );
}

export const SkillEdge = memo(SkillEdgeComponent);
