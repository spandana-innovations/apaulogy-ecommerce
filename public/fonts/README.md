# Fonts

## Brandy Wine (display / headings)
`Brandy Wine` is a **licensed** display face and is not redistributed here.
To activate it site-wide, drop the licensed web font files into this folder:

    public/fonts/brandywine.woff2
    public/fonts/brandywine.woff

The `@font-face` rule (see `src/styles/global.css`) and the preload in
`BaseLayout.astro` already point at these paths — the headings will switch to
Brandy Wine automatically once the files are present. No code change needed.

Until then, headings fall back to **Cormorant Garamond** (self-hosted via
`@fontsource`, bundled at build time), which keeps the vintage display feel.

## Body serif
Body copy uses **EB Garamond**, self-hosted via `@fontsource` — no third-party
requests, good for privacy and speed.
