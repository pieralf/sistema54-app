/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5", // Esempio brand color
        secondary: "#64748B",
      },
      minHeight: {
        'touch': '44px', // Per bottoni mobile
      }
    },
  },
  plugins: [],
}