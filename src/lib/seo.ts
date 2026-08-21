import type { Product } from './catalog';
import { effectivePrice } from './catalog';

export const SITE_NAME = 'aPaulogy';
export const SITE_TAGLINE = 'Watercolours of a city that was';
export const SITE_DESCRIPTION =
  'aPaulogy is the gallery of cartoonist Paul Fernandes — signed watercolour prints of 1970s Bangalore, vintage Mumbai and Goa, and everyday merchandise carrying the same nostalgia.';

/** Absolute URL helper against the configured site. */
export function abs(path: string, site: URL | string | undefined): string {
  const base = site ? new URL(site).origin : 'https://apaulogy.com';
  return new URL(path, base).toString();
}

export interface SeoProps {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
}

/** Organization + WebSite JSON-LD for the homepage. */
export function organizationSchema(site: URL | string | undefined) {
  const origin = site ? new URL(site).origin : 'https://apaulogy.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: origin,
    image: `${origin}/og-default.png`,
    logo: `${origin}/logo.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      addressCountry: 'IN',
    },
    sameAs: [
      'https://www.instagram.com/apaulogy/',
      'https://www.facebook.com/apaulogy/',
    ],
  };
}

export function websiteSchema(site: URL | string | undefined) {
  const origin = site ? new URL(site).origin : 'https://apaulogy.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/store/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Product JSON-LD (rich results). */
export function productSchema(
  p: Product,
  site: URL | string | undefined,
  imageUrl: string,
) {
  const origin = site ? new URL(site).origin : 'https://apaulogy.com';
  const price = (effectivePrice(p) / 100).toFixed(2);
  const plainDesc = (p.short_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku || undefined,
    description: plainDesc || p.name,
    image: [imageUrl],
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: p.primary_category || undefined,
    offers: {
      '@type': 'Offer',
      url: `${origin}/product/${p.slug}/`,
      priceCurrency: 'INR',
      price,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };
}

export function breadcrumbSchema(
  crumbs: { name: string; url: string }[],
  site: URL | string | undefined,
) {
  const origin = site ? new URL(site).origin : 'https://apaulogy.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.url, origin).toString(),
    })),
  };
}
