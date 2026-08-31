/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#FBFBFF',
        surface: '#FFFFFF',
        raised: '#F4F7FA',
        elevated: '#E9F0F6',
        line: '#D8E3EC',
        'line-strong': '#B4C7D7',
        ink: '#000000',
        muted: '#000000',
        faint: '#000000',
        ghost: '#000000',
        accent: {
          DEFAULT: '#2B59C3',
          dim: '#01BAEF',
          deep: '#1B3F96',
        },
        risk: {
          low: '#6E8896',
          mod: '#B3873F',
          high: '#C85A32',
          crit: '#D8402A',
        },
      },
      fontFamily: {
        sans: ['Public Sans', 'system-ui', 'sans-serif'],
        display: ['Caudex', 'serif'],
        serif: ['Caudex', 'serif'],
        secondary: ['Caudex', 'serif'],
        tertiary: ['Instrument Serif', 'serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '13px', letterSpacing: '0.09em' }],
        '3xs': ['9px', { lineHeight: '11px', letterSpacing: '0.12em' }],
      },
      borderRadius: {
        none: '0',
        sm: '8px',
        DEFAULT: '12px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        full: '9999px',
      },
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
