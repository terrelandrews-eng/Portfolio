import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Calm, anti-anxiety palette — no alarming reds by default.
        base: "#faf9f6",
        ink: "#2b2b2b",
        accent: "#4b6b5a",
      },
    },
  },
  plugins: [],
};

export default config;
