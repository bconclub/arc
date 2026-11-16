"use client";

import Link from "next/link";
import { MessageSquare, Star } from "lucide-react";

export type ReviewProduct = { slug: string; name: string; notes: string | null; status: string; ads: number; waiting: number; approved: number; comments: number; avg: number | null };
export type ReviewBrand = { slug: string; name: string; palette: string[]; products: ReviewProduct[] };

export function ProductCard({ brand, p }: { brand: string; p: ReviewProduct }) {
  return (
    <Link href={`/dashboard/studio/review/${brand}/${p.slug}`}
      className="flex min-w-0 flex-col gap-2 rounded-panel border border-[var(--border)] bg-surface p-4 transition-colors duration-150 hover:border-[var(--brand-line)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-text">{p.name}</h3>
        {p.status === "closed" && <span className="text-[11.5px] text-text-muted">Closed</span>}
      </div>
      {p.notes && <p className="line-clamp-2 text-[12.5px] leading-snug text-text-muted">{p.notes}</p>}
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted">
        <span><span className="text-text">{p.ads}</span> ads</span>
        {p.waiting > 0 && <span><span className="text-text">{p.waiting}</span> to review</span>}
        {p.approved > 0 && <span><span className="text-text">{p.approved}</span> approved</span>}
        <span className="flex items-center gap-1"><MessageSquare size={12} /> {p.comments}</span>
        {p.avg !== null && <span className="flex items-center gap-1"><Star size={12} /> {p.avg.toFixed(1)}</span>}
      </p>
    </Link>
  );
}
