/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode surfaces — deep purple-black with character
        dark: {
          canvas: '#08000f',
          surface: '#0e001a',
          elevated: '#150025',
          card: '#1a0030',
          hover: '#220040',
          hairline: '#2d0055',
          hairlineStrong: '#3d0070',
        },
        // Light mode surfaces — clean with cool tints
        light: {
          canvas: '#f5f0ff',
          surface: '#ffffff',
          elevated: '#f0eaff',
          card: '#ffffff',
          hover: '#ebe4ff',
          hairline: '#ddd4f0',
          hairlineStrong: '#c8bde0',
        },
        // Semantic surface aliases (default = dark)
        surface: {
          0: '#08000f',
          1: '#0e001a',
          2: '#150025',
          3: '#1a0030',
          4: '#220040',
          5: '#2d0055',
        },
        // Primary accent: pastel purple
        accent: {
          DEFAULT: '#8b7dc8',
          hover: '#7a6cb8',
          muted: 'rgba(139,125,200,0.12)',
          glow: 'rgba(139,125,200,0.25)',
          light: '#e8e0ff',
        },
        // Secondary: hot magenta (PlayStation)
        hot: {
          DEFAULT: '#ff2d78',
          hover: '#e0185f',
          muted: 'rgba(255,45,120,0.12)',
          glow: 'rgba(255,45,120,0.25)',
          light: '#ffd6e8',
        },
        // Tertiary: electric yellow (Nintendo)
        zap: {
          DEFAULT: '#ffe600',
          hover: '#d4c000',
          muted: 'rgba(255,230,0,0.12)',
          glow: 'rgba(255,230,0,0.25)',
          light: '#fffccc',
        },
        // Text
        text: {
          primary: '#ede5f8',
          secondary: '#b8a8d8',
          muted: '#8a7aaa',
          disabled: '#5a4a7a',
        },
        // Danger
        danger: {
          DEFAULT: '#ff073a',
          hover: '#d4052e',
          light: 'rgba(255,7,58,0.12)',
        },
        // Warning
        warning: {
          DEFAULT: '#ffe600',
          hover: '#d4c000',
          light: 'rgba(255,230,0,0.12)',
        },
        // Success
        success: {
          DEFAULT: '#39ff14',
          hover: '#2dd40f',
          light: 'rgba(57,255,20,0.12)',
        },
        // Port colors — brighter for arcade feel
        port: {
          data: '#00bfff',
          visual: '#bf5fff',
          reference: '#00ff88',
          any: '#8888aa',
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
        glow: '0 0 20px rgba(0,255,240,0.15)',
        glowStrong: '0 0 30px rgba(0,255,240,0.3)',
        glowHot: '0 0 20px rgba(255,45,120,0.2)',
        glowZap: '0 0 20px rgba(255,230,0,0.2)',
        card: '0 2px 8px rgba(0,0,0,0.4), 0 0 1px rgba(0,255,240,0.08)',
        cardHover: '0 4px 16px rgba(0,0,0,0.5), 0 0 1px rgba(0,255,240,0.15)',
        panel: '0 8px 32px rgba(0,0,0,0.6)',
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