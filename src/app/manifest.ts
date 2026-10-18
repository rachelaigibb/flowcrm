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
    background_color: "#000000",
    theme_color: "#18181B",
    icons: [
      {
        src: "/icon-192.png?v=20261018",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=20261018",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable exports add black padding to keep the mark inside Android's safe circle.
      {
        src: "/icon-maskable-192.png?v=20261018",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png?v=20261018",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
