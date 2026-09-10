import type { NextConfig } from 'next'

const config: NextConfig = {
  // We need to export static files so Electron can handle them.
  output: 'export',
  distDir:
    process.env.NODE_ENV === 'production'
      ? // Production output goes to ../app so nextron can package it.
        '../app'
      : '.next',
  // home.html => home/index.html
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default config
