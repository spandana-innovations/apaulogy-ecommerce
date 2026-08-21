// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// The public production URL. Override at build time with SITE_URL.
const SITE = process.env.SITE_URL || 'https://apaulogy.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Static-first for maximum speed & SEO. Individual routes that need the
  // edge runtime (cart, checkout, Razorpay, webhooks) opt in with
  // `export const prerender = false`.
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true }, // gives `locals.runtime.env` (D1/R2) in dev
  }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/checkout') && !page.includes('/cart'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // Allow remote images served from the R2 CDN domain.
    domains: ['cdn.apaulogy.com', 'apaulogy.com'],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
