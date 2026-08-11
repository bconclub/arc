import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { GithubActivity, GithubCommit, GithubEvent, GithubRepo } from "@/types/ops";

/** Cap on per-repo commit calls so a large account can't blow the rate limit. */
const MAX_COMMIT_REPOS = 10;
const COMMITS_PER_REPO = 4;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ACCOUNT = process.env.GITHUB_ORG || "bconclub";
const API = "https://api.github.com";

/**
 * GitHub splits these endpoints by account type, and `bconclub` is a User, not an
 * Organization — /orgs/{name} 404s for it. Resolve the type once, then pick the
 * matching endpoints. When the account IS the token's own user we use /user/repos,
 * which is the only variant that returns private repos (45 vs 39 here).
 */
async function resolveAccount(token: string): Promise<{
  type: "Organization" | "User";
  isSelf: boolean;
} | null> {
  const [acct, me] = await Promise.all([
    fetch(`${API}/users/${ACCOUNT}`, { headers: headers(token), cache: "no-store" }),
    fetch(`${API}/user`, { headers: headers(token), cache: "no-store" }),
  ]);
  if (!acct.ok) return null;
  const a = (await acct.json()) as { type?: string };
  const login = me.ok ? ((await me.json()) as { login?: string }).login : undefined;
  return {
    type: a.type === "Organization" ? "Organization" : "User",
    isSelf: !!login && login.toLowerCase() === ACCOUNT.toLowerCase(),
  };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "arc-dashboard",
  };
}

/** Turns a raw GitHub event into the one-line summary the dashboard shows. */
function describe(e: Record<string, unknown>): { type: string; title: string; url: string | null } {
  const type = String(e.type ?? "");
  const payload = (e.payload ?? {}) as Record<string, unknown>;
  const repoName = ((e.repo ?? {}) as { name?: string }).name ?? "";

  switch (type) {
    case "PushEvent": {
      const commits = (payload.commits ?? []) as { message?: string }[];
      const n = commits.length;
      const head = commits[commits.length - 1]?.message?.split("\n")[0] ?? "";
      const branch = String(payload.ref ?? "").replace("refs/heads/", "");
      return {
        type: "push",
        title: n > 1 ? `${n} commits to ${branch} — ${head}` : head || `pushed to ${branch}`,
        url: `https://github.com/${repoName}`,
      };
    }
    case "PullRequestEvent": {
      const pr = (payload.pull_request ?? {}) as { title?: string; html_url?: string; number?: number };
      return {
        type: "pull_request",
        title: `PR #${pr.number ?? "?"} ${String(payload.action ?? "")} — ${pr.title ?? ""}`,
        url: pr.html_url ?? null,
      };
    }
    case "IssuesEvent": {
      const issue = (payload.issue ?? {}) as { title?: string; html_url?: string; number?: number };
      return {
        type: "issues",
        title: `Issue #${issue.number ?? "?"} ${String(payload.action ?? "")} — ${issue.title ?? ""}`,
        url: issue.html_url ?? null,
      };
    }
    case "CreateEvent":
      return {
        type: "create",
        title: `created ${String(payload.ref_type ?? "ref")} ${String(payload.ref ?? "")}`.trim(),
        url: `https://github.com/${repoName}`,
      };
    case "ReleaseEvent": {
      const rel = (payload.release ?? {}) as { name?: string; tag_name?: string; html_url?: string };
      return { type: "release", title: `released ${rel.name || rel.tag_name || ""}`, url: rel.html_url ?? null };
    }
    default:
      return { type: type.replace("Event", "").toLowerCase(), title: type, url: `https://github.com/${repoName}` };
  }
}

/**
 * Recent activity across the org's repos. Needs GITHUB_TOKEN with `repo` +
 * `read:org`. Without it the route still answers 200 with configured:false so
 * the dashboard renders a setup prompt instead of an error state.
 */
export async function GET() {
  const token = process.env.GITHUB_TOKEN;

  const empty: GithubActivity = {
    configured: false,
    error: null,
    org: ACCOUNT,
    repos: [],
    events: [],
    commits: [],
  };

  if (!token) {
    return NextResponse.json({
      ...empty,
      error: "GITHUB_TOKEN is not set. Add it to .env.local to enable this panel.",
    });
  }

  try {
    const account = await resolveAccount(token);
    if (!account) {
      return NextResponse.json({
        ...empty,
        configured: true,
        error: `GitHub account "${ACCOUNT}" not found, or the token cannot see it.`,
      });
    }

    const reposUrl =
      account.type === "Organization"
        ? `${API}/orgs/${ACCOUNT}/repos?per_page=100&sort=pushed`
        : account.isSelf
          ? `${API}/user/repos?per_page=100&sort=pushed&affiliation=owner` // includes private
          : `${API}/users/${ACCOUNT}/repos?per_page=100&sort=pushed`;

    const eventsUrl =
      account.type === "Organization"
        ? `${API}/orgs/${ACCOUNT}/events?per_page=60`
        : `${API}/users/${ACCOUNT}/events?per_page=60`;

    const [reposRes, eventsRes] = await Promise.all([
      fetch(reposUrl, { headers: headers(token), cache: "no-store" }),
      fetch(eventsUrl, { headers: headers(token), cache: "no-store" }),
    ]);

    if (!reposRes.ok) {
      const detail = reposRes.status === 401 ? "token rejected" : `HTTP ${reposRes.status}`;
      return NextResponse.json({ ...empty, configured: true, error: `GitHub repos: ${detail}` });
    }

    const mapRepo = (r: Record<string, unknown>): GithubRepo => {
      const name = String(r.full_name ?? r.name ?? "");
      return {
        name,
        pushedAt: (r.pushed_at as string) ?? null,
        openIssues: Number(r.open_issues_count ?? 0),
        stars: Number(r.stargazers_count ?? 0),
        private: Boolean(r.private),
        url: String(r.html_url ?? `https://github.com/${name}`),
        accessible: true,
        external: name.split("/")[0]?.toLowerCase() !== ACCOUNT.toLowerCase(),
      };
    };

    const rawRepos = (await reposRes.json()) as Record<string, unknown>[];
    const repos: GithubRepo[] = rawRepos.map(mapRepo);

    // Brands can link repos that live under a CLIENT's account, not ours — those
    // never show up in the account listing above, so fetch each one directly.
    // A repo the token can't read is surfaced as inaccessible rather than dropped,
    // so a wrong slug or missing invite is visible instead of silently empty.
    let linked: string[] = [];
    try {
      const { data } = await supabaseAdmin.from("brands").select("github_repos");
      linked = Array.from(
        new Set(
          ((data ?? []) as { github_repos: string[] | null }[])
            .flatMap((b) => b.github_repos ?? [])
            .map((s) => s.trim())
            .filter((s) => s.includes("/"))
        )
      );
    } catch {
      linked = [];   // brands table not migrated yet — account repos still work
    }

    const known = new Set(repos.map((r) => r.name.toLowerCase()));
    const foreign = linked.filter((s) => !known.has(s.toLowerCase()));

    const extra = await Promise.all(
      foreign.map(async (slug): Promise<GithubRepo> => {
        const bare: GithubRepo = {
          name: slug, pushedAt: null, openIssues: 0, stars: 0, private: false,
          url: `https://github.com/${slug}`, accessible: false,
          external: slug.split("/")[0]?.toLowerCase() !== ACCOUNT.toLowerCase(),
        };
        try {
          const res = await fetch(`${API}/repos/${slug}`, { headers: headers(token), cache: "no-store" });
          if (!res.ok) return bare;
          return mapRepo((await res.json()) as Record<string, unknown>);
        } catch {
          return bare;
        }
      })
    );

    repos.push(...extra);
    repos.sort((a, b) => (a.pushedAt ?? "") < (b.pushedAt ?? "") ? 1 : -1);

    let events: GithubEvent[] = [];
    if (eventsRes.ok) {
      const rawEvents = (await eventsRes.json()) as Record<string, unknown>[];
      events = rawEvents.map((e) => {
        const d = describe(e);
        return {
          id: String(e.id ?? ""),
          type: d.type,
          repo: ((e.repo ?? {}) as { name?: string }).name ?? "",
          actor: ((e.actor ?? {}) as { login?: string }).login ?? "",
          title: d.title,
          url: d.url,
          ts: String(e.created_at ?? ""),
        };
      });
    }

    // The events feed no longer carries a `commits` array (payload is trimmed to
    // ref/head/before), so "pushed to main" is all it can tell us. Real commit
    // messages need a per-repo call — done only for the most recently pushed few.
    // Brand-linked repos come first — those are the ones a brand profile needs —
    // then the most recently pushed of everything else fills the remaining budget.
    const linkedSet = new Set(linked.map((s) => s.toLowerCase()));
    const commitTargets = [
      ...repos.filter((r) => r.accessible && linkedSet.has(r.name.toLowerCase())),
      ...repos.filter((r) => r.accessible && !linkedSet.has(r.name.toLowerCase())),
    ].slice(0, MAX_COMMIT_REPOS);

    const commitLists = await Promise.all(
      commitTargets.map(async (r): Promise<GithubCommit[]> => {
        try {
          const res = await fetch(
            `${API}/repos/${r.name}/commits?per_page=${COMMITS_PER_REPO}`,
            { headers: headers(token), cache: "no-store" }
          );
          if (!res.ok) return [];
          const raw = (await res.json()) as Record<string, unknown>[];
          return raw.map((c) => {
            const commit = (c.commit ?? {}) as {
              message?: string;
              author?: { name?: string; date?: string };
            };
            const author = (c.author ?? {}) as { login?: string };
            return {
              repo: r.name,
              sha: String(c.sha ?? "").slice(0, 7),
              message: (commit.message ?? "").split("\n")[0],
              author: author.login || commit.author?.name || "unknown",
              date: commit.author?.date ?? "",
              url: String(c.html_url ?? ""),
            };
          });
        } catch {
          return [];   // one unreachable repo must not blank the whole panel
        }
      })
    );

    const commits = commitLists
      .flat()
      .filter((c) => c.date)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return NextResponse.json({
      configured: true, error: null, org: ACCOUNT, repos, events, commits,
    } satisfies GithubActivity);
  } catch (err) {
    return NextResponse.json({
      ...empty,
      configured: true,
      error: err instanceof Error ? err.message : "GitHub request failed",
    });
  }
}
