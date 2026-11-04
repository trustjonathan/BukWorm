const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true"
})

const apiMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"]

const withPWA = require("next-pwa")({
  dest: "public",
  cacheStartUrl: false,
  dynamicStartUrl: false,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline.html"
  },
  runtimeCaching: [
    ...apiMethods.map(method => ({
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && /^\/api(?:\/|$)/.test(url.pathname),
      method,
      handler: "NetworkOnly",
      options: {}
    })),
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && !/^\/api(?:\/|$)/.test(url.pathname),
      method: "GET",
      handler: "NetworkOnly",
      options: {}
    }
  ]
})

module.exports = withBundleAnalyzer(
  withPWA({
    reactStrictMode: true,
    images: {
      remotePatterns: [
        {
          protocol: "http",
          hostname: "localhost"
        },
        {
          protocol: "http",
          hostname: "127.0.0.1"
        },
        {
          protocol: "https",
          hostname: "**"
        }
      ]
    },
    experimental: {
      serverComponentsExternalPackages: ["sharp", "onnxruntime-node"]
    }
  })
)
