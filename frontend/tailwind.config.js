// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms'
import lineClamp from '@tailwindcss/line-clamp'

export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          500: "#2563eb",
          600: "#1d4ed8",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [forms, lineClamp],
}
