/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#0B7A3B',
          dark:    '#065F2D',
          leaf:    '#9DCD3A',
          fresh:   '#7DBE31',
          surface: '#ECFDF3',
          soft:    '#F1F8E9',
          mint:    '#E8F7EF',
          border:  '#D9E8DD',
          text:    '#122018',
          muted:   '#64746B',
        },
        primary: {
          50:  '#F1F8E9',
          100: '#ECFDF3',
          500: '#0B7A3B',
          600: '#0B7A3B',
          700: '#065F2D',
          800: '#044A22',
        },
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.06)',
        nav:   '0 -1px 12px rgba(0,0,0,0.06)',
        fab:   '0 4px 16px rgba(11,122,59,0.35)',
        sheet: '0 -4px 24px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'snack-in': {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in':  'fade-in 0.2s ease-out',
        'snack-in': 'snack-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
