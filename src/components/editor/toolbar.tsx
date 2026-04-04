"use client";

import { useState } from "react";

interface ToolbarProps {
  title: string;
  onSave: () => void;
  onShare: () => void;
  onAiExpand: () => void;
  onAddNode: () => void;
  isPublic: boolean;
  saving: boolean;
}

export function Toolbar({
  title,
  onSave,
  onShare,
  onAiExpand,
  onAddNode,
  isPublic,
  saving,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-14 border-b border-rpg-border bg-rpg-bg-secondary/80 backdrop-blur flex items-center justify-between px-4">
      <h2 className="text-lg font-semibold text-white truncate max-w-xs">
        {title}
      </h2>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddNode}
          className="px-3 py-1.5 text-sm bg-rpg-card border border-rpg-border rounded-lg text-slate-300 hover:border-rpg-neon transition"
        >
          + Node
        </button>
        <button
          onClick={onAiExpand}
          className="px-3 py-1.5 text-sm bg-rpg-blue/20 border border-rpg-blue text-rpg-blue rounded-lg hover:bg-rpg-blue/30 transition"
        >
          AI Expand
        </button>
        <button
          onClick={handleShare}
          className={`px-3 py-1.5 text-sm border rounded-lg transition ${
            isPublic
              ? "bg-rpg-green/20 border-rpg-green text-rpg-green"
              : "bg-rpg-card border-rpg-border text-slate-300 hover:border-rpg-gold"
          }`}
        >
          {copied ? "Link Copied!" : isPublic ? "Public" : "Share"}
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg hover:bg-rpg-gold/30 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
