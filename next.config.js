/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Suppress optional native modules warnings from ws and node-fetch
      config.externals.push({
        bufferutil: 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
        encoding: 'commonjs encoding',
      });
    }
    return config;
  },
};

export default nextConfig;