import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server blocks cross-origin requests to dev-only assets by
  // default; without this, loading the page from another LAN machine's
  // browser (as opposed to curl) fails even though the server is reachable.
  allowedDevOrigins: ["192.168.1.5", "192.168.1.190"],
};

export default nextConfig;
