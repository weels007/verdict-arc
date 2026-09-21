// Build-time configuration for the browser app.
//
// The deployed network is baked in at build time from Vite env vars
// (VITE_GENLAYER_ENDPOINT / VITE_GENLAYER_CONTRACT). On Vercel these are set
// as Project Environment Variables — no localhost anywhere in production.
//
// Network and contract are fixed at deploy time. No runtime overrides.

export interface AppConfig {
  endpoint: string;
  contractAddress: string;
}

function viteEnv(key: string): string | undefined {
  // Access import.meta.env safely without pulling in vite/client types.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key];
}

/** True when the deployment has a real network baked in. */
export function isConfigured(): boolean {
  const cfg = loadConfig();
  return cfg.endpoint !== "" && cfg.contractAddress !== "";
}

export function loadConfig(): AppConfig {
  const envEndpoint = (viteEnv("VITE_GENLAYER_ENDPOINT") ?? "").trim();
  const envContract = (viteEnv("VITE_GENLAYER_CONTRACT") ?? "").trim();

  return {
    // No localhost fallback: an unconfigured build says so instead of
    // pretending there is a node on the visitor's machine.
    endpoint: envEndpoint,
    contractAddress: envContract,
  };
}

export const DEFAULTS = {
  windowStart: 1700000000,
  windowEnd: 1700004000,
  slaAmount: "1000000000000000000",
  feeAmount: "10000000000000000",
  penaltyAmount: "250000000000000000",
};
