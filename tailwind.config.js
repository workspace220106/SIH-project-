/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#08090A',
        surface: '#0D0F11',
        raised: '#131619',
        elevated: '#181C20',
        line: '#1E2226',
        'line-strong': '#2B3238',
        ink: '#E8EBEE',
        muted: '#8B9299',
        faint: '#5A6169',
        ghost: '#3A4046',
        accent: {
          DEFAULT: '#E3BE5C',
          dim: '#9A8038',
          deep: '#5C4C21',
        },
        risk: {
          low: '#52636F',
          mod: '#B3873F',
          high: '#C85A32',
          crit: '#D8402A',
        },
      },
      fontFamily: {
        display: ['Archivo', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans: ['IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '13px', letterSpacing: '0.09em' }],
        '3xs': ['9px', { lineHeight: '11px', letterSpacing: '0.12em' }],
      },
      borderRadius: { none: '0', DEFAULT: '2px', sm: '1px' },
      transitionTimingFunction: {
        instrument: 'cubic-bezier(0.22, 1, 0.36, 1)',
        precise: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'scan-sweep': { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(2400%)' } },
        'ticker': { '0%': { opacity: '0.25' }, '50%': { opacity: '1' }, '100%': { opacity: '0.25' } },
        'reveal-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'draw-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'scan-sweep': 'scan-sweep 7s linear infinite',
        ticker: 'ticker 2.4s ease-in-out infinite',
        'reveal-up': 'reveal-up 420ms cubic-bezier(0.22,1,0.36,1) both',
        'draw-x': 'draw-x 700ms cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 220ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}
