"use client";

import { useState } from "react";
import Link from "next/link";

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface WorldHeaderProps {
  title: string;
  onSave: () => Promise<void>;
  onShare: () => void;
  onAiExpand: () => void;
  onAddNode: () => void;
  isPublic: boolean;
  saveState: SaveState;
}

const saveLabels: Record<SaveState, string> = {
  idle: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving...",
  saved: "Saved",
  failed: "Save failed",
};

const saveDotClass: Record<SaveState, string> = {
  idle: "poe-save-saved",
  unsaved: "poe-save-unsaved",
  saving: "poe-save-saving",
  saved: "poe-save-saved",
  failed: "poe-save-failed",
};

export function WorldHeader({
  title,
  onSave,
  onShare,
  onAiExpand,
  onAddNode,
  isPublic,
  saveState,
}: WorldHeaderProps) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    await onSave();
  }

  return (
    <div className="poe-header relative z-20">
      <div className="poe-ornate-border" />

      <div className="h-14 flex items-center justify-between px-5">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/dashboard"
            className="text-poe-text-dim hover:text-poe-gold-mid transition text-sm"
            title="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="text-lg font-cinzel font-semibold text-poe-text-primary truncate max-w-xs">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <span className={saveDotClass[saveState]} style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
            <span className="text-xs text-poe-text-dim font-mono">
              {saveLabels[saveState]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAddNode}
            className="poe-btn px-3 py-1.5 text-sm"
          >
            + Node
          </button>
          <button
            onClick={onAiExpand}
            className="poe-btn px-3 py-1.5 text-sm"
            style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
          >
            AI Expand
          </button>

          <button
            onClick={handleShare}
            className={`poe-btn px-3 py-1.5 text-sm ${
              isPublic
                ? "!border-poe-complete-green !text-poe-complete-bright !bg-poe-complete-green/10"
                : ""
            }`}
          >
            {copied ? "Link Copied!" : isPublic ? "Public" : "Share"}
          </button>

          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="poe-btn-gold px-4 py-1.5 text-sm font-semibold disabled:opacity-50 poe-btn"
          >
            {saveState === "saving" ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="poe-ornate-border" />
    </div>
  );
}
