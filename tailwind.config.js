/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9eaff',
          200: '#b6d4ff',
          300: '#85b6ff',
          400: '#5a93ff',
          500: '#3171f2',
          600: '#1f57d6',
          700: '#1844ab',
          800: '#163b87',
          900: '#13306b',
        },
        accent: {
          500: '#ff7a00',
          600: '#e56a00',
        },
      },
      boxShadow: {
        card: '0 18px 44px -28px rgba(15, 23, 42, 0.32), 0 1px 2px rgba(15, 23, 42, 0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
