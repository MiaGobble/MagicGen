import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Custom domain (magicgen.igottic.com) serves at site root → base "/".
// For plain https://miagobble.github.io/MagicGen/ without a custom domain,
// set VITE_BASE=/MagicGen/ in the deploy workflow instead.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
});
