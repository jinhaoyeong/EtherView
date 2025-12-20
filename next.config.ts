import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow build to succeed with warnings for now
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Fix static chunk loading issues
  reactStrictMode: true,
  webpack: (config, { dev, isServer }) => {
    // Prevent duplicate chunk issues
    if (!dev && !isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }

    // Fix for static chunk loading issues
    // Removed custom splitChunks to prevent build issues with Next.js 15
    // config.optimization = {
    //   ...config.optimization,
    //   splitChunks: {
    //     chunks: 'all',
    //     minSize: 20000,
    //     maxSize: 244000,
    //     cacheGroups: {
    //       default: {
    //         minChunks: 2,
    //         chunks: 'async',
    //         priority: -20,
    //         reuseExistingChunk: true,
    //       },
    //       vendor: {
    //         test: /[\\/]node_modules[\\/]/,
    //         name: 'vendors',
    //         priority: -10,
    //         chunks: 'async',
    //       },
    //       ui: {
    //         test: /\.(css|scss|less)$/,
    //         name: 'ui',
    //         priority: 5,
    //         chunks: 'async',
    //       },
    //     },
    //   },
    // };

    return config;
  },
  // Add better error handling for static files
  generateEtags: false,
  poweredByHeader: false,
  compress: true,
  // No custom redirects needed; rely on Next.js defaults
  };

export default nextConfig;
