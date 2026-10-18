import { defineConfig } from "vite";

// GitHub Pages serves the site from /<repo>/, so CI builds with VITE_BASE=/yard/.
const base = process.env.VITE_BASE || "/";
// Absolute URL for social-card images — link-preview crawlers don't resolve
// relative ones. Falls back to a base-relative path for local builds.
const siteUrl = (process.env.VITE_SITE_URL || base).replace(/\/?$/, "/");

export default defineConfig({
  base,
  plugins: [
    {
      name: "site-url",
      transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl),
    },
  ],
  build: {
    rolldownOptions: {
      output: {
        // Vendor chunks change rarely, so returning players keep them cached
        // across game updates instead of re-downloading three.js every deploy.
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]/ },
            { name: "firebase", test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
          ],
        },
      },
    },
  },
});
