import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 实验性功能配置
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb', // 设置为 200MB，而不是 false
    },
  },
  // API Routes 配置
  serverExternalPackages: ['music-metadata'],
  // 静态文件配置
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-file-name, x-file-size' },
        ],
      },
    ];
  },
};

export default nextConfig;
