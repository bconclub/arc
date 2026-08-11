/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` and `next dev` both write to .next by default, so running a
  // build while the dev server is up corrupts the running server's chunks.
  // Builds get their own directory unless one is set explicitly.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
