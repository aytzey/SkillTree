"use client";

import Link from "next/link";
import { useState } from "react";
import type { ShareMode } from "@/types";

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface WorldHeaderProps {
  title: string;
  onSave: () => Promise<void>;
  onAddNode: () => void;
  onChangeShareMode: (mode: ShareMode) => Promise<void>;
  onExportPortable: () => void;
  onExportBackup: () => void;
  onImportNew: () => void;
  onImportReplace: () => void;
  onToggleMode: () => void;
  shareMode: ShareMode;
  canEdit: boolean;
  canManageShare: boolean;
  isReadOnly: boolean;
  saveState: SaveState;
  shareFeedback?: string | null;
}

const saveLabels: Record<SaveState, string> = {
  idle: "Saved",
  unsaved: "Unsaved positions",
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

const shareModeLabels: Record<ShareMode, string> = {
  private: "Private",
  public_readonly: "Public View",
  public_edit: "Public Edit",
};

export function WorldHeader({
  title,
  onSave,
  onAddNode,
  onChangeShareMode,
  onExportPortable,
  onExportBackup,
  onImportNew,
  onImportReplace,
  onToggleMode,
  shareMode,
  canEdit,
  canManageShare,
  isReadOnly,
  saveState,
  shareFeedback,
}: WorldHeaderProps) {
  const [updatingShare, setUpdatingShare] = useState(false);

  async function handleShareModeChange(mode: ShareMode) {
    setUpdatingShare(true);
    try {
      await onChangeShareMode(mode);
    } finally {
      setUpdatingShare(false);
    }
  }

  return (
    <div className="poe-header relative z-20">
      <div className="poe-ornate-border" />

      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
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
          <div className="min-w-0">
            <h2 className="text-lg font-cinzel font-semibold text-poe-text-primary truncate max-w-xs">
              {title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={saveDotClass[saveState]}
                style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }}
              />
              <span className="text-xs text-poe-text-dim font-mono">{saveLabels[saveState]}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-poe-border-mid text-poe-text-dim">
                {isReadOnly ? "View mode" : "Edit mode"}
              </span>
              {!canManageShare && shareMode !== "private" && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-poe-energy-blue/20 text-poe-energy-blue bg-poe-energy-blue/10">
                  {shareModeLabels[shareMode]}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <button
              onClick={onToggleMode}
              className="poe-btn px-3 py-1.5 text-sm"
            >
              {isReadOnly ? "Switch to Edit" : "Switch to View"}
            </button>
          )}

          <button onClick={onExportPortable} className="poe-btn px-3 py-1.5 text-sm">
            Export JSON
          </button>

          <button onClick={onExportBackup} className="poe-btn px-3 py-1.5 text-sm">
            Backup JSON
          </button>

          {canManageShare && (
            <button onClick={onImportNew} className="poe-btn px-3 py-1.5 text-sm">
              Import New
            </button>
          )}

          {canEdit && (
            <>
              <button
                onClick={onImportReplace}
                disabled={isReadOnly}
                className="poe-btn px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Replace Tree
              </button>
              <button
                onClick={onAddNode}
                disabled={isReadOnly}
                className="poe-btn px-3 py-1.5 text-sm disabled:opacity-50"
              >
                + Node
              </button>
            </>
          )}

          {canManageShare && (
            <select
              value={shareMode}
              onChange={(e) => handleShareModeChange(e.target.value as ShareMode)}
              disabled={updatingShare}
              className="poe-input px-3 py-1.5 text-sm min-w-[128px]"
            >
              <option value="private">Private</option>
              <option value="public_readonly">Public View</option>
              <option value="public_edit">Public Edit</option>
            </select>
          )}

          {shareFeedback && (
            <span className="text-[10px] font-mono text-poe-energy-blue max-w-[220px] truncate">
              {shareFeedback}
            </span>
          )}

          {canEdit && (
            <button
              onClick={onSave}
              disabled={isReadOnly || saveState === "saving"}
              className="poe-btn-gold px-4 py-1.5 text-sm font-semibold disabled:opacity-50 poe-btn"
              title="Save positions (Ctrl+S)"
            >
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      <div className="poe-ornate-border" />
    </div>
  );
}
