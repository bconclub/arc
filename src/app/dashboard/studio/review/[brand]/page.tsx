"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProductCard, type ReviewBrand as Brand } from "@/components/studio/ReviewProductCard";

/** One brand's products under review. */
export default function ReviewBrand({ params }: { params: { brand: string } }) {
  const [brand, setBrand] = useState<Brand | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/ops/studio/review", { cache: "no-store" })
      .then(async (r) => {
        const list: Brand[] = r.ok ? (await r.json()).brands : [];
        setBrand(list.find((b) => b.slug === params.brand) || null);
      })
      .catch(() => setBrand(null));
  }, [params.brand]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 lg:p-6">
      <header className="flex flex-col gap-2">
        <Link href="/dashboard/studio/review" className="flex w-fit items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text">
          <ArrowLeft size={14} /> Review
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight text-text">{brand?.name || "Review"}</h1>
      </header>
      {brand === undefined ? (
        <div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : brand === null ? (
        <p className="text-[13px] text-text-muted">Nothing from this brand is up for review.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {brand.products.map((p) => <ProductCard key={p.slug} brand={brand.slug} p={p} />)}
        </div>
      )}
    </div>
  );
}
