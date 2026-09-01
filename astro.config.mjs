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
      filter: (page) =>
        !page.includes('/checkout') &&
        !page.includes('/cart') &&
        !page.includes('/order-confirmed') &&
        !page.includes('/account'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        if (item.url.endsWith('.com/') || item.url.match(/\/$/) && new URL(item.url).pathname === '/') {
          item.priority = 1.0; item.changefreq = 'daily';
        }
        if (item.url.includes('/product/')) { item.priority = 0.8; item.changefreq = 'weekly'; }
        else if (item.url.includes('/category/') || item.url.includes('/store')) { item.priority = 0.9; item.changefreq = 'weekly'; }
        return item;
      },
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
