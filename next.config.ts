import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone is needed for recording; camera/geolocation are not.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const isProd = process.env.NODE_ENV === "production";

// HSTS is static; the Content-Security-Policy is set at runtime in src/middleware.ts
// because it depends on the deployed S3_ENDPOINT.
if (isProd) securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
