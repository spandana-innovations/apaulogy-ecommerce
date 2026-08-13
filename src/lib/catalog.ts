import catalogData from '../data/catalog.json';

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface Product {
  slug: string;
  name: string;
  subtitle?: string;
  collection?: string;
  category_slug: string;
  /** price in paise (INR * 100) */
  price: number;
  /** sale price in paise, if on offer */
  sale_price?: number | null;
  short_desc?: string;
  description?: string;
  featured?: boolean;
  /** deterministic seed for the generated watercolour placeholder */
  art_seed?: string;
  tags?: string[];
  images?: ProductImage[];
}

export interface Category {
  slug: string;
  name: string;
  parent_slug?: string;
  description?: string;
  sort_order?: number;
}

interface Catalog {
  categories: Category[];
  products: Product[];
}

const catalog = catalogData as unknown as Catalog;

export function getProducts(): Product[] {
  return catalog.products;
}

export function getPublishedProducts(): Product[] {
  return catalog.products;
}

export function getProduct(slug: string): Product | undefined {
  return catalog.products.find((p) => p.slug === slug);
}

export function getCategories(): Category[] {
  return [...catalog.categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
}

export function getCategory(slug: string): Category | undefined {
  return catalog.categories.find((c) => c.slug === slug);
}

/** Top-level categories (no parent) for nav & landing sections. */
export function getTopCategories(): Category[] {
  return getCategories().filter((c) => !c.parent_slug);
}

export function getChildCategories(parentSlug: string): Category[] {
  return getCategories().filter((c) => c.parent_slug === parentSlug);
}

/** Products in a category, including descendants of a parent category. */
export function getProductsByCategory(slug: string): Product[] {
  const childSlugs = getChildCategories(slug).map((c) => c.slug);
  const slugs = new Set([slug, ...childSlugs]);
  return catalog.products.filter((p) => slugs.has(p.category_slug));
}

export function getFeaturedProducts(limit = 6): Product[] {
  const featured = catalog.products.filter((p) => p.featured);
  return (featured.length ? featured : catalog.products).slice(0, limit);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return catalog.products
    .filter(
      (p) =>
        p.slug !== product.slug &&
        (p.collection === product.collection ||
          p.category_slug === product.category_slug),
    )
    .slice(0, limit);
}

/** Effective price (sale if present) in paise. */
export function effectivePrice(p: Product): number {
  return p.sale_price ?? p.price;
}
