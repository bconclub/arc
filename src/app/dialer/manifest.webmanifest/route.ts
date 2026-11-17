/**
 * Makes the dialer installable on its own ("Add to Home screen" / "Install app"
 * in Chrome on Android): its own icon on the phone, opens straight on /dialer,
 * full screen. Public like /dialer itself; holds nothing private.
 */
export function GET() {
  return Response.json(
    {
      name: "PROXe Dialer",
      short_name: "Dialer",
      description: "Call from the company number. Every call recorded.",
      id: "/dialer",
      start_url: "/dialer",
      scope: "/dialer",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0B0C0E",
      theme_color: "#0B0C0E",
      icons: [
        { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
