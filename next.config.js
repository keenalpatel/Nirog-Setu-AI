/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Tell webpack to ignore these optional native modules required by the 'ws' library
      config.externals.push({
        bufferutil: 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }
    return config;
  },

  /**
   * When ADK_SERVICE_URL is configured (pointing at the Cloud Run service),
   * rewrite all /api/agent-route calls to the ADK FastAPI service.
   * The Next.js app/api/* routes are kept as a local fallback for development.
   *
   * Each ADK endpoint mirrors the exact path suffix:
   *   /api/triage    → <ADK_SERVICE_URL>/triage
   *   /api/diagnose  → <ADK_SERVICE_URL>/diagnose
   *   /api/prescribe → <ADK_SERVICE_URL>/prescribe
   *   /api/asha      → <ADK_SERVICE_URL>/asha
   *   /api/refer     → <ADK_SERVICE_URL>/refer
   *   /api/emergency → <ADK_SERVICE_URL>/emergency
   *   /api/whatsapp  → <ADK_SERVICE_URL>/whatsapp
   */
  async rewrites() {
    const adkUrl = process.env.ADK_SERVICE_URL;
    if (!adkUrl) return [];          // no rewrites when running locally without ADK

    const agents = ['triage', 'diagnose', 'prescribe', 'asha', 'refer', 'emergency', 'whatsapp'];
    return agents.map((agent) => ({
      source: `/api/${agent}`,
      destination: `${adkUrl}/${agent}`,
    }));
  },
};

export default nextConfig;