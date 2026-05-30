/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50: '#e8f8f3', 100: '#c5eddf', 500: '#1D9E75', 600: '#157a5c', 700: '#0f5c45' }
      },
      fontFamily: { sans: ['Inter', 'Hind Siliguri', 'sans-serif'] },
      animation: { 'fade-in': 'fadeIn 0.3s ease', 'slide-up': 'slideUp 0.3s ease', 'pulse-soft': 'pulseSoft 2s infinite' },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } }
      }
    }
  },
  plugins: []
}
