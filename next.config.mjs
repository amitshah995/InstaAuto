/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Public creator shop: /@handle is served by app/shop/[handle]
    return [
      { source: "/@:handle", destination: "/shop/:handle" },
      { source: "/@:handle/p/:id", destination: "/shop/:handle/p/:id" },
    ]
  },
}

export default nextConfig
