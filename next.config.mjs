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
};

export default nextConfig;
