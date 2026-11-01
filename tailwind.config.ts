/** @type {import('tailwindcss').Config} */
const neutral = {
  50: 'hsl(var(--neutral-50) / <alpha-value>)',
  100: 'hsl(var(--neutral-100) / <alpha-value>)',
  200: 'hsl(var(--neutral-200) / <alpha-value>)',
  300: 'hsl(var(--neutral-300) / <alpha-value>)',
  400: 'hsl(var(--neutral-400) / <alpha-value>)',
  500: 'hsl(var(--neutral-500) / <alpha-value>)',
  600: 'hsl(var(--neutral-600) / <alpha-value>)',
  700: 'hsl(var(--neutral-700) / <alpha-value>)',
  800: 'hsl(var(--neutral-800) / <alpha-value>)',
  900: 'hsl(var(--neutral-900) / <alpha-value>)',
  950: 'hsl(var(--neutral-950) / <alpha-value>)'
}

const accent = {
  50: 'hsl(var(--accent-50) / <alpha-value>)',
  100: 'hsl(var(--accent-100) / <alpha-value>)',
  200: 'hsl(var(--accent-200) / <alpha-value>)',
  300: 'hsl(var(--accent-300) / <alpha-value>)',
  400: 'hsl(var(--accent-400) / <alpha-value>)',
  500: 'hsl(var(--accent-500) / <alpha-value>)',
  600: 'hsl(var(--accent-600) / <alpha-value>)',
  700: 'hsl(var(--accent-700) / <alpha-value>)',
  800: 'hsl(var(--accent-800) / <alpha-value>)',
  900: 'hsl(var(--accent-900) / <alpha-value>)',
  950: 'hsl(var(--accent-950) / <alpha-value>)'
}

module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    fontSize: {
      caption: ['13px', { lineHeight: '1.5' }],
      xs: ['12px', { lineHeight: '1.5' }],
      sm: ['14px', { lineHeight: '1.5' }],
      base: ['16px', { lineHeight: '1.5' }],
      lg: ['20px', { lineHeight: '1.4' }],
      xl: ['28px', { lineHeight: '1.25' }],
      '2xl': ['36px', { lineHeight: '1.15' }]
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        slate: neutral,
        zinc: {
          700: neutral[700],
          800: neutral[800],
          950: neutral[950]
        },
        cyan: accent,
        sky: {
          50: accent[50],
          200: accent[200],
          400: accent[400]
        },
        blue: {
          500: accent[500],
          700: accent[700]
        },
        indigo: {
          300: accent[300],
          500: accent[500]
        },
        violet: {
          100: accent[100],
          300: accent[300],
          500: accent[500]
        },
        red: {
          50: 'hsl(var(--danger-50) / <alpha-value>)',
          200: 'hsl(var(--danger-200) / <alpha-value>)',
          300: 'hsl(var(--danger-300) / <alpha-value>)',
          400: 'hsl(var(--danger-400) / <alpha-value>)',
          500: 'hsl(var(--danger-500) / <alpha-value>)',
          600: 'hsl(var(--danger-600) / <alpha-value>)'
        },
        rose: {
          300: 'hsl(var(--danger-300) / <alpha-value>)',
          500: 'hsl(var(--danger-500) / <alpha-value>)'
        },
        green: {
          200: 'hsl(var(--success-200) / <alpha-value>)',
          500: 'hsl(var(--success) / <alpha-value>)'
        },
        emerald: {
          400: 'hsl(var(--success-400) / <alpha-value>)'
        },
        orange: {
          400: 'hsl(var(--warning-400) / <alpha-value>)',
          500: 'hsl(var(--warning-500) / <alpha-value>)',
          600: 'hsl(var(--warning) / <alpha-value>)'
        },
        purple: {
          600: accent[600]
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
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      textColor: {
        slate: {
          300: 'hsl(var(--text-neutral-300) / <alpha-value>)',
          400: 'hsl(var(--text-neutral-400) / <alpha-value>)',
          500: 'hsl(var(--text-neutral-500) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)']
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        14: 'var(--space-14)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
        32: 'var(--space-32)'
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-md)',
        xl: 'var(--radius-md)',
        '2xl': 'var(--radius-md)',
        '3xl': 'var(--radius-md)',
        full: 'var(--radius-full)'
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-lg)',
        '2xl': 'var(--shadow-lg)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')]
}
