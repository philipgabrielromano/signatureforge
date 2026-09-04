/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "sharp"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
      {
        protocol: "https",
        hostname: "*.azureedge.net",
      },
      {
        protocol: "https",
        hostname: "*.azurefd.net",
      },
    ],
  },
};

export default nextConfig;
