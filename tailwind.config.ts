import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /**
         * Orange from catapultready.com (500). The site's exact orange only reaches 2.9:1
         * with white text, so 600 is deepened to pass 4.5:1 for buttons and selected items.
         */
        brand: {
          50: "#fff3ed",
          100: "#ffe4d6",
          200: "#ffc7ac",
          300: "#ffa178",
          400: "#ff8350",
          500: "#ff6729",
          600: "#d2460f",
          700: "#ad390c",
          800: "#8a2e0d",
          900: "#70280f",
        },
        /** Navy for the sidebar and dark surfaces, matching the Operations design comp. */
        ink: {
          50: "#f4f6f9",
          100: "#e6eaf0",
          200: "#c7cfda",
          300: "#94a3b8",
          400: "#64748b",
          500: "#475569",
          600: "#334155",
          700: "#24344b",
          800: "#1a2a41",
          900: "#14243a",
          950: "#0f1f35",
        },
        /** Teal from catapultready.com, for secondary accents and charts. */
        accent: {
          50: "#ecfaf7",
          500: "#4cc3ac",
          700: "#1f8571",
        },
        canvas: "#f6f7f9",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
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
