/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` and `next dev` both write to .next by default, so running a
  // build while the dev server is up corrupts the running server's chunks.
  // Builds get their own directory unless one is set explicitly.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // arc.bconclub.com/editr is the short link to the Editr dashboard; the session gate still applies.
  async redirects() {
    return [{ source: "/editr", destination: "/dashboard/editr", permanent: false }];
  },
  // arc.bconclub.com/reports/<slug> is a client market report, static files in public/reports
  // (scripts/publish-report.mjs). Public on purpose: it is sent to the business by link.
  async rewrites() {
    return [
      { source: "/reports/:slug", destination: "/reports/:slug/index.html" },
      { source: "/reports/:slug/", destination: "/reports/:slug/index.html" },
    ];
  },
};

export default nextConfig;
