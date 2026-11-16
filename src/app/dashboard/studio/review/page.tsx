"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProductCard, type ReviewBrand as Brand } from "@/components/studio/ReviewProductCard";

/**
 * Studio Review: finished ads waiting for the team's eyes, by brand and product.
 * Open a product to watch its cuts, rate them and leave comments.
 */

export default function ReviewHome() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/ops/studio/review", { cache: "no-store" })
      .then(async (r) => (r.ok ? setBrands((await r.json()).brands) : setErr("Could not load the review list.")))
      .catch(() => setErr("Could not load the review list."));
  }, []);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 lg:p-6">
      <header className="flex flex-col gap-2">
        <Link href="/dashboard/studio" className="flex w-fit items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text">
          <ArrowLeft size={14} /> Studio
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight text-text">Review</h1>
        <p className="max-w-[62ch] text-[12.5px] text-text-muted">
          Ads that are finished and waiting for the team. Watch each cut, give it a score and say what should change before it goes live.
        </p>
      </header>

      {err ? (
        <p className="text-[13px] text-accent-red">{err}</p>
      ) : brands === null ? (
        <div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : brands.length === 0 ? (
        <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-16 text-center">
          <p className="text-[13px] text-text">Nothing to review yet</p>
          <p className="text-[12px] text-text-muted">Products show up here once their ads are uploaded.</p>
        </div>
      ) : (
        brands.map((b) => (
          <section key={b.slug} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {b.palette[0] && <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.palette[0] }} />}
              <Link href={`/dashboard/studio/review/${b.slug}`} className="text-[15px] font-semibold tracking-tight text-text hover:underline">{b.name}</Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {b.products.map((p) => <ProductCard key={p.slug} brand={b.slug} p={p} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
