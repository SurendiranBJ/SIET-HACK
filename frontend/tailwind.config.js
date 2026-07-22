/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0F1115',
          panel: '#1A1D24',
          border: '#2E323D',
          hover: '#262A34'
        },
        primary: {
          DEFAULT: '#3B82F6',
          glow: 'rgba(59, 130, 246, 0.5)'
        },
        danger: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.5)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
