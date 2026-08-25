import type { NextConfig } from "next";

// The Storage host is derived from the project URL so there is one place to
// change when the project moves.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/sign/**",
          },
          // supabase start serves over http on localhost.
          { protocol: "http", hostname: "127.0.0.1", pathname: "/storage/v1/object/sign/**" },
          { protocol: "http", hostname: "localhost", pathname: "/storage/v1/object/sign/**" },
        ]
      : [],
  },

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
