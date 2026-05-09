/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist 需要这个配置
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
