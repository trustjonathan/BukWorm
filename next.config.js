const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true"
})

const apiMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
const navigationFallback = {
  handlerWillStart: () =>
    caches
      .match(new URL("/launch-shell.html", self.registration.scope).href, {
        ignoreSearch: true
      })
      .then(shell =>
        shell
          ? caches
              .open("matrix-navigations")
              .then(cache =>
                cache.put(
                  new Request(
                    new URL("/launch-shell.html", self.registration.scope).href
                  ),
                  shell.clone()
                )
              )
          : undefined
      ),
  cacheKeyWillBeUsed: async ({ mode, request }) =>
    mode === "read"
      ? new Request(new URL("/launch-shell.html", self.registration.scope).href)
      : request,
  cacheWillUpdate: async () => null,
  fetchDidSucceed: ({ response }) =>
    response.status >= 500
      ? Promise.reject(new Error(`Matrix server returned ${response.status}`))
      : response,
  handlerDidError: ({ error }) =>
    caches
      .match(
        new URL(
          error?.message?.startsWith("Matrix server returned ") ||
          self.navigator.onLine === false
            ? "/offline.html"
            : "/launch-shell.html",
          self.registration.scope
        ).href,
        { ignoreSearch: true }
      )
      .then(
        response =>
          response ||
          caches.match(new URL("/offline.html", self.registration.scope).href, {
            ignoreSearch: true
          })
      )
}

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
        url.origin === self.location.origin &&
        /^\/api(?:\/|$)/.test(url.pathname),
      method,
      handler: "NetworkOnly",
      options: {}
    })),
    ...apiMethods.map(method => ({
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:auth|login|signup|logout|setup|invite)(?:\/|$)/i.test(
          url.pathname
        ),
      method,
      handler: "NetworkOnly",
      options: {}
    })),
    ...apiMethods.map(method => ({
      urlPattern: ({ url }) =>
        url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co"),
      method,
      handler: "NetworkOnly",
      options: {}
    })),
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      method: "GET",
      handler: "NetworkFirst",
      options: {
        cacheName: "matrix-navigations",
        networkTimeoutSeconds: 3,
        plugins: [navigationFallback]
      }
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
