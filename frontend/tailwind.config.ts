import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./types.ts"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
