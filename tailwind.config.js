/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
            // Placeholder for custom geometry game colors
            'geo-dark': '#0f0f13',
            'geo-accent': '#a855f7', // Purple
        }
      },
    },
    plugins: [],
  }
