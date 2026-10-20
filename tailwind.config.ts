import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /**
         * PROVISIONAL: approximated from the Catapult product mockup shared in
         * chat (dark sidebar + orange-red accent), not from the official brand
         * site -- network access to catapultready.com/blairandco.ca was blocked
         * by this environment's egress policy. Replace with verified hex values
         * once the real brand assets are available.
         */
        brand: {
          50: "#fef2f0",
          100: "#fde3de",
          200: "#fbccc2",
          300: "#f7a896",
          400: "#f17b5f",
          500: "#e8502e",
          600: "#d33f1f",
          700: "#b03119",
          800: "#8f2a19",
          900: "#77271a",
        },
        ink: {
          50: "#f5f6f7",
          100: "#e8eaec",
          200: "#c7cbd1",
          300: "#9aa0a9",
          400: "#6b7280",
          500: "#4a5160",
          600: "#363c48",
          700: "#272b34",
          800: "#1b1e24",
          900: "#121419",
          950: "#0b0c0f",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        popover: "0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
