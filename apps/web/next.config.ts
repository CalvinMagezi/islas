import type { NextConfig } from "next";
import nextPWA from "@ducanh2912/next-pwa";

const withPWA = nextPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  customWorkerSrc: "worker",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Convex's FilterApi<ApiFromModules<...>> exceeds TS instantiation depth
    // when many modules are registered. Webpack compilation is fine — only
    // the post-build type check hits TS2589.
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);
