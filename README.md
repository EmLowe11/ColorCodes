# ColorCodes

A simple, glassmorphic color pairing tool. Enter a color (hex, name, or `rgb()`), and ColorCodes suggests complementary, analogous, triadic, split-complementary, and monochrome matches. Pick a **second main color** and up to four **accents** — the animated background blends your palette as you go. Click any palette chip to copy its hex, or copy the whole palette as CSS variables.

- Plain HTML/CSS/JS — no build step
- Uses the free [The Color API](https://www.thecolorapi.com) (no key), with an offline fallback

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to Netlify

Drag the folder into Netlify, or connect the repo — `netlify.toml` publishes the root directory with no build command.
