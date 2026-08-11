"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plug, RefreshCw, CheckCircle2, XCircle, MinusCircle, ExternalLink, ShieldCheck, Copy, Check,
  GitBranch, GitCommitHorizontal,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { OperationsHealth } from "@/components/ops/OperationsHealth";
import type { SystemService, GithubActivity } from "@/types/ops";

type ConnectorStatus = {
  key: string;
  name: string;
  category: string;
  description: string;
  docsUrl: string;
  configured: boolean;
  missing: string[];
  optionalSet: string[];
  probed: boolean;
  ok: boolean | null;
  detail: string;
};

type Payload = { probed: boolean; checkedAt: string; connectors: ConnectorStatus[] };

function StateIcon({ c }: { c: ConnectorStatus }) {
  if (!c.configured) return <MinusCircle size={15} className="text-text-muted" />;
  if (!c.probed) return <CheckCircle2 size={15} className="text-accent-orange" />;
  return c.ok
    ? <CheckCircle2 size={15} className="text-accent-green" />
    : <XCircle size={15} className="text-accent-red" />;
}

function stateLabel(c: ConnectorStatus): { text: string; color: string } {
  if (!c.configured) return { text: "Not configured", color: "#6b6b6b" };
  if (!c.probed) return { text: "Configured", color: "#f59e0b" };
  return c.ok ? { text: "Connected", color: "#00d4aa" } : { text: "Failing", color: "#e5484d" };
}

function EnvVar({ name, present }: { name: string; present: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(`${name}=`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={`Copy ${name}= to clipboard`}
      className="flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px] transition-colors"
      style={{
        borderColor: present ? "rgba(0,212,170,0.35)" : "var(--border-strong)",
        color: present ? "#00d4aa" : "var(--text-muted)",
      }}
    >
      {name}
      {copied ? <Check size={9} /> : <Copy size={9} className="opacity-50" />}
    </button>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [services, setServices] = useState<SystemService[]>([]);
  const [gh, setGh] = useState<GithubActivity | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (probe: boolean) => {
    if (probe) setChecking(true);
    try {
      const [conn, sv, gha] = await Promise.all([
        fetch(`/api/ops/connectors${probe ? "?probe=1" : ""}`).then((r) => r.json()),
        fetch("/api/ops/system-health").then((r) => r.json()).catch(() => []),
        fetch("/api/ops/github").then((r) => r.json()).catch(() => null),
      ]);
      setData(conn);
      setServices(Array.isArray(sv) ? sv : []);
      setGh(gha && typeof gha === "object" ? (gha as GithubActivity) : null);
    } catch {
      setData({ probed: false, checkedAt: new Date().toISOString(), connectors: [] });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const connectors = data?.connectors ?? [];
  const connected = connectors.filter((c) => c.configured).length;
  const failing = connectors.filter((c) => c.probed && c.ok === false).length;

  const categories = Array.from(new Set(connectors.map((c) => c.category)));

  return (
    <div className="space-y-4 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Plug size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Admin · Connectors</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              {connectors.length === 0
                ? "Loading…"
                : `${connected} of ${connectors.length} configured${failing ? ` · ${failing} failing` : ""}`}
              {data?.probed && ` · checked ${timeAgo(data.checkedAt)}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-bg disabled:opacity-50"
        >
          <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
          {checking ? "Testing…" : "Test all connections"}
        </button>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(0,212,170,0.25)] bg-[rgba(0,212,170,0.06)] p-3">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent-green" />
        <p className="text-[11.5px] leading-relaxed text-text-muted">
          <strong className="text-text">Secrets never touch the database.</strong> ARC only checks whether each
          environment variable is <em>present</em> and whether the service answers. The values stay on the server and
          are never sent to this page. To add a connector, put its variable in{" "}
          <code className="rounded bg-[var(--surface-hover)] px-1">.env.local</code> (or Vercel project settings) and
          restart.
        </p>
      </div>

      {/* Operations Health, moved off the dashboard so it stays a single screen. */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
        <div className="px-4 pb-2 pt-3.5">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">Operations health</h2>
          <p className="mt-0.5 text-[10.5px] text-text-muted">
            System &amp; service status, updated by “Test all connections”
          </p>
        </div>
        <OperationsHealth services={services} />
      </section>

      {/* GitHub, what's actually shipping across the repos. */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
        <div className="px-4 pb-2 pt-3.5">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">GitHub activity</h2>
          <p className="mt-0.5 text-[10.5px] text-text-muted">
            {gh?.org ? `Across ${gh.org}` : "Repos, commits & issues"}
          </p>
        </div>
        {!gh ? (
          <p className="px-4 py-6 text-center text-[12px] text-text-muted">Loading…</p>
        ) : !gh.configured || gh.error ? (
          <p className="px-4 py-6 text-center text-[12px] text-text-muted">{gh.error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[8.5px] font-semibold uppercase tracking-wide text-text-muted">
                Recently pushed
              </p>
              <ul className="space-y-1">
                {gh.repos.slice(0, 8).map((r) => (
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
                    {r.private && <span className="shrink-0 text-[9px] uppercase text-text-muted">private</span>}
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-text-muted">
                      {r.accessible ? timeAgo(r.pushedAt) : "no access"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[8.5px] font-semibold uppercase tracking-wide text-text-muted">
                Latest commits
              </p>
              <ul className="space-y-1">
                {gh.commits.slice(0, 8).map((c) => (
                  <li key={`${c.repo}-${c.sha}`} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5">
                    <GitCommitHorizontal size={12} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1">
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[11.5px] text-text hover:underline">
                        {c.message}
                      </a>
                      <span className="block truncate text-[9.5px] text-text-muted">
                        {c.repo.split("/")[1] ?? c.repo} · <span className="font-mono">{c.sha}</span> · {c.author}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-text-muted">{timeAgo(c.date)}</span>
                  </li>
                ))}
                {gh.commits.length === 0 && (
                  <li className="py-3 text-[11px] text-text-muted">No recent commits.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </section>

      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{cat}</h2>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {connectors.filter((c) => c.category === cat).map((c) => {
              const st = stateLabel(c);
              return (
                <div key={c.key} className="rounded-xl border border-[var(--border)] bg-surface p-3.5">
                  <div className="flex items-start gap-2.5">
                    <StateIcon c={c} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[13.5px] font-semibold text-text">{c.name}</h3>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide"
                          style={{ background: `${st.color}22`, color: st.color }}
                        >
                          {st.text}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-text-muted">{c.description}</p>
                      <p className="mt-1 text-[11px]" style={{ color: c.ok === false ? "#e5484d" : "var(--text-muted)" }}>
                        {c.detail}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {c.missing.length === 0 && c.optionalSet.length === 0 && c.configured && (
                          <span className="text-[9.5px] text-text-muted">All variables set</span>
                        )}
                        {c.missing.map((v) => <EnvVar key={v} name={v} present={false} />)}
                        {c.optionalSet.map((v) => <EnvVar key={v} name={v} present />)}
                      </div>
                    </div>

                    <a
                      href={c.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Get credentials for ${c.name}`}
                      className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:text-text"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {connectors.length === 0 && data && (
        <p className="py-12 text-center text-[13px] text-text-muted">No connectors registered.</p>
      )}
    </div>
  );
}
