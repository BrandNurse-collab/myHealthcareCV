/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Uploaded CVs are processed server-side only; no image/remote-asset config needed yet.
};

export default nextConfig;
