/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Space Grotesk', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // theme-aware white (text-white/X, bg-white/X, border-white/X)
        white: 'rgb(var(--app-white) / <alpha-value>)',
        'white-fixed': '#ffffff',

        // Brand accent — teal/blue (INVENTRA palette)
        'brand-orange': '#4f8ef7',   // kept name for backwards compat with all existing classes
        'accent':       '#4f8ef7',
        'accent-bg':    'rgba(79, 142, 247, 0.12)',

        // Legacy copper tokens (used in Login page only)
        'copper':       '#C5A059',
        'copper-soft':  '#d8b08c',

        // App surfaces (INVENTRA)
        'bg-card':      '#1e2235',
        'bg-card-2':    '#252840',
        'bg-surface':   '#0f1116',
        'bg-input':     '#13161c',
        'inv-border':   '#2d3154',

        // Semantic
        'chef-dark':    '#0b0d10',
        'glass-border': 'rgba(242, 240, 236, 0.08)',

        neutral: {
          50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4',
          300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c',
          600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917',
        },
      },
      boxShadow: {
        glass:         '0 8px 32px rgba(0,0,0,0.40)',
        'orange-glow':    '0 0 24px rgba(79, 142, 247, 0.35)',
        'orange-glow-lg': '0 0 48px rgba(79, 142, 247, 0.45)',
        'purple-glow':    '0 0 24px rgba(79, 142, 247, 0.25)',
        'card':           '0 8px 32px rgba(0,0,0,0.40)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
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
