/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: {
        // "white" is theme-aware — used for all text-white/X, bg-white/X, border-white/X
        white: 'rgb(var(--app-white) / <alpha-value>)',
        // Literal white for icons/text on colored backgrounds
        'white-fixed': '#ffffff',
        'brand-orange': '#C4956A',
        'copper': '#C5A059',
        'copper-soft': '#d8b08c',
        'chef-dark': '#0e0905',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
        neutral: {
          50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4',
          300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c',
          600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917',
        },
      },
      boxShadow: {
        glass:         '0 2px 16px rgba(0,0,0,0.06)',
        'orange-glow':    '0 0 24px rgba(196, 149, 106, 0.35)',
        'orange-glow-lg': '0 0 48px rgba(196, 149, 106, 0.45)',
        'purple-glow':    '0 0 24px rgba(196, 149, 106, 0.35)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))',
      },
      minHeight: { 'touch-target': '44px' },
      minWidth:  { 'touch-target': '44px' },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}
