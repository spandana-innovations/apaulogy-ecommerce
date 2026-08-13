# Fonts

## BrandyWine (required for titles)

The site's display titles use a font called **BrandyWine**. Drop the licensed
font files here so the titles render in it:

```
public/fonts/brandywine.woff2   <-- primary (best compression)
public/fonts/brandywine.woff    <-- fallback
```

The `@font-face` is already wired in `src/styles/global.css` and the file is
preloaded in `src/layouts/BaseLayout.astro`, so nothing else needs changing —
just add the files and redeploy.

> Until the files are added, titles fall back gracefully to Cormorant Garamond /
> Georgia (a refined serif), so the site never shows invisible or broken text.

### Converting to woff2

If you have a `.ttf` / `.otf`:

```bash
# with fonttools installed (pip install fonttools brotli)
fonttools ttLib.woff2 compress BrandyWine.otf   # -> BrandyWine.woff2
```

or use https://transfonter.org (upload, tick woff2 + woff, download).

## EB Garamond (optional body font)

`brandywine.woff2` aside, the body uses EB Garamond if
`public/fonts/ebgaramond.woff2` is present, otherwise a system serif. Adding it
is optional and improves visual consistency.
