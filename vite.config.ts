import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    watch: {
      // Ignore pipeline cache and output — contains thousands of HTML files
      // that confuse Vite's dependency scanner
      ignored: ["**/pipeline/cache/**", "**/pipeline/output/**"],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Pre-declare all heavy deps so Vite doesn't re-optimise mid-load and
  // trigger endless reloads. Also lock scanning to src/ only so the
  // pipeline/cache HTML files are never picked up.
  optimizeDeps: {
    entries: ["src/**/*.{ts,tsx}"],
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "date-fns",
      "lucide-react",
      "embla-carousel-react",
      "sonner",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-scroll-area",
    ],
  },
}));
