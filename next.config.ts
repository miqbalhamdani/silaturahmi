import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nothing uses next/image: photos are signed Storage URLs in plain <img>.
  // Unoptimized turns /_next/image into a 404 instead of a live optimizer.
  images: { unoptimized: true },
  poweredByHeader: false,

  async headers() {
    return [
      {
        // A family slug is a secret capability. Without no-referrer, any
        // outbound link a visitor clicks hands the URL to a third party in the
        // Referer header; without noindex, one accidental public link puts the
        // family into a search engine.
        source: "/f/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
