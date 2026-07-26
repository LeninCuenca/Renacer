/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F7D132',
          50: '#FEF9E7', 100: '#FDF1C2', 200: '#FBE488', 300: '#F9D84E',
          400: '#F7D132', 500: '#E8B91F', 600: '#C99A12', 700: '#9A740E',
          800: '#6B4F08', 900: '#3D2D04',
        },
        navy: {
          DEFAULT: '#1B263B',
          50: '#E8ECF1', 100: '#C7CFDA', 200: '#8E9DB3', 300: '#556B8C',
          400: '#2E4366', 500: '#1B263B', 600: '#152032', 700: '#101827',
          800: '#0A111B', 900: '#050A10',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
