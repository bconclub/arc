"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, CircleDot, ExternalLink, GitBranch, GitGraph, Globe, Image as ImageIcon, Mail, Pencil, Phone, Save, User, X,
} from "lucide-react";
import { money, moneyShort, timeAgo, initials, avatarColor } from "@/lib/format";
import { rollupBrand, brandKeys, contactsFor, parseChannel, UNPAID, IN_PLAY } from "@/lib/rollup";
import { HealthRing, TrendLine, Donut } from "@/components/ops/Charts";
import { BrandMark } from "@/components/ops/BrandMark";
import { InvoiceQueue } from "@/components/money/InvoiceQueue";
import { SitePreview } from "@/components/ops/SitePreview";
import { BrandTimeline } from "@/components/ops/BrandTimeline";
import {
  BRAND_KIND_LABEL,
  type Brand, type BrandKind, type Project, type Payment, type Proposal,
  type OpsSignal, type Person, type GithubActivity,
} from "@/types/ops";

const KIND_COLOR: Record<BrandKind, string> = {
  client: "#00d4aa", agency: "#8b5cf6", partner: "#3b82f6",
  prospect: "#f59e0b", own: "#6b6b6b",
};

// The client register owns this vocabulary ('active', …) and can add values we
// don't know about, so never index this map without the fallback below.
const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  active: { text: "Active", color: "#00d4aa" },
  on_track: { text: "On track", color: "#00d4aa" },
  at_risk: { text: "At risk", color: "#f59e0b" },
  paused: { text: "Paused", color: "#f59e0b" },
  dormant: { text: "Dormant", color: "#6b6b6b" },
  archived: { text: "Archived", color: "#6b6b6b" },
  lost: { text: "Lost", color: "#e5484d" },
};

type TabKey = "overview" | "money" | "work" | "people" | "profile";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "money", label: "Money" },
  { key: "work", label: "Work" },
  { key: "people", label: "People" },
  { key: "profile", label: "Profile" },
];

function statusOf(status: string): { text: string; color: string } {
  return STATUS_LABEL[status] ?? { text: status.replace(/_/g, " "), color: "#6b6b6b" };
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-1.5 text-[12.5px] text-text placeholder:text-text-muted";

export default function BrandProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  // The billing vault holds everything ever invoiced, back to 2021. Without it
  // a brand billed Rs 23,289 in 2022 reported zeros across every card.
  const [vault, setVault] = useState<{ brand_id: string | null; client_name: string; kind: string; gross_amount: number | null; amount: number | null; issued_on: string | null; gst_pct: number | null; doc_no: string | null }[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [gh, setGh] = useState<GithubActivity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [renameNote, setRenameNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoNote, setLogoNote] = useState<string | null>(null);

  const [form, setForm] = useState({
    aliases: "", domains: "", notes: "", status: "active", logo_url: "", color: "", github_repos: "",
    kind: "client", via_brand_id: "",
  });

  // Overview answers "what is this brand and what have we done for them".
  // Everything else is one click away rather than stacked below it.
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [deleteInfo, setDeleteInfo] = useState<{ total: number; counts: Record<string, number> } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    const j = (url: string) => fetch(url).then((r) => r.json()).catch(() => []);
    const [br, pr, pay, prop, sig, ppl, gha, vlt] = await Promise.all([
      j("/api/ops/brands"), j("/api/ops/projects"), j("/api/ops/payments"),
      j("/api/ops/proposals"), j("/api/ops/alerts"), j("/api/ops/people"),
      fetch("/api/ops/github").then((r) => r.json()).catch(() => null),
      j("/api/ops/billing"),
    ]);
    setVault(Array.isArray(vlt) ? vlt : []);
    const list: Brand[] = Array.isArray(br) ? br : [];
    setAllBrands(list);
    const found = list.find((b) => b.id === id) ?? null;
    setBrand(found);
    if (found) {
      setForm({
        aliases: (found.aliases ?? []).join(", "),
        domains: (found.domains ?? []).join(", "),
        github_repos: (found.github_repos ?? []).join(", "),
        notes: found.notes ?? "",
        status: found.status,
        logo_url: found.logo_url ?? "",
        color: found.color ?? "",
        kind: found.kind ?? "client",
        via_brand_id: found.via_brand_id ?? "",
      });
    }
    setProjects(Array.isArray(pr) ? pr : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setProposals(Array.isArray(prop) ? prop : []);
    setSignals(Array.isArray(sig) ? sig : []);
    setPeople(Array.isArray(ppl) ? ppl : []);
    setGh(gha && typeof gha === "object" ? (gha as GithubActivity) : null);
    setLoaded(true);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /** "a, b,  c" → ["a","b","c"]; blank input becomes null so the column clears. */
  function toArray(s: string): string[] | null {
    const list = s.split(",").map((x) => x.trim()).filter(Boolean);
    return list.length ? list : null;
  }

  /**
   * Renames the brand and keeps its history attached.
   *
   * Payments, projects and proposals store the client as free text, so a plain
   * rename would orphan every row that still carries the old spelling: the money
   * would silently vanish from this page. The old name is therefore pushed into
   * `aliases`, which is exactly what the rollup already matches on, so nothing
   * detaches.
   */
  async function renameBrand() {
    if (!brand) return;
    const next = draftName.trim();
    if (!next || next === brand.name) { setRenaming(false); return; }

    setSavingName(true);
    setRenameNote("");
    const aliases = Array.from(new Set([...(brand.aliases ?? []), brand.name].filter(Boolean)));
    const res = await fetch(`/api/ops/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next, aliases }),
    });
    setSavingName(false);
    if (!res.ok) { setRenameNote("Could not rename that brand."); return; }
    setRenaming(false);
    setRenameNote(`Renamed. "${brand.name}" kept as an alias so existing invoices and projects stay linked.`);
    load();
  }

  async function save() {
    if (!brand) return;
    setSaving(true);
    await fetch(`/api/ops/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.status,
        notes: form.notes,
        logo_url: form.logo_url,
        color: form.color,
        kind: form.kind,
        via_brand_id: form.via_brand_id || null,
        aliases: toArray(form.aliases),
        domains: toArray(form.domains),
        github_repos: toArray(form.github_repos),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    load();
  }

  const viaBrand = useMemo(
    () => (brand?.via_brand_id ? allBrands.find((b) => b.id === brand.via_brand_id) ?? null : null),
    [brand, allBrands]
  );

  /** Adds owner/repo to this brand without touching the rest of the form. */
  async function addRepo() {
    const slug = newRepo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!brand || !slug.includes("/")) return;
    const next = Array.from(new Set([...(brand.github_repos ?? []), slug]));
    await fetch(`/api/ops/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_repos: next }),
    });
    setNewRepo("");
    load();
  }

  async function removeRepo(slug: string) {
    if (!brand) return;
    const next = (brand.github_repos ?? []).filter((r) => r !== slug);
    await fetch(`/api/ops/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_repos: next.length ? next : null }),
    });
    load();
  }

  /** Searches the linked repos, then the site favicon, and stores the winner. */
  async function pullLogo() {
    if (!brand) return;
    setLogoBusy(true);
    setLogoNote(null);
    try {
      const res = await fetch("/api/ops/brands/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id }),
      });
      const j = await res.json();
      setLogoNote(j.applied ? `Found ${j.applied.label}` : (j.detail ?? "Nothing found."));
      if (j.applied) load();
    } catch {
      setLogoNote("Lookup failed.");
    } finally {
      setLogoBusy(false);
    }
  }

  const roll = useMemo(
    () => (brand ? rollupBrand(brand, projects, payments, proposals, signals) : null),
    [brand, projects, payments, proposals, signals]
  );

  const mine = useMemo(() => {
    if (!brand) return { payments: [], projects: [], proposals: [], repos: [], events: [], commits: [], contacts: [], viaContacts: [] };
    // Must use the same name+aliases keys as rollupBrand, or the totals in the
    // header and the rows listed below them disagree.
    const keys = brandKeys(brand);
    const match = (c: string | null) => !!c && keys.includes(c.trim().toLowerCase());
    const slugs = (brand.github_repos ?? []).map((s) => s.toLowerCase());
    return {
      payments: payments.filter((p) => match(p.client)),
      // Same union rollupBrand uses: the brand_id FK first, client text second.
      projects: projects.filter((p) => p.brand_id === brand.id || match(p.client)),
      proposals: proposals.filter((p) => match(p.client)),
      repos: (gh?.repos ?? []).filter((r) => slugs.includes(r.name.toLowerCase())),
      events: (gh?.events ?? []).filter((e) => slugs.includes(e.repo.toLowerCase())),
      commits: (gh?.commits ?? []).filter((c) => slugs.includes(c.repo.toLowerCase())),
      contacts: contactsFor(brand, people),
      // Work arriving through an agency means the day-to-day contacts sit on the
      // agency, not the client. Kosh Studios would otherwise look contactless.
      viaContacts: viaBrand ? contactsFor(viaBrand, people) : [],
    };
  }, [brand, viaBrand, payments, projects, proposals, people, gh]);

  // Counts are fetched when the tab opens so the warning is specific rather
  // than a generic "are you sure".
  useEffect(() => {
    if (tab !== "profile" || !brand) return;
    let live = true;
    fetch(`/api/ops/brands/${brand.id}`)
      .then((r) => r.json())
      .then((d) => { if (live && d?.counts) setDeleteInfo({ total: d.total, counts: d.counts }); })
      .catch(() => {});
    return () => { live = false; };
  }, [tab, brand]);

  async function removeBrand() {
    if (!brand) return;
    const attached = deleteInfo && deleteInfo.total > 0;
    const warning = attached
      ? `Remove "${brand.name}"? ${deleteInfo!.total} attached record(s) will be left with nothing to roll up to.`
      : `Remove "${brand.name}"?`;
    if (!confirm(warning)) return;
    setDeleting(true); setDeleteError("");
    const res = await fetch(`/api/ops/brands/${brand.id}${attached ? "?force=1" : ""}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok) { setDeleteError(body?.error ?? "Could not remove that brand."); return; }
    router.push("/dashboard/brands");
  }

  if (!loaded) return <p className="px-6 py-16 text-center text-[13px] text-text-muted">Loading…</p>;

  if (!brand || !roll) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-[13px] text-text-muted">Brand not found.</p>
        <Link href="/dashboard/brands" className="mt-3 inline-flex items-center gap-1 text-[12px] text-accent-red hover:underline">
          <ChevronLeft size={13} /> Back to brands
        </Link>
      </div>
    );
  }

  // website is on the newer table; domains is what the client register fills
  // in. Either is a real address for this brand, so both are accepted.
  const site = brand.website || brand.domains?.[0] || null;

  // Signals naming this brand. Matched on the title and detail text, since
  // signals carry no brand column.
  const brandSignals = signals.filter((sg) => {
    const hay = `${sg.title} ${sg.detail ?? ""}`.toLowerCase();
    return brandKeys(brand).some((k) => k.length > 2 && hay.includes(k));
  });

  // Matched on brand_id where the import linked it, falling back to the name
  // for anything added by hand.
  const myDocs = vault.filter((d) =>
    d.brand_id === brand.id ||
    brandKeys(brand).includes((d.client_name ?? "").trim().toLowerCase()),
  );
  const billedEver = myDocs
    .filter((d) => d.kind === "invoice")
    .reduce((s, d) => s + Number(d.gross_amount ?? d.amount ?? 0), 0);

  const accent = brand.color ?? avatarColor(brand.name);
  const st = statusOf(brand.status);
  const kind = (brand.kind ?? "client") as BrandKind;
  const via = viaBrand;

  return (
    <div className="space-y-3 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
      <Link href="/dashboard/brands" className="inline-flex items-center gap-1 text-[11.5px] text-text-muted hover:text-text">
        <ChevronLeft size={13} /> All brands
      </Link>

      {/* ── Identity ── */}
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-surface p-4">
        <BrandMark name={brand.name} logoUrl={brand.logo_url} color={brand.color} size={56} radius="rounded-xl" />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draftName}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameBrand();
                  if (e.key === "Escape") { setRenaming(false); setDraftName(brand.name); }
                }}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-hover)] px-2 py-1 text-[20px] font-bold tracking-tight text-text"
              />
              <button
                onClick={renameBrand}
                disabled={savingName || !draftName.trim() || draftName.trim() === brand.name}
                className="rounded-pill bg-[var(--brand)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-ink)] disabled:opacity-50"
              >
                {savingName ? "Saving" : "Save"}
              </button>
              <button
                onClick={() => { setRenaming(false); setDraftName(brand.name); }}
                className="rounded-pill px-2 py-1.5 text-[12px] text-text-muted hover:text-text"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="group flex min-w-0 items-center gap-2">
              <span className="truncate text-[22px] font-bold tracking-tight text-text">{brand.name}</span>
              {/* Always visible and labelled. Hidden behind hover it was
                  undiscoverable, which is the same as not existing. */}
              <button
                onClick={() => { setDraftName(brand.name); setRenaming(true); }}
                aria-label="Rename brand"
                className="flex shrink-0 items-center gap-1 rounded-pill border border-[var(--border-strong)] px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-text"
              >
                <Pencil size={12} /> Rename
              </button>
            </h1>
          )}
          {renameNote && <p className="mt-1 text-[11px] text-accent-orange">{renameNote}</p>}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-muted">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: `${KIND_COLOR[kind]}22`, color: KIND_COLOR[kind] }}
            >
              {BRAND_KIND_LABEL[kind]}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} /> {st.text}
            </span>
            {via && (
              <Link href={`/dashboard/brands/${via.id}`} className="hover:text-text">
                via <span className="text-text">{via.name}</span>
              </Link>
            )}
            {brand.domains?.[0] && (
              <a
                href={`https://${brand.domains[0].replace(/^https?:\/\//, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-text"
              >
                <Globe size={11} /> {brand.domains[0].replace(/^https?:\/\//, "")}
              </a>
            )}
            {brand.gstin && <span className="flex items-center gap-1 font-mono"><User size={11} /> {brand.gstin}</span>}
            {brand.place_of_supply && <span>{brand.place_of_supply}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <HealthRing score={roll.health} size={64} thickness={6} />
          <span className="mt-1 text-[9px] text-text-muted">Health score</span>
        </div>
      </header>

      {/* ── Money + work ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          // "Out there" reads as a confident zero when every unpaid invoice on the
          // brand has no amount recorded, which is the opposite of the truth.
          {
            label: roll.unpricedCount > 0 && roll.owed === 0
              ? `${roll.unpricedCount} invoice${roll.unpricedCount === 1 ? "" : "s"}, no amount`
              : "Out there",
            value: roll.unpricedCount > 0 && roll.owed === 0 ? "Not recorded" : moneyShort(roll.owed),
            color: roll.unpricedCount > 0 && roll.owed === 0 ? "#f59e0b" : "#e5484d",
          },
          { label: "Overdue", value: moneyShort(roll.overdue), color: "#f59e0b" },
          // Everything ever invoiced, from the vault. Collected below counts
          // only what a payment row confirms, which is a smaller thing.
          { label: "Billed ever", value: billedEver > 0 ? moneyShort(billedEver) : "-", color: "#8b5cf6" },
          { label: "Collected", value: moneyShort(roll.collected), color: "#00d4aa" },
          { label: "Pipeline", value: moneyShort(roll.pipeline), color: "#8b5cf6" },
          { label: "Open tasks", value: String(roll.openTasks), color: "#3b82f6" },
          { label: "Avg progress", value: `${roll.avgProgress}%`, color: "#6b6b6b" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-[var(--border)] bg-surface p-3">
            <p className="text-[16px] font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
            <p className="mt-0.5 text-[10px] text-text-muted">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-pill border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
              tab === t.key
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                : "border-[var(--border)] text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            {/* The site as it stands today, if there is one. */}
            {site ? (
              <SitePreview website={site} />
            ) : (
              <p className="rounded-card border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11.5px] text-text-muted">
                No website recorded.
              </p>
            )}

            {brand.notes && (
              <section className="rounded-card border border-[var(--border)] bg-surface p-3">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.09em] text-text-muted">Notes</h2>
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-text">{brand.notes}</p>
              </section>
            )}

            <section className="rounded-card border border-[var(--border)] bg-surface p-3">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.09em] text-text-muted">At a glance</h2>
              <dl className="mt-2 space-y-1.5 text-[11.5px]">
                {[
                  { k: "Projects", v: `${roll.projectCount} total, ${roll.openProjects} in flight` },
                  { k: "Invoices", v: `${mine.payments.length} raised` },
                  { k: "Proposals", v: `${mine.proposals.length} sent` },
                  { k: "Contacts", v: String(mine.contacts.length + mine.viaContacts.length) },
                  ...(brand.first_seen ? [{ k: "First seen", v: brand.first_seen }] : []),
                ].map((r) => (
                  <div key={r.k} className="flex items-baseline justify-between gap-2">
                    <dt className="shrink-0 text-text-muted">{r.k}</dt>
                    <dd className="min-w-0 truncate text-right text-text">{r.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section>
            <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
              What we have done
            </h2>
            <BrandTimeline
              projects={mine.projects}
              payments={mine.payments}
              proposals={mine.proposals}
              signals={brandSignals}
            />
          </section>
        </div>
      )}

      {tab === "money" && myDocs.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
            Billing history <span className="ml-1 font-normal text-text-muted">{myDocs.length} document{myDocs.length === 1 ? "" : "s"}</span>
          </h2>
          <p className="mt-1 text-[11px] text-text-muted">
            Everything ever issued. Whether each was settled is not recorded, so none is shown as paid.
          </p>
          <div className="mt-2.5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead>
                <tr className="text-left text-[9.5px] uppercase tracking-wider text-text-muted">
                  {["Date", "Number", "Work value", "GST", "Amount due"].map((h) => (
                    <th key={h} className="py-1.5 pr-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myDocs.map((d, i) => (
                  <tr key={`${d.doc_no}-${i}`} className="border-t border-[var(--border)]">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-text-muted">{d.issued_on ?? "-"}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-text-muted">
                      {d.doc_no ?? "-"}
                      {/* A quote is not revenue and must never read as one. */}
                      {d.kind !== "invoice" && (
                        <span className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase text-accent-orange">
                          {d.kind}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-text">{money(Number(d.gross_amount ?? 0))}</td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-text-muted">{d.gst_pct ? `${d.gst_pct}%` : "-"}</td>
                    <td className="whitespace-nowrap py-2 pr-3 font-medium tabular-nums text-text">{money(Number(d.amount ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "money" && (<>
      {/* Reads this brand's invoices straight out of email. Scoped to the
          brand name so it does not trawl the whole mailbox. */}
      <InvoiceQueue
        payments={payments}
        brand={brand.name}
        title={`Invoices in email for ${brand.name}`}
        onChanged={load}
      />
      </>)}

      {tab === "money" && (<>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ── Receivables ── */}
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">Receivables</h2>
          <div className="mt-3 flex items-center gap-4">
            <Donut
              size={98} thickness={11}
              center={moneyShort(roll.owed)} sub="open"
              segments={[
                { label: "Overdue", value: roll.overdue, color: "#e5484d" },
                { label: "Not yet due", value: Math.max(0, roll.owed - roll.overdue), color: "#00d4aa" },
              ]}
            />
            <TrendLine values={roll.moneySeries} color={accent} height={44} />
          </div>
          <ul className="mt-3 space-y-1">
            {mine.payments.filter((p) => UNPAID.includes(p.status)).slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-t border-[var(--border)] pt-1.5 text-[11.5px]">
                <span className="min-w-0 flex-1 truncate text-text">{p.item ?? "-"}</span>
                <span className="shrink-0 tabular-nums text-text">{money(p.amount)}</span>
                <span className={`shrink-0 text-[10px] ${p.status === "overdue" ? "text-accent-red" : "text-text-muted"}`}>
                  {p.status}
                </span>
              </li>
            ))}
            {mine.payments.length === 0 && <li className="py-3 text-[11px] text-text-muted">No payments recorded.</li>}
          </ul>
        </section>

        {/* ── Projects ── */}
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
            Projects <span className="text-text-muted">({mine.projects.length})</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {mine.projects.slice(0, 6).map((p) => (
              <li key={p.id}>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <span className="min-w-0 flex-1 truncate text-text">{p.name}</span>
                  <span className="shrink-0 text-[10px] text-text-muted">{p.status}</span>
                  <span className="shrink-0 tabular-nums text-[10px] text-text-muted">{p.progress}%</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: accent }} />
                </div>
              </li>
            ))}
            {mine.projects.length === 0 && <li className="py-3 text-[11px] text-text-muted">No projects yet.</li>}
          </ul>
        </section>

        {/* ── Proposals ── */}
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
            Proposals <span className="text-text-muted">({mine.proposals.length})</span>
          </h2>
          <ul className="mt-3 space-y-1">
            {mine.proposals.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-t border-[var(--border)] pt-1.5 text-[11.5px] first:border-t-0">
                <span className="min-w-0 flex-1 truncate text-text">{p.name}</span>
                <span className="shrink-0 tabular-nums text-text">{money(p.amount)}</span>
                <span className={`shrink-0 text-[10px] ${IN_PLAY.includes(p.status) ? "text-accent-orange" : "text-text-muted"}`}>
                  {p.status}
                </span>
              </li>
            ))}
            {mine.proposals.length === 0 && <li className="py-3 text-[11px] text-text-muted">No proposals yet.</li>}
          </ul>
        </section>
      </div>
      </>)}

      {tab === "work" && (<>
      {/* ── GitHub ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
        <h2 className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
          <GitGraph size={13} /> Repos
          {brand.github_repos?.length ? <span className="text-text-muted">({brand.github_repos.length})</span> : null}
        </h2>

        {/* Add a repo inline, this is how logo and asset folders get pulled in. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newRepo}
            onChange={(e) => setNewRepo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRepo()}
            placeholder="owner/repo, or paste a GitHub URL"
            className={`${inputCls} max-w-xs flex-1`}
          />
          <button onClick={addRepo} className="rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-bg">
            Link repo
          </button>
          <button
            onClick={pullLogo}
            disabled={logoBusy}
            title="Search the linked repos for a logo file, then fall back to the site favicon"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text disabled:opacity-50"
          >
            <ImageIcon size={13} /> {logoBusy ? "Looking…" : "Pull logo"}
          </button>
          {logoNote && <span className="text-[11px] text-text-muted">{logoNote}</span>}
        </div>

        {brand.github_repos?.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {brand.github_repos.map((r) => (
              <li key={r} className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-text">
                <GitBranch size={11} className="text-text-muted" />
                {r}
                <button onClick={() => removeRepo(r)} aria-label={`Unlink ${r}`} className="ml-0.5 text-text-muted hover:text-accent-red">
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!brand.github_repos?.length ? (
          <p className="py-3 text-[11.5px] text-text-muted">
            No repos linked yet. Add one above to pull logos and track commits for this brand.
          </p>
        ) : !gh?.configured ? (
          <p className="py-4 text-[11.5px] text-text-muted">{gh?.error ?? "GitHub not configured."}</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ul className="space-y-1">
              {mine.repos.map((r) => (
                <li
                  key={r.name}
                  className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
                  style={{ borderColor: r.accessible ? "var(--border)" : "rgba(245,158,11,0.4)" }}
                >
                  <GitBranch size={12} className="shrink-0 text-text-muted" />
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[11.5px] text-text hover:underline">
                    {r.name}
                  </a>
                  {r.external && (
                    <span className="shrink-0 rounded border border-[var(--border-strong)] px-1 text-[8.5px] uppercase text-text-muted">
                      client
                    </span>
                  )}
                  {!r.accessible ? (
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-accent-orange" title="Token cannot read this repo">
                      no access
                    </span>
                  ) : (
                    <>
                      {r.openIssues > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-text-muted">
                          <CircleDot size={10} /> {r.openIssues}
                        </span>
                      )}
                      <span className="shrink-0 whitespace-nowrap text-[10px] text-text-muted">{timeAgo(r.pushedAt)}</span>
                    </>
                  )}
                </li>
              ))}
              {mine.repos.length === 0 && (
                <li className="py-3 text-[11px] text-text-muted">Linked repos not found.</li>
              )}
            </ul>
            <ul className="space-y-1">
              {mine.commits.slice(0, 6).map((c) => (
                <li key={`${c.repo}-${c.sha}`} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] text-text">{c.message}</span>
                    <span className="block truncate text-[9.5px] text-text-muted">
                      <span className="font-mono">{c.sha}</span> · {c.author}
                    </span>
                  </span>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-text-muted hover:text-text">
                      <ExternalLink size={11} />
                    </a>
                  )}
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-text-muted">{timeAgo(c.date)}</span>
                </li>
              ))}
              {mine.commits.length === 0 && (
                <li className="py-3 text-[11px] text-text-muted">
                  No recent commits (only the most recently pushed repos are fetched).
                </li>
              )}
            </ul>
          </div>
        )}
      </section>
      </>)}

      {tab === "people" && (<>
      {/* ── Contacts ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
          Contacts <span className="text-text-muted">({mine.contacts.length + mine.viaContacts.length})</span>
        </h2>
        {mine.contacts.length === 0 && mine.viaContacts.length === 0 ? (
          <p className="py-4 text-[11.5px] text-text-muted">
            No contacts linked. Add a person under{" "}
            <Link href="/dashboard/ops/people" className="text-text underline">People</Link>{" "}
            and set their brand.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {mine.contacts.map((c) => {
              const ch = parseChannel(c.channel);
              return (
                <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: avatarColor(c.name) }}
                    >
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-text">{c.name}</span>
                      <span className="block truncate text-[10px] text-text-muted">{c.role ?? c.relation ?? "-"}</span>
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {ch.emails.map((e) => (
                      <a key={e} href={`mailto:${e}`} className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text">
                        <Mail size={11} className="shrink-0" />
                        <span className="truncate">{e}</span>
                      </a>
                    ))}
                    {ch.phones.map((t) => (
                      <a key={t} href={`tel:${t}`} className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text">
                        <Phone size={11} className="shrink-0" />
                        <span className="truncate">{t}</span>
                      </a>
                    ))}
                    {ch.other.map((o) => (
                      <span key={o} className="block truncate text-[11px] text-text-muted">{o}</span>
                    ))}
                    {!c.channel && <span className="text-[11px] text-text-muted">No contact details</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {mine.viaContacts.length > 0 && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-[10px] text-text-muted">
              Via <Link href={`/dashboard/brands/${via?.id}`} className="text-text hover:underline">{via?.name}</Link>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {mine.viaContacts.map((c) => {
                const ch = parseChannel(c.channel);
                return (
                  <div key={c.id} className="rounded-xl border border-dashed border-[var(--border-strong)] p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: avatarColor(c.name) }}
                      >
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-text">{c.name}</span>
                        <span className="block truncate text-[10px] text-text-muted">{c.role ?? c.relation ?? "-"}</span>
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {ch.emails.map((e) => (
                        <a key={e} href={`mailto:${e}`} className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text">
                          <Mail size={11} className="shrink-0" /><span className="truncate">{e}</span>
                        </a>
                      ))}
                      {ch.phones.map((t) => (
                        <a key={t} href={`tel:${t}`} className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text">
                          <Phone size={11} className="shrink-0" /><span className="truncate">{t}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      </>)}

      {tab === "profile" && (<>
      {/* ── Billing (read-only: owned by the client register, not the dashboard) ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
          Billing <span className="font-normal normal-case tracking-normal text-text-muted">· read-only</span>
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "GSTIN", value: brand.gstin ?? "-", mono: true },
            { label: "Place of supply", value: brand.place_of_supply ?? "-" },
            { label: "State code", value: brand.state_code ?? "-" },
            { label: "Currency", value: brand.currency ?? "-" },
            { label: "Export", value: brand.is_export ? "Yes" : "No" },
            { label: "Lifetime revenue", value: moneyShort(brand.lifetime_revenue) },
            {
              label: "Client since",
              value: brand.first_seen
                ? new Date(brand.first_seen + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" })
                : "-",
            },
          ].map((f) => (
            <div key={f.label} className="min-w-0">
              <p className={`truncate text-[12px] font-semibold text-text ${f.mono ? "font-mono text-[11px]" : ""}`}>
                {f.value}
              </p>
              <p className="mt-0.5 text-[9.5px] text-text-muted">{f.label}</p>
            </div>
          ))}
        </div>
        {brand.aliases?.length ? (
          <p className="mt-3 border-t border-[var(--border)] pt-2 text-[10.5px] text-text-muted">
            Also billed as: <span className="text-text">{brand.aliases.join(" · ")}</span>
          </p>
        ) : null}
      </section>
      </>)}

      {tab === "profile" && (<>
      {/* ── Editable profile ── */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">Profile</h2>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[10px] text-text-muted">
              Aliases <span className="opacity-70">other spellings used on invoices, comma separated</span>
            </span>
            <input
              className={inputCls} value={form.aliases}
              placeholder="Laptop Store, Laptopstore, itel computer"
              onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-text-muted">Domains, comma separated</span>
            <input className={inputCls} value={form.domains} placeholder="example.com" onChange={(e) => setForm({ ...form, domains: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[10px] text-text-muted">GitHub repos: owner/repo, comma separated</span>
            <input
              className={inputCls} value={form.github_repos}
              placeholder="bconclub/proxe, bconclub/goproxe.com"
              onChange={(e) => setForm({ ...form, github_repos: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-text-muted">Type</span>
            <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {(Object.keys(BRAND_KIND_LABEL) as BrandKind[]).map((k) => (
                <option key={k} value={k}>{BRAND_KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-text-muted">
              Work arrives via <span className="opacity-70">agency or partner</span>
            </span>
            <select className={inputCls} value={form.via_brand_id} onChange={(e) => setForm({ ...form, via_brand_id: e.target.value })}>
              <option value="">Direct, no intermediary</option>
              {allBrands
                .filter((b) => b.id !== brand.id && ["agency", "partner"].includes(b.kind ?? ""))
                .map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-text-muted">Status</span>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="at_risk">At risk</option>
              <option value="paused">Paused</option>
              <option value="dormant">Dormant</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-text-muted">Logo URL</span>
            <input className={inputCls} value={form.logo_url} placeholder="https://…/logo.png" onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-text-muted">Accent colour</span>
            <input className={inputCls} value={form.color} placeholder="#e5484d" onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-[10px] text-text-muted">Notes</span>
            <textarea className={`${inputCls} min-h-[64px]`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-bg disabled:opacity-50"
          >
            <Save size={13} /> {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-[11.5px] text-accent-green">Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--accent-red,#e5484d)] border-opacity-40 bg-surface p-4">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-accent-red">Remove this brand</h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-muted">
          {deleteInfo == null
            ? "Checking what is attached."
            : deleteInfo.total === 0
              ? "Nothing is attached to this brand. Removing it affects nothing else."
              : `Attached: ${[
                  deleteInfo.counts.payments && `${deleteInfo.counts.payments} invoice${deleteInfo.counts.payments === 1 ? "" : "s"}`,
                  deleteInfo.counts.documents && `${deleteInfo.counts.documents} vault document${deleteInfo.counts.documents === 1 ? "" : "s"}`,
                  deleteInfo.counts.projects && `${deleteInfo.counts.projects} project${deleteInfo.counts.projects === 1 ? "" : "s"}`,
                  deleteInfo.counts.proposals && `${deleteInfo.counts.proposals} proposal${deleteInfo.counts.proposals === 1 ? "" : "s"}`,
                  deleteInfo.counts.people && `${deleteInfo.counts.people} contact${deleteInfo.counts.people === 1 ? "" : "s"}`,
                ].filter(Boolean).join(", ")}. Invoices and projects store the client as text, so they are not deleted with the brand. They stay in the database with nothing to roll them up to, which means the money vanishes from every screen without being gone.`}
        </p>
        {deleteError && <p className="mt-2 text-[11.5px] text-accent-red">{deleteError}</p>}
        <button
          onClick={removeBrand}
          disabled={deleting}
          className="mt-3 rounded-pill border border-accent-red px-3.5 py-1.5 text-[12px] font-medium text-accent-red transition-colors hover:bg-accent-red hover:text-white disabled:opacity-50"
        >
          {deleting ? "Removing." : deleteInfo && deleteInfo.total > 0 ? "Remove anyway" : "Remove brand"}
        </button>
      </section>

      </>)}
    </div>
  );
}
