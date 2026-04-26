/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // "white" is theme-aware — used for all text-white/X, bg-white/X, border-white/X
        white: 'rgb(var(--app-white) / <alpha-value>)',
        // Literal white for icons/text on colored backgrounds
        'white-fixed': '#ffffff',
        'brand-orange': '#C4956A',
        'chef-dark': '#0e0905',
        'glass-border': 'rgba(255, 255, 255, 0.55)',
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
    },
  },
  plugins: [],
}
