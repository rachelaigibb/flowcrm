import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Compose attachments and document uploads travel through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
