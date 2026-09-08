import type { MetadataRoute } from "next"

// Web app manifest — lets Android/Chrome install FlowCRM to the home screen
// with the right name and icon. iOS uses apple-icon.png instead.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlowCRM",
    short_name: "FlowCRM",
    description: "AI-first CRM and business operating system",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F2D",
    theme_color: "#4F46E5",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable copies are full-bleed (the tile scaled up and centre-cropped) so
      // Android's circle/squircle mask never shows transparent corners.
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
