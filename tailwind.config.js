import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

// ── Theme-aware status palette ──────────────────────────────────────────────
// Pages were written against a dark background, so they use light shades
// (300/400) for status text. Inside the light "Bento & Lime" theme those
// shades are swapped for darker ones to keep 4.5:1 contrast on white.
const STATUS_FAMILIES = [
  'red', 'amber', 'yellow', 'orange', 'green', 'emerald', 'lime', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const LIGHT_SWAP = { 200: 800, 300: 700, 400: 700, 500: 600 }

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

const statusColors = {}
const darkStatusVars = {}
const lightStatusVars = {}
for (const family of STATUS_FAMILIES) {
  statusColors[family] = { ...colors[family] }
  for (const [shade, lightShade] of Object.entries(LIGHT_SWAP)) {
    const v = `--tw-${family}-${shade}`
    statusColors[family][shade] = `rgb(var(${v}) / <alpha-value>)`
    darkStatusVars[v] = rgb(colors[family][shade])
    lightStatusVars[v] = rgb(colors[family][lightShade])
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // "Station Board": square-ish corners everywhere. The old rounded-xl…3xl
    // classes collapse onto the same 4px so every card, input and panel
    // matches without touching each page; rounded-full stays for dots/avatars.
    borderRadius: {
      none: '0', sm: '2px', DEFAULT: '3px', md: '3px', lg: '4px',
      xl: '4px', '2xl': '4px', '3xl': '4px', full: '9999px',
    },
    extend: {
      fontFamily: {
        sans:    ['"Fira Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Fira Sans Extra Condensed"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Opacity steps the pages already use but Tailwind 3 doesn't ship.
      opacity: { 1: '0.01', 2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 8: '0.08', 12: '0.12' },
      colors: {
        ...statusColors,

        // theme-aware ink (text-white/X, bg-white/X, border-white/X follow the theme)
        white: 'rgb(var(--app-white) / <alpha-value>)',
        'white-fixed': '#ffffff',

        // Primary action colour — ink by day, white on the dark kitchen screens.
        // (name kept for backwards compat with all existing classes)
        'brand-orange': 'rgb(var(--c-accent) / <alpha-value>)',
        'accent':       'rgb(var(--c-accent) / <alpha-value>)',
        'accent-bg':    'rgb(var(--c-accent) / 0.12)',
        'on-accent':    'rgb(var(--c-on-accent) / <alpha-value>)',
        // Signal orange: "needs action". `lime` keeps its name so the existing
        // bg-lime / text-lime highlights pick up the new signal colour.
        'signal':       'rgb(var(--c-signal) / <alpha-value>)',
        'lime':         { ...colors.lime, DEFAULT: 'rgb(var(--c-signal) / <alpha-value>)' },
        'ink':          '#0A0A0A',
        'paper':        '#FAF7F0',

        // Legacy copper tokens (used in Login page only)
        'copper':       '#C5A059',
        'copper-soft':  '#d8b08c',

        // App surfaces
        'bg-card':      'rgb(var(--c-card) / <alpha-value>)',
        'bg-card-2':    'rgb(var(--c-card-2) / <alpha-value>)',
        'bg-surface':   'rgb(var(--c-surface) / <alpha-value>)',
        'bg-input':     'rgb(var(--c-input) / <alpha-value>)',
        'inv-border':   'rgb(var(--c-border) / <alpha-value>)',

        // Semantic
        'chef-dark':    'rgb(var(--c-chef-dark) / <alpha-value>)',
        'glass-border': 'var(--hairline)',

        neutral: {
          50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4',
          300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c',
          600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917',
        },
      },
      boxShadow: {
        glass:         '0 8px 32px rgba(0,0,0,0.40)',
        'orange-glow':    '0 0 24px rgb(var(--c-accent) / 0.25)',
        'orange-glow-lg': '0 0 48px rgb(var(--c-accent) / 0.30)',
        'purple-glow':    '0 0 24px rgb(var(--c-accent) / 0.20)',
        'card':           'var(--shadow-card)',
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': darkStatusVars,
        'html.theme-c': lightStatusVars,
        '.theme-dark': darkStatusVars,
      })
    }),
  ],
}
