import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fresa: '#ab1816',
        rosa: '#f29ec1',
        chocolate: '#3a180f',
        crema: '#faeadd',
        tinta: '#000000',
        oliva: '#838623',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'ui-serif', 'serif'],
      },
      boxShadow: {
        card: '0 8px 30px rgba(58, 24, 15, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config
