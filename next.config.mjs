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
    return [{ source: "/@:handle", destination: "/shop/:handle" }]
  },
}

export default nextConfig
