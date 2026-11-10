import type { NextConfig } from "next";
import { normaliseSupabaseUrl } from "./src/lib/supabase/env";

const supabaseUrl = normaliseSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // The previous caching model (ISR + route segment config) is used deliberately:
  // public pages are statically generated and revalidated, account areas are dynamic.
  cacheComponents: false,
  poweredByHeader: false,
  // Import only the parts of these libraries each page uses.
  experimental: { optimizePackageImports: ["motion", "motion/react", "lucide-react"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // 90 keeps the homepage cathedral photo crisp; 75 is the default for everything else.
    qualities: [75, 90],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  // Pages folded into the simpler site keep working for anyone with an old link.
  async redirects() {
    return [
      { source: "/research/:path*", destination: "/programme", permanent: false },
      { source: "/research", destination: "/programme", permanent: false },
      { source: "/opportunities/:path*", destination: "/about", permanent: false },
      { source: "/opportunities", destination: "/about", permanent: false },
      { source: "/gallery", destination: "/about", permanent: false },
      { source: "/archive/:path*", destination: "/about", permanent: false },
      { source: "/committee", destination: "/admin", permanent: false },
      { source: "/register", destination: "/signup", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
