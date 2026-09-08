"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function OutreachDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const focus = document.activeElement as HTMLElement;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      focus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%_-_24px)] max-w-xl rounded-card border border-[var(--border)] bg-surface p-0 text-text backdrop:bg-black/60"
    >
      <div className="flex max-h-[88dvh] flex-col">{children}</div>
    </dialog>
  );
}
