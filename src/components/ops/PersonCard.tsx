"use client";

import { useState } from "react";
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

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/**
 * The person's own face where there is one.
 *
 * Falls back to initials rather than the brand logo: two contacts at the same
 * client would otherwise be visually identical, which defeats the point of
 * having a picture at all. A URL that fails to load falls back the same way,
 * since a broken image icon is worse than no image.
 */
export function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = person.avatar_url;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] font-semibold text-text-muted"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials(person.name) || "?"}
    </span>
  );
}

const RELATION_COLOR: Record<string, string> = {
  client: "#00d4aa",
  prospect: "#f59e0b",
  partner: "#8b5cf6",
  vendor: "#3b82f6",
};

/** One row in the people list. */
export function PersonRow({
  person, brand, onOpen,
}: {
  person: Person;
  brand?: Brand;
  onOpen: () => void;
}) {
  const { emails, phones, other } = channelParts(person.channel);
  const relation = (person.relation ?? "").trim().toLowerCase();
  const color = RELATION_COLOR[relation] ?? "#6b6b6b";

  return (
    <div
      onClick={onOpen}
      className="grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-t border-[var(--border)] px-3 py-2.5 transition-colors first:border-t-0 hover:bg-[var(--glow-white)] md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
    >
      <Avatar person={person} size={38} />

      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight text-text">{person.name}</p>
        <p className="truncate text-[11.5px] text-text-muted">{person.role || "Role not recorded"}</p>
      </div>

      {/* On a phone these wrap under the name; on a wide screen they are columns. */}
      <div className="col-span-2 min-w-0 md:col-span-1">
        {emails.map((e) => (
          <a
            key={e}
            href={`mailto:${e}`}
            onClick={(ev) => ev.stopPropagation()}
            className="flex items-center gap-1.5 text-[11.5px] text-text-muted transition-colors hover:text-text"
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
            className="flex items-center gap-1.5 text-[11.5px] text-text-muted transition-colors hover:text-text"
          >
            <Phone size={11} className="shrink-0" />
            <span className="truncate">{t}</span>
          </a>
        ))}
        {other.map((o) => <p key={o} className="truncate text-[11.5px] text-text-muted">{o}</p>)}
        {emails.length + phones.length + other.length === 0 && (
          <p className="text-[11.5px] text-accent-orange">No contact recorded</p>
        )}
      </div>

      <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
        {person.org && (
          <>
            <BrandMark name={person.org} logoUrl={brand?.logo_url} color={brand?.color} size={18} radius="rounded" />
            {brand ? (
              <Link
                href={`/dashboard/brands/${brand.id}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate text-[11.5px] text-text-muted transition-colors hover:text-text"
              >
                {person.org}
              </Link>
            ) : (
              <span className="truncate text-[11.5px] text-text-muted">{person.org}</span>
            )}
          </>
        )}
      </div>

      <span
        className="col-span-2 justify-self-start rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize md:col-span-1 md:justify-self-end"
        style={{ background: `${color}22`, color }}
      >
        {relation || "unset"}
      </span>
    </div>
  );
}
