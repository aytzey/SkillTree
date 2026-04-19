import { useEffect } from "react";

interface ShortcutActions {
  onDelete: () => void;
  onDuplicate: () => void;
  onSave: () => void;
  onDeselect: () => void;
}

export function useKeyboardShortcuts(
  selectedNodeId: string | null,
  actions: ShortcutActions
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          actions.onDelete();
        }
      }

      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        if (selectedNodeId) {
          e.preventDefault();
          actions.onDuplicate();
        }
      }

      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        actions.onSave();
      }

      if (e.key === "Escape") {
        actions.onDeselect();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, actions]);
}
