import catalogData from '../data/catalog.json';
import menuData from '../data/menu.json';

export interface ProductImage { url: string; alt?: string; }

export interface Variation {
  label: string;
  slug: string;
  price: number | null;        // paise
  sale_price: number | null;   // paise
  sku: string;
  image?: string | null;
}

export interface Product {
  slug: string;
  name: string;
  sku: string;
  type: 'simple' | 'variable';
  price: number;               // paise — min price for variable products
  price_max?: number | null;   // paise — max price for variable products
  sale_price?: number | null;  // paise
  stock_status: string;
  featured?: boolean;
  categories: string[];
  primary_category?: string | null;
  short_html?: string;
  description_html?: string;
  weight?: string;
  images: ProductImage[];
  variations: Variation[];
}

export interface Category {
  slug: string;
  name: string;
  parent_slug?: string | null;
  description?: string;
  count?: number;
  image?: string | null;
}

export interface MenuNode { label: string; href: string | null; children: MenuNode[]; }

interface Catalog { categories: Category[]; products: Product[]; }
const catalog = catalogData as unknown as Catalog;

export const menu = menuData as unknown as MenuNode[];

/* ----------------------------- Products ----------------------------- */
export function getProducts(): Product[] { return catalog.products; }
export function getPublishedProducts(): Product[] { return catalog.products; }
export function getProduct(slug: string): Product | undefined {
  return catalog.products.find((p) => p.slug === slug);
}

/* ----------------------------- Categories --------------------------- */
export function getCategories(): Category[] { return catalog.categories; }
export function getCategory(slug: string): Category | undefined {
  return catalog.categories.find((c) => c.slug === slug);
}
export function getTopCategories(): Category[] {
  return catalog.categories.filter((c) => !c.parent_slug);
}
export function getChildCategories(parentSlug: string): Category[] {
  return catalog.categories.filter((c) => c.parent_slug === parentSlug);
}
/** All descendant slugs (one or two levels) plus the slug itself. */
function categoryAndDescendants(slug: string): Set<string> {
  const out = new Set<string>([slug]);
  for (const c of getChildCategories(slug)) {
    out.add(c.slug);
    for (const g of getChildCategories(c.slug)) out.add(g.slug);
  }
  return out;
}
/** Products in a category, including any sub-categories. */
export function getProductsByCategory(slug: string): Product[] {
  const slugs = categoryAndDescendants(slug);
  return catalog.products.filter((p) => p.categories.some((c) => slugs.has(c)));
}

/* ------------------------------ Featured ---------------------------- */
const FEATURED_SLUGS = [
  'bangalore-club', 'coffee-house', 'only-place', 'victoria-hotel',
  'plaza-theatre', 'bangalore-palace', 'impees', 'chor-bazaar',
];
export function getFeaturedProducts(limit = 8): Product[] {
  const flagged = catalog.products.filter((p) => p.featured);
  if (flagged.length >= limit) return flagged.slice(0, limit);
  // Curated fallback: recognisable pieces with photography, then fill.
  const bySlug = new Map(catalog.products.map((p) => [p.slug, p]));
  const picked: Product[] = [];
  for (const s of FEATURED_SLUGS) { const p = bySlug.get(s); if (p) picked.push(p); }
  if (picked.length < limit) {
    for (const p of catalog.products) {
      if (picked.includes(p)) continue;
      if (p.images.length >= 2) picked.push(p);
      if (picked.length >= limit) break;
    }
  }
  return picked.slice(0, limit);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const cat = product.primary_category;
  return catalog.products
    .filter((p) => p.slug !== product.slug && cat && p.categories.includes(cat))
    .slice(0, limit);
}

/* ------------------------------- Pricing ---------------------------- */
/** Effective (sale-aware) starting price in paise. */
export function effectivePrice(p: Product): number {
  return p.sale_price ?? p.price;
}
export function isOnSale(p: Product): boolean {
  return p.sale_price != null && p.sale_price < p.price;
}
export function hasPriceRange(p: Product): boolean {
  return p.type === 'variable' && p.price_max != null && p.price_max > p.price;
}

/* -------------------------------- Menu ------------------------------ */
export function getMenu(): MenuNode[] { return menu; }
