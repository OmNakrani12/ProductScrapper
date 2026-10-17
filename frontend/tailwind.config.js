/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Authentic Firebase Console Matte Black Charcoal Surfaces
        matte: {
          950: "#0d0e11", // Deepest background
          900: "#121316", // Main canvas (Firebase Console Dark)
          850: "#17181c", // Navbar & sub-headers
          800: "#1e1f23", // Elevated flat card surfaces
          750: "#25272e", // Hover / selected states
          700: "#2e3036", // 1px borders & dividers
          600: "#3b3e47", // Subtle borders
          500: "#5f6368", // Muted text
        },
        // Firebase / Google Cloud Blue (Authentic Console Accent)
        firebase: {
          50: "#e8f0fe",
          100: "#d2e3fc",
          200: "#aecbfa",
          300: "#8ab4f8", // Console link blue
          400: "#669df6",
          500: "#4285f4", // Google blue
          600: "#1a73e8", // Primary Firebase button blue
          700: "#1557b0", // Hover blue
          800: "#174ea6",
          900: "#0d3c61",
        },
        background: "#121316",
        surface: "#17181c",
        card: "#1e1f23",
        "card-hover": "#25272e",
        border: "#2e3036",
        accent: {
          50: "#e8f0fe",
          100: "#d2e3fc",
          500: "#4285f4",
          600: "#1a73e8",
          700: "#1557b0",
          DEFAULT: "#1a73e8",
        },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "'Inter'", "system-ui", "sans-serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
