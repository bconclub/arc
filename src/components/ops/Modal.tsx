"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-5 py-[6vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card bg-surface p-6"
        style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[15px] font-semibold text-text">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--border-strong)]";

export const btnCls =
  "rounded-full border border-[var(--border)] bg-surface px-4 py-2 text-[12px] font-medium text-text-muted transition-all hover:bg-surface-hover hover:text-text disabled:opacity-50";

export const btnPrimaryCls =
  "rounded-full bg-text px-4 py-2 text-[12px] font-medium text-bg transition-opacity disabled:opacity-50";

export const btnDangerCls =
  "rounded-full border border-[var(--border)] px-4 py-2 text-[12px] font-medium text-accent-red transition-all hover:bg-surface-hover disabled:opacity-50";

export function ModalActions({
  onDelete,
  onCancel,
  onSave,
  saving,
  canDelete,
}: {
  onDelete?: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canDelete?: boolean;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-2">
      {canDelete && onDelete ? (
        <button className={btnDangerCls} onClick={onDelete} disabled={saving}>
          Delete
        </button>
      ) : (
        <span />
      )}
      <div className="ml-auto flex gap-2">
        <button className={btnCls} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className={btnPrimaryCls} onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
