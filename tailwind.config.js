/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
        'tv-sans': 'var(--font-body)',
        'tv-mono': 'var(--font-mono)'
      },
      colors: {
        /* ThreatVector tokens (design.md). */
        tv: {
          red: { DEFAULT: '#ff0000', hover: '#dc0000', active: '#c70000', soft: '#fff1f1' },
          ink: { DEFAULT: '#212529', strong: '#15171a', muted: '#495057', subtle: '#6c757d' },
          muted: '#6c757d',
          surface: { DEFAULT: '#ffffff', subtle: '#f8f9fa', muted: '#f0f1f3', strong: '#e9ecef' },
          border: { DEFAULT: '#dee2e6', strong: '#adb5bd' },
          success: { DEFAULT: '#198754', soft: '#d1e7dd' },
          warning: { DEFAULT: '#b76e00', soft: '#fff3cd' },
          error: { DEFAULT: '#dc3545', soft: '#f8d7da' },
          info: { DEFAULT: '#0d6efd', soft: '#cfe2ff' }
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        success: 'hsl(var(--success))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'tv-none': '0',
        'tv-control': '0.25rem',
        'tv-panel': '0.5rem',
        'tv-pill': '9999px'
      },
      transitionDuration: {
        tv: '120ms'
      },
      transitionTimingFunction: {
        tv: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
