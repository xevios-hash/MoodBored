/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode surfaces (Raycast-inspired ladder)
        dark: {
          canvas: '#07080a',
          surface: '#0d0d12',
          elevated: '#12121a',
          card: '#16161f',
          hover: '#1a1a25',
          hairline: '#1f1f2e',
          hairlineStrong: '#2a2a3a',
        },
        // Light mode surfaces
        light: {
          canvas: '#f8f9fb',
          surface: '#ffffff',
          elevated: '#f4f5f7',
          card: '#ffffff',
          hover: '#f0f1f3',
          hairline: '#e2e4e8',
          hairlineStrong: '#d0d3d8',
        },
        // Semantic surface aliases (default = dark)
        surface: {
          0: '#07080a',
          1: '#0d0d12',
          2: '#12121a',
          3: '#16161f',
          4: '#1a1a25',
          5: '#1f1f2e',
        },
        // Accent: blue-green glass teal
        accent: {
          DEFAULT: '#2dd4bf',
          hover: '#14b8a6',
          muted: 'rgba(45,212,191,0.15)',
          glow: 'rgba(45,212,191,0.25)',
          light: '#ccfbf1',
        },
        // Text
        text: {
          primary: '#e8e8ec',
          secondary: '#a1a1b5',
          muted: '#6b6b80',
          disabled: '#45455a',
        },
        // Danger
        danger: {
          DEFAULT: '#f43f5e',
          hover: '#e11d48',
          light: 'rgba(244,63,94,0.1)',
        },
        // Warning
        warning: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: 'rgba(245,158,11,0.1)',
        },
        // Success
        success: {
          DEFAULT: '#10b981',
          hover: '#059669',
          light: 'rgba(16,185,129,0.1)',
        },
        // Port colors
        port: {
          data: '#60a5fa',
          visual: '#a78bfa',
          reference: '#34d399',
          any: '#6b7280',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
      },
      boxShadow: {
        glow: '0 0 20px rgba(45,212,191,0.15)',
        glowStrong: '0 0 30px rgba(45,212,191,0.25)',
        card: '0 2px 8px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.05)',
        cardHover: '0 4px 16px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.08)',
        panel: '0 8px 32px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        glass: '20px',
      },
      transitionDuration: {
        fast: '100ms',
        normal: '150ms',
        slow: '250ms',
      },
    },
  },
  plugins: [],
}
