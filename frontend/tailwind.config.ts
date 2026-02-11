import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Báo mới - Thanh Niên style red theme
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#D31016',  // Main Thanh Niên Red
          600: '#b80d12',
          700: '#9a0b0f',
          800: '#7f090c',
          900: '#5c0709',
        },
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        news: {
          red: '#D31016',
          orange: '#FF6600',
          blue: '#0066CC',
          gray: '#666666',
          lightgray: '#f5f5f5',
        },
        success: {
          500: '#52c41a',
          600: '#389e0d',
        },
        info: {
          500: '#1890ff',
          600: '#096dd9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
