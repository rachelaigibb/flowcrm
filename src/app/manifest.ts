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
    background_color: "#18181B",
    theme_color: "#18181B",
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
      // Maskable copies: Android crops icons to its own shape, and the "F"
      // sits well inside the safe zone so it survives the crop.
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
