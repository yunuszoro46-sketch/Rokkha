/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["lucide-react"],

  // The site does not use next/image. Turning the image optimiser off closes
  // the /_next/image endpoint, where Next.js 14 has known security bugs.
  images: { unoptimized: true },

  // Standard browser protections on every page: no guessing of content types,
  // the portal cannot be shown inside another site's frame (click-jacking),
  // and other sites are not told which page a visitor came from.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
