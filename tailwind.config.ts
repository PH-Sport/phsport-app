import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Las pilas completas (con sus fallbacks) viven en globals.css: --font-sans
      // y --font-mono son la única fuente de verdad. Aquí solo se referencian.
      fontFamily: {
        sans: ['var(--font-sans)'],
        heading: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      // Escala de espaciado semántica (4pt) — p-md, gap-lg, space-y-sm…
      // Regla: cards default=lg(24), cards compact=md(16). Fin del p-4/5/6 ad-hoc.
      spacing: {
        '2xs': '0.25rem', //  4px
        xs: '0.5rem',     //  8px
        sm: '0.75rem',    // 12px
        md: '1rem',       // 16px
        lg: '1.5rem',     // 24px
        xl: '2rem',       // 32px
        '2xl': '3rem',    // 48px
        '3xl': '4rem',    // 64px
      },
      // Escala tipográfica fija (app UI, no fluida) — un solo peso de heading (600)
      fontSize: {
        'page-title': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        section: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        'card-title': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        caption: ['0.75rem', { lineHeight: '1rem' }],
        // Rótulo de sección — footnote de iOS (13pt), caja de frase, sin tracking.
        // La versión anterior (mono 11px + 0.18em + uppercase) era voz de dashboard,
        // no de app nativa: SF Pro no espacia mayúsculas. Único token de la fase 1.5
        // que afecta también a escritorio: un token tipográfico no se bifurca por
        // viewport sin duplicarlo, y duplicarlo sería peor.
        eyebrow: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0', fontWeight: '600' }],
      },
      // Elevación — modelo mate border-led: flat (sin sombra) / raised / overlay
      boxShadow: {
        raised: '0 1px 2px -1px rgb(0 0 0 / 0.08), 0 2px 8px -4px rgb(0 0 0 / 0.12)',
        overlay: '0 2px 24px -12px rgb(0 0 0 / 0.22)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        panel: {
          DEFAULT: 'hsl(var(--panel))',
          foreground: 'hsl(var(--panel-foreground))',
          active: {
            DEFAULT: 'hsl(var(--panel-active))',
            foreground: 'hsl(var(--panel-active-foreground))',
          },
          hover: 'hsl(var(--panel-hover))',
          border: 'hsl(var(--panel-border))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          hover: 'hsl(var(--sidebar-hover))',
          border: 'hsl(var(--sidebar-border))',
        },
        status: {
          success: 'hsl(var(--status-success))',
          warning: 'hsl(var(--status-warning))',
          error: 'hsl(var(--status-error))',
          info: 'hsl(var(--status-info))',
        },
        'role-designer': 'hsl(var(--role-designer))',
        pitch: {
          a: 'hsl(var(--pitch-a))',
          b: 'hsl(var(--pitch-b))',
        },
        position: {
          por: 'hsl(var(--position-por))',
          def: 'hsl(var(--position-def))',
          med: 'hsl(var(--position-med))',
          ata: 'hsl(var(--position-ata))',
        },
        situation: {
          loaned: 'hsl(var(--situation-loaned))',
          pending: 'hsl(var(--situation-pending))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Superficie agrupada iOS — exterior del modelo concentrico (22px).
        // El interior se deriva restando el padding: ver concentricRadius().
        surface: '22px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'blink': {
          '0%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(0.1)' },
          '100%': { transform: 'scaleY(1)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'page-enter': 'page-enter 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.2s ease-out forwards',
        'slide-up': 'slide-up 0.4s ease-out',
        'blink': 'blink 0.3s ease-in-out',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;