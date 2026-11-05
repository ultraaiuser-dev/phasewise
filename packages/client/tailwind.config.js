/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        felt: {
          50: '#f0fdf4',
          100: '#dcfce7',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        },
        card: {
          red: '#ef4444',
          blue: '#3b82f6',
          green: '#10b981',
          yellow: '#f59e0b',
          wild: '#8b5cf6',
          skip: '#64748b'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
