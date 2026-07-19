/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'three/examples/jsm/loaders/GLTFLoader.js': 'three/examples/jsm/loaders/GLTFLoader.js'
    };
    return config;
  }
};

export default nextConfig;
