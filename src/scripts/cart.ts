/**
 * Client-side cart, persisted in localStorage. Zero framework, tiny footprint.
 * - `[data-add-to-cart]` buttons carry data-slug/name/price(paise)/image.
 * - Header badge `[data-cart-count]` reflects total quantity.
 * - The cart page listens for `cart:changed` to re-render.
 */

export interface CartItem {
  slug: string;
  name: string;
  price: number; // paise
  qty: number;
  image?: string;
  variant?: string;
}

const KEY = 'apaulogy_cart_v1';

function read(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent('cart:changed', { detail: items }));
  updateBadges(items);
}

function updateBadges(items: CartItem[] = read()) {
  const count = items.reduce((n, it) => n + it.qty, 0);
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
}

export const Cart = {
  all: read,
  count: () => read().reduce((n, it) => n + it.qty, 0),
  subtotal: () => read().reduce((n, it) => n + it.price * it.qty, 0),
  add(item: Omit<CartItem, 'qty'> & { qty?: number }) {
    const items = read();
    const key = item.slug + (item.variant || '');
    const found = items.find((i) => i.slug + (i.variant || '') === key);
    if (found) found.qty += item.qty ?? 1;
    else items.push({ ...item, qty: item.qty ?? 1 });
    write(items);
  },
  setQty(slug: string, variant: string | undefined, qty: number) {
    let items = read();
    const key = slug + (variant || '');
    const it = items.find((i) => i.slug + (i.variant || '') === key);
    if (it) it.qty = Math.max(0, qty);
    items = items.filter((i) => i.qty > 0);
    write(items);
  },
  remove(slug: string, variant?: string) {
    const key = slug + (variant || '');
    write(read().filter((i) => i.slug + (i.variant || '') !== key));
  },
  clear() {
    write([]);
  },
};

// Expose for inline handlers / other scripts.
(window as unknown as { Cart: typeof Cart }).Cart = Cart;
(window as unknown as { cartToast: (m: string) => void }).cartToast = toast;
document.dispatchEvent(new Event('cart:ready'));

// Global "add to cart" delegation + toast feedback.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-add-to-cart]');
  if (!btn) return;
  e.preventDefault();
  Cart.add({
    slug: btn.dataset.slug!,
    name: btn.dataset.name!,
    price: Number(btn.dataset.price),
    image: btn.dataset.image || undefined,
    variant: btn.dataset.variant || undefined,
  });
  toast(`Added “${btn.dataset.name}” to your cart`);
  document.dispatchEvent(new CustomEvent('cart:added'));
});

function toast(message: string) {
  let el = document.getElementById('cart-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cart-toast';
    el.style.cssText =
      'position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);z-index:60;' +
      'background:#000;color:#fff;padding:.75rem 1.25rem;border-radius:2px;' +
      'font-family:ui-sans-serif,system-ui,sans-serif;font-size:.85rem;letter-spacing:.02em;' +
      'box-shadow:0 10px 30px -10px rgba(0,0,0,.5);opacity:0;transition:opacity .2s,transform .2s;';
    document.body.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => {
    el!.style.opacity = '1';
    el!.style.transform = 'translateX(-50%) translateY(-4px)';
  });
  clearTimeout((el as HTMLElement & { _t?: number })._t);
  (el as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
    el!.style.opacity = '0';
    el!.style.transform = 'translateX(-50%)';
  }, 2200);
}

updateBadges();
document.addEventListener('astro:after-swap', () => updateBadges());
