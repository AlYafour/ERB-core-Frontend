import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: 'ERB — Enterprise Resource Base',
    short_name: 'ERB',
    description: 'Enterprise Resource Base — Procurement, Operations & HR Management',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAFA',
    theme_color: '#c0392b',
    orientation: 'portrait-primary',
    icons: [
      { src: '/xerb-logo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
