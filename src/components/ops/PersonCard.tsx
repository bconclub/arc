"use client";

import Link from "next/link";
import { AtSign, Phone } from "lucide-react";
import { BrandMark } from "@/components/ops/BrandMark";
import type { Brand, Person } from "@/types/ops";

/**
 * Splits the free-text channel into the things you can actually act on.
 *
 * `channel` is one field holding an email, a phone number, or both separated by
 * a slash, so it has to be read rather than assumed. Anything unrecognised is
 * kept and shown as plain text instead of being dropped.
 */
export function channelParts(channel: string | null | undefined) {
  const parts = (channel ?? "").split("/").map((s) => s.trim()).filter(Boolean);
  const emails = parts.filter((p) => p.includes("@"));
  const phones = parts.filter((p) => !p.includes("@") && /\d/.test(p));
  const other = parts.filter((p) => !emails.includes(p) && !phones.includes(p));
  return { emails, phones, other };
}

export function PersonCard({
  person, brand, onOpen, draggable, onDragStart,
}: {
  person: Person;
  brand?: Brand;
  onOpen: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const { emails, phones, other } = channelParts(person.channel);

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
      className="group cursor-pointer rounded-card border border-[var(--border)] bg-surface p-2.5 shadow-card transition-colors hover:border-[var(--border-strong)]"
    >
      <div className="flex items-center gap-2.5">
        <BrandMark
          name={person.org ?? person.name}
          logoUrl={brand?.logo_url}
          color={brand?.color}
          size={34}
          radius="rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-text">{person.name}</p>
          <p className="truncate text-[11px] text-text-muted">{person.role || "Role not recorded"}</p>
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        {emails.map((e) => (
          <a
            key={e}
            href={`mailto:${e}`}
            onClick={(ev) => ev.stopPropagation()}
            className="flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text"
          >
            <AtSign size={11} className="shrink-0" />
            <span className="truncate">{e}</span>
          </a>
        ))}
        {phones.map((t) => (
          <a
            key={t}
            href={`tel:${t.replace(/[^\d+]/g, "")}`}
            onClick={(ev) => ev.stopPropagation()}
            className="flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text"
          >
            <Phone size={11} className="shrink-0" />
            <span className="truncate">{t}</span>
          </a>
        ))}
        {other.map((o) => (
          <p key={o} className="truncate text-[11px] text-text-muted">{o}</p>
        ))}
        {/* Said plainly rather than left as an empty card that looks broken. */}
        {emails.length + phones.length + other.length === 0 && (
          <p className="text-[11px] text-accent-orange">No contact recorded</p>
        )}
      </div>

      {person.org && (
        <div className="mt-1.5">
          {brand ? (
            <Link
              href={`/dashboard/brands/${brand.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[11px] font-medium text-text-muted transition-colors hover:text-text"
            >
              {person.org}
            </Link>
          ) : (
            <span className="truncate text-[11px] text-text-muted">{person.org}</span>
          )}
        </div>
      )}
    </article>
  );
}
