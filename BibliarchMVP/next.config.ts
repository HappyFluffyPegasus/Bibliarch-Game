import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const isTauriDev = !!process.env.TAURI_ENV_DEBUG;

const nextConfig: NextConfig = {
  ...(!isDev ? { output: "export" } : {}),
  images: { unoptimized: true },
  ...(isTauriDev ? { assetPrefix: "http://localhost:3000" } : {}),
};

export default nextConfig;
