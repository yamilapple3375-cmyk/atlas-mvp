import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
    // TMDB already serves fixed, pre-sized images (w92/w500) — Next's own
    // optimizer just adds a slow proxy hop and burns Vercel's image-
    // optimization quota for no benefit here.
    unoptimized: true,
  },
};

export default nextConfig;
