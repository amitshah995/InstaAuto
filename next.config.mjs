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
      { source: "/@:handle/studio", destination: "/shop/:handle/studio" },
      { source: "/@:handle/studio/:id", destination: "/shop/:handle/studio/:id" },
      { source: "/@:handle/p/:id", destination: "/shop/:handle/studio/:id" }, // links shared before the Studio page existed
    ]
  },
}

export default nextConfig
