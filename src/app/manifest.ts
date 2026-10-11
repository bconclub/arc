import type { MetadataRoute } from "next";

/**
 * Makes ARC installable on a phone ("Add to Home Screen"): opens full screen with
 * its own icon. "/" sends the owner to the dashboard and a sales login to /team.
 * Served at /manifest.webmanifest, exempt from the login gate in middleware.ts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARC",
    short_name: "ARC",
    description: "BCON's command center: GTM, outreach, studio and the sales team.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0C0E",
    theme_color: "#0B0C0E",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Leads (sales)", url: "/team/leads", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
      { name: "GTM", url: "/dashboard/gtm", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
    ],
  };
}
