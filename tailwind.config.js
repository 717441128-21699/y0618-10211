/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          950: "#070a0f",
          900: "#0a0e14",
          850: "#0e131b",
          800: "#11161f",
          750: "#161b26",
          700: "#1b2230",
          600: "#262f3f",
          500: "#364253",
          400: "#4a5668",
        },
        accent: {
          cyan: "#36e2c8",
          cyanDim: "#1ea98f",
          amber: "#ffb347",
          magenta: "#ff4d8d",
          violet: "#8b7bff",
        },
        line: "#222b3a",
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(54,226,200,0.35), 0 0 18px rgba(54,226,200,0.18)",
        panel: "0 8px 30px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(54,226,200,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(54,226,200,0.05) 1px, transparent 1px)",
      },
      animation: {
        pulseLine: "pulseLine 1.6s ease-in-out infinite",
        sweep: "sweep 3s linear infinite",
      },
      keyframes: {
        pulseLine: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
