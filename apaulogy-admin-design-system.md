# aPaulogy Admin — Design System Reference

A complete style guide for the aPaulogy admin panel (`/apaulogy-admin`). Hand this
to another conversation or developer to build new admin screens that match the
existing look and feel exactly.

**Aesthetic in one line:** a sleek, dark, modern SaaS dashboard inspired by
quantump2x.com — deep navy canvas, warm gold accents, Inter typography, soft
rounded cards. A light theme is available via toggle.

---

## 1. Foundations

### 1.1 Themes
The admin ships with **two themes**. Dark is the default. The theme is set by a
`data-theme` attribute on `<html>` (`data-theme="dark"` or `data-theme="light"`)
and persisted to `localStorage` under `apg_admin_theme`. All colors are CSS
custom properties so components never hardcode a color — they reference tokens,
and the theme just swaps the token values.

**Rule:** never use a raw hex value in a component. Always use a `var(--token)`.
This is what lets both themes work and is the #1 thing to preserve.

### 1.2 Color tokens

**Dark theme (default) — `:root`:**
```css
--bg:        #060f1a;   /* page background (deep navy) */
--panel:     #0e1b2b;   /* card / panel surface */
--panel-2:   #0a1523;   /* subtle surface: table headers, inputs, code */
--raise:     #122238;   /* raised elements: buttons, hovered rows */

--ink:       #e9eef4;   /* primary text */
--ink-soft:  #b7c3d1;   /* secondary text */
--muted:     #7b8a9c;   /* tertiary / labels / captions */
--line:      rgba(255,255,255,.08);  /* hairline borders */
--line-strong: rgba(255,255,255,.16);/* stronger borders (inputs, buttons) */

--gold:      #c9a24a;   /* primary accent (active nav, key CTAs, highlights) */
--gold-soft: rgba(201,162,74,.16);   /* accent tint (backgrounds, focus ring) */
--blue:      #3ea6ff;   /* secondary accent */

--ok:   #39d98a;  --ok-bg:   rgba(57,217,138,.14);  /* success / paid / operational */
--warn: #ffcf5c;  --warn-bg: rgba(255,207,92,.14);  /* warning / pending / on-hold */
--info: #6cb6ff;  --info-bg: rgba(108,182,255,.14); /* info / shipped / processing */
--bad:  #ff7a7a;  --bad-bg:  rgba(255,122,122,.14); /* error / cancelled / failed */
```

**Light theme — `html[data-theme="light"]`:**
```css
--bg:        #f5f6f8;
--panel:     #ffffff;
--panel-2:   #f7f8fa;
--raise:     #eef1f4;

--ink:       #141a22;
--ink-soft:  #3d4653;
--muted:     #7a8494;
--line:      #e6e9ee;
--line-strong: #d3d8e0;

--gold:      #a9842f;  --gold-soft: rgba(169,132,47,.14);
--blue:      #2b7fff;

--ok:   #178a52; --ok-bg:   #e3f6ec;
--warn: #9a6a00; --warn-bg: #fbf1d6;
--info: #1f6fd0; --info-bg: #e5effb;
--bad:  #c23b3b; --bad-bg:  #fbe6e6;

--shadow: 0 1px 2px rgba(20,26,34,.05), 0 8px 26px rgba(20,26,34,.06);
```

Note: the **sidebar stays dark in both themes** (`#04090f` dark / `#0e1620`
light) for contrast and brand consistency.

### 1.3 Shape & elevation tokens
```css
--r:      12px;   /* card / panel / modal radius */
--r-sm:   8px;    /* buttons, inputs, nav items, pills-ish controls */
--shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35);  /* dark */
```
Pills use a fully rounded `border-radius: 20px`.

### 1.4 Typography
The admin uses **Inter** exclusively (a deliberate departure from the storefront's
Brandy Wine / EB Garamond serifs — the admin is a tool, not the gallery).

```css
--font-display: "Inter Variable","Inter",-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
--font-serif:   "Inter Variable","Inter",-apple-system,sans-serif;  /* alias, also Inter */
--font-sans:    "Inter Variable","Inter",-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
```
Imported via `@fontsource-variable/inter`.

**Type scale & usage:**
| Role | Size | Weight | Tracking | Token |
|---|---|---|---|---|
| Page title (`.top h1`) | 1.9rem | 700 | −0.02em | `--font-display` |
| Section heading (`h2`) | ~1.1–1.4rem | 700 | normal | `--font-display` |
| Stat value (`.stat .v`) | 1.9rem | 700 | −0.02em | `--font-display` |
| Body / table cells | 0.85rem | 400–500 | normal | `--font-sans` |
| Labels / captions | 0.68–0.72rem | 600 | +0.06–0.12em, UPPERCASE | `--font-sans` |
| Nav items | 0.82rem | 500 | normal (sentence case) | `--font-sans` |

Uppercase micro-labels (0.62–0.72rem, letter-spacing 0.06–0.12em, `--muted`,
weight 600) are a signature pattern — used for stat labels, table headers, and
nav section headings.

---

## 2. Layout

### 2.1 App shell
```
.app  → CSS grid, grid-template-columns: 250px 1fr  (sidebar | main)
```
- **Sidebar** (`.app > aside`): fixed 250px, `position:sticky; top:0; height:100vh`,
  dark background, `border-right: 1px solid var(--line)`, flex column.
- **Main** (`main`): `padding: 1.9rem 2.6rem`, `max-width: 1360px`, flex column
  with `min-height:100vh` so the footer sticks to the bottom.
- **Responsive:** below 860px the grid collapses to one column and the sidebar
  becomes a horizontal wrapping bar.
- **Mobile:** the admin is **desktop-only** — mobile user-agents are blocked at
  the middleware with a "desktop only" notice (do not design mobile admin layouts).

### 2.2 Sidebar structure (top → bottom)
1. **Brand** — square white-rounded logo tile (34px) + wordmark "aPaulogy" in
   Inter 700, 1.15rem.
2. **Nav** — grouped into labelled **sections**. Section heading style:
   ```css
   .nav-section { font-size:.62rem; text-transform:uppercase; letter-spacing:.12em;
                  color:var(--muted); padding:.9rem .8rem .35rem; font-weight:600; }
   ```
   Current sections: **Store** (Dashboard, Orders, Products, Categories, Discounts,
   Shipping, Customers) · **Insights** (Sales Stats, Site analytics) · **System**
   (Data requests, Messages, Status, Settings).
3. **Utility footer** (`.side-util`, pinned to bottom via `margin-top:auto`) —
   "Go to website" (opens new tab), theme toggle (Dark/Light with sun/moon icon),
   and Sign out. These use `.side-btn` (borderless, same padding/typography as nav).

**Nav item styles:**
```css
nav a { display:flex; align-items:center; gap:.75rem; padding:.62rem .8rem;
        border-radius:var(--r-sm); font-size:.82rem; font-weight:500;
        color:var(--ink-soft); transition:all .13s; }
nav a:hover { background:rgba(255,255,255,.06); color:#fff; }
nav a.on {  /* active */
  background:linear-gradient(90deg,var(--gold-soft),transparent);
  color:#fff; box-shadow:inset 2px 0 0 var(--gold); }
nav a.on svg { color:var(--gold); }        /* active icon turns gold */
nav svg { width:18px; height:18px; opacity:.7; }
```
Active state = gold left-edge bar + gold-tinted gradient + gold icon. This is the
core "you are here" signal — reuse it for any new nav item.

### 2.3 Top bar
```css
.top    { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.8rem; }
.top h1 { font-family:var(--font-display); font-weight:700; font-size:1.9rem; letter-spacing:-.02em; }
```
The page title lives here. (Theme toggle & logout moved to the sidebar, so the
top bar is title-only unless a page adds page-level actions on the right.)

### 2.4 Footer
Sticky to the bottom of `main`. Left: `© {year} aPaulogy Gallery | All artwork ©
Paul Fernandes` in `--muted`. Right: the square Quantum P2X logo only (26px,
links to quantump2x.com, no text).

---

## 3. Core components

### 3.1 Card / panel
The primary content container. Everything sits in cards.
```css
.card { background:var(--panel); border:1px solid var(--line);
        border-radius:var(--r); box-shadow:var(--shadow); overflow:hidden; }
```
Typical inner padding: `1.3rem–1.4rem`. Card headings are Inter 700, ~1.1rem.

### 3.2 Stat card
For KPI numbers (dashboard, stats, analytics).
```css
.grid-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:1.1rem; }
.stat  { background:linear-gradient(180deg,var(--panel),var(--panel-2));
         border:1px solid var(--line); border-radius:var(--r); padding:1.3rem 1.35rem;
         box-shadow:var(--shadow); transition:transform .13s, border-color .13s; }
.stat:hover { transform:translateY(-2px); border-color:var(--gold); }
.stat .k { font-size:.7rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); font-weight:600; }
.stat .v { font-family:var(--font-display); font-weight:700; font-size:1.9rem;
           letter-spacing:-.02em; line-height:1; color:var(--ink); margin-top:.35rem; }
```
Pattern: small uppercase label (`.k`) above a large display number (`.v`).
Hover lifts the card and turns the border gold.

### 3.3 Buttons
```css
.btn { display:inline-flex; align-items:center; gap:.45rem; padding:.55rem .95rem;
       border:1px solid var(--line-strong); background:var(--raise); color:var(--ink);
       font-size:.82rem; font-weight:500; border-radius:var(--r-sm); transition:all .13s; }
.btn:hover  { border-color:var(--gold); color:#fff; }
.btn:active { transform:translateY(1px); }
```
- **Default button:** the above (subtle, raised surface, gold border on hover).
- **Primary / CTA:** gold fill — `background:var(--gold); color:#0a0f16; font-weight:600;`
  Use for the single most important action on a screen (Save, Apply).
- Icon-only buttons: 30px square, `border:1px solid var(--line)`, `border-radius:7px`,
  gold on hover — used for row actions (edit/view) in tables.

### 3.4 Tables
The workhorse for lists (orders, customers, products, etc.).
```css
table   { width:100%; border-collapse:collapse; font-size:.85rem; }
th, td  { text-align:left; padding:.9rem 1.1rem; border-bottom:1px solid var(--line); }
th      { font-size:.68rem; text-transform:uppercase; letter-spacing:.06em;
          color:var(--muted); background:var(--panel-2); font-weight:600; }
tbody tr:hover { background:var(--raise); }
tr:last-child td { border-bottom:0; }
.u      { color:var(--ink); }        /* table links */
.u:hover{ color:var(--gold); }
strong  { color:#fff; }              /* emphasised cell text (names, IDs) */
```
Tables live inside a `.card` (which clips the corners). Right-align numeric
columns. Put the primary identifier (order #, name) in `<strong>`.

### 3.5 Status pills
For any enum state (order status, service status, badges).
```css
.pill { display:inline-flex; align-items:center; gap:.35rem; padding:.22rem .6rem;
        border-radius:20px; font-size:.7rem; font-weight:600; text-transform:capitalize; }
.pill::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; }
```
Colour classes (background = tint, text = solid):
| Class | Meaning | Colors |
|---|---|---|
| `.s-pending`, `.s-on-hold` | needs attention | `--warn-bg` / `--warn` |
| `.s-paid`, `.s-completed` | success | `--ok-bg` / `--ok` |
| `.s-shipped`, `.s-processing` | in progress | `--info-bg` / `--info` |
| `.s-fulfilled`, `.s-refunded` | neutral/done | `rgba(255,255,255,.08)` / `--ink-soft` |
| `.s-cancelled`, `.s-failed` | error | `--bad-bg` / `--bad` |

Each pill has a small leading dot in the current text color. Reuse these exact
class names so statuses are consistent across screens.

### 3.6 Forms & inputs
```css
input, select, textarea {
  font-size:.88rem; padding:.6rem .75rem;
  border:1px solid var(--line-strong); border-radius:var(--r-sm);
  background:var(--panel-2); color:var(--ink);
  transition:border-color .13s, box-shadow .13s; }
input:focus { outline:none; border-color:var(--gold); box-shadow:0 0 0 3px var(--gold-soft); }
```
Focus ring = gold border + soft gold glow. **Never** give an input a hardcoded
white background — it must use `--panel-2` so it works in dark mode. Field labels
use the uppercase micro-label style.

### 3.7 Banners / alerts
```css
.banner { padding:.9rem 1.15rem; border-radius:var(--r); font-size:.84rem; line-height:1.55;
          margin-bottom:1.6rem; box-shadow:var(--shadow); }
```
- **Info / warning (default):** gold — `background:var(--gold-soft); border:1px solid rgba(201,162,74,.35); color:#e7cf95;`
- **Error / lockout:** red — `background:var(--bad-bg); border-color:var(--bad); color:var(--bad);`
Used for the "database not connected", "read limit reached", and missing-table
messages. Keep them concise and action-oriented (tell the admin what to do).

### 3.8 Modals
Two patterns in use; both must respect `[hidden]`.
```css
.pm-root { position:fixed; inset:0; z-index:80; display:grid; place-items:center; padding:1.2rem; }
.pm-root[hidden] { display:none !important; }   /* REQUIRED — class display overrides [hidden] otherwise */
.pm-back { position:absolute; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(3px); }
.pm-card { position:relative; width:460px; max-width:100%; background:var(--panel);
           border:1px solid var(--line-strong); border-radius:12px; padding:1.6rem;
           box-shadow:0 24px 70px rgba(0,0,0,.5); color:var(--ink); }
```
**Critical gotcha:** if a modal root has `display:grid` (or any class-level
display), the HTML `[hidden]` attribute will NOT hide it (class beats the UA
`[hidden]` rule). Always add `.<root>[hidden]{ display:none !important; }`.
Close on: backdrop click, ✕ button, and Escape. On open, set
`document.body.style.overflow='hidden'`; clear it on close.

### 3.9 Sub-tabs (in-page tabs)
Used inside Settings and the Orders list (Live/Archived).
```css
.tab      { padding:.6rem 1rem; background:none; border:0; border-bottom:2px solid transparent;
            margin-bottom:-1px; font-size:.86rem; font-weight:500; color:var(--muted); cursor:pointer; }
.tab.on   { color:var(--ink); border-bottom-color:var(--gold); }
.tab:hover{ color:var(--ink); }
/* container gets a bottom hairline: border-bottom:1px solid var(--line) */
```
Underline-style tabs with a gold active underline. Panels toggle via a
class on the container (`.show-<tabname>`) or JS `hidden` toggling.

---

## 4. Patterns & conventions

- **Gold is the only accent.** Use `--gold` sparingly for: active nav, primary
  CTAs, focus rings, hover borders, and the odd highlight (e.g. revenue figure).
  Everything else is the neutral navy/ink scale. Don't introduce new accent hues.
- **Semantic colors are for state only** — `--ok/--warn/--info/--bad` appear in
  pills, gauges, and alerts, never as decoration.
- **Uppercase micro-labels** (0.62–0.72rem, +tracking, `--muted`, 600) label
  everything small: stat keys, table headers, form fields, nav sections.
- **Display font for numbers & headings, sans for everything else** (both are
  Inter, but headings/stat values go weight 700 with tight −0.02em tracking).
- **Cards clip content; lists live in cards.** Give every table/list a `.card`
  wrapper so corners and borders read cleanly.
- **Micro-interactions:** 0.13s transitions; hover lifts stat cards `-2px` and
  turns borders gold; buttons nudge down 1px on `:active`.
- **Empty states** are centered, muted, and gently worded (e.g. "Nothing waiting
  — you're all caught up. ✦"): `text-align:center; color:var(--muted); padding:3.5rem 1rem;`
- **Accessibility:** maintain the ink-on-panel contrast; the gold focus ring must
  stay on interactive elements; icon-only buttons need `aria-label` + `title`.

---

## 5. Iconography
Inline SVG, 24×24 viewBox, `fill:none; stroke:currentColor; stroke-width:1.6–1.7;
stroke-linecap:round; stroke-linejoin:round`. Nav icons render at 17–18px and
inherit color (gold when active). Keep icons line-style and monochrome — no
filled or multicolor icons.

---

## 6. Quick-start checklist for a new admin screen
1. Wrap the page in `AdminLayout` with a `title` and the matching `active` nav key.
2. Put content in `.card`s; use `.grid-stats` + `.stat` for KPIs.
3. Use `<table>` inside a `.card` for lists; `<strong>` the identifier column;
   right-align numbers; use `.pill .s-*` for statuses.
4. All colors via `var(--token)` — never hardcode hex (keeps dark/light working).
5. Buttons: `.btn` default, gold-fill for the primary action.
6. Inputs use `--panel-2` bg and the gold focus ring; labels in uppercase micro-style.
7. Any modal root needs `[hidden]{display:none!important}` + backdrop/✕/Esc close.
8. Add page-level tabs with the underline `.tab/.tab.on` pattern if needed.
9. Keep it desktop-first (admin is blocked on mobile).
10. Test in **both** dark and light themes before shipping.

---

*Source of truth: `src/layouts/AdminLayout.astro` (tokens + global component
styles) and the individual `src/pages/apaulogy-admin/*.astro` pages. If a value
here ever disagrees with that file, the file wins — regenerate this doc from it.*
