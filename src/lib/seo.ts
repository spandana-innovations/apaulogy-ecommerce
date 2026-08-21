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
    logo: `${origin}/icon-512.png`,
    telephone: '',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '002 Edward House, 37 Pottery Road, Richards Town',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      postalCode: '560005',
      addressCountry: 'IN',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 12.9986, longitude: 77.6151 },
    email: 'info@apaulogy.com',
    priceRange: '₹₹',
    currenciesAccepted: 'INR',
    paymentAccepted: 'UPI, Credit Card, Debit Card, Net Banking, Bank Transfer',
    sameAs: [
      'https://www.instagram.com/apaulogy_gallery/',
      'https://www.facebook.com/aPaulogyGallery',
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
  const images = (p.images || []).map((im) => new URL(im.url, origin).toString());
  const validUntil = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku || p.slug,
    mpn: p.sku || p.slug,
    description: plainDesc || `${p.name} — a watercolour illustration by Paul Fernandes.`,
    image: images.length ? images : [imageUrl],
    brand: { '@type': 'Brand', name: 'Paul Fernandes' },
    category: p.primary_category || undefined,
    offers: {
      '@type': 'Offer',
      url: `${origin}/product/${p.slug}/`,
      priceCurrency: 'INR',
      price,
      priceValidUntil: validUntil,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '150', currency: 'INR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 10, unitCode: 'DAY' },
        },
      },
    },
  };
}

/** CollectionPage + ItemList for a category listing. */
export function collectionSchema(
  name: string,
  slug: string,
  products: Product[],
  site: URL | string | undefined,
) {
  const origin = site ? new URL(site).origin : 'https://apaulogy.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${name} — ${SITE_NAME}`,
    url: `${origin}/category/${slug}/`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 30).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${origin}/product/${p.slug}/`,
        name: p.name,
      })),
    },
  };
}

/** FAQPage schema from Q/A pairs. */
export function faqSchema(qas: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map((x) => ({
      '@type': 'Question',
      name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
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
