import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "31231990e93e3d1c7fb66f6eeb18cdbc",
  worker: defineWorker({
    name: "etherview",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-09",
    compatibilityFlags: ["nodejs_compat"],
    observability: {
      enabled: true,
      redactQueryString: true,
      traces: { enabled: true },
    },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
