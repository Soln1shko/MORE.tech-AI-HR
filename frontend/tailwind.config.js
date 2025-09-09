/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-scale': 'pulse-scale 1.5s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'rainbow-glow': 'rainbow-glow 3s ease-in-out infinite',
        'audio-pulse': 'audio-pulse 0.1s ease-in-out',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in': 'fade-in 0.2s ease-in-out',
      },
      keyframes: {
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px #6b7280, 0 0 10px #6b7280, 0 0 15px #6b7280' },
          '100%': { boxShadow: '0 0 10px #6b7280, 0 0 20px #6b7280, 0 0 30px #6b7280' },
        },
        'rainbow-glow': {
          '0%': { 
            boxShadow: '0 0 20px #6b7280, 0 0 40px #6b7280, 0 0 60px #6b7280',
            background: 'linear-gradient(45deg, #6b7280, #9ca3af)'
          },
          '25%': { 
            boxShadow: '0 0 20px #9ca3af, 0 0 40px #9ca3af, 0 0 60px #9ca3af',
            background: 'linear-gradient(45deg, #9ca3af, #d1d5db)'
          },
          '50%': { 
            boxShadow: '0 0 20px #d1d5db, 0 0 40px #d1d5db, 0 0 60px #d1d5db',
            background: 'linear-gradient(45deg, #d1d5db, #f3f4f6)'
          },
          '75%': { 
            boxShadow: '0 0 20px #f3f4f6, 0 0 40px #f3f4f6, 0 0 60px #f3f4f6',
            background: 'linear-gradient(45deg, #f3f4f6, #e5e7eb)'
          },
          '100%': { 
            boxShadow: '0 0 20px #e5e7eb, 0 0 40px #e5e7eb, 0 0 60px #e5e7eb',
            background: 'linear-gradient(45deg, #e5e7eb, #6b7280)'
          },
        },
        'audio-pulse': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(var(--scale))' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      colors: {
        'gray-custom': {
          '50': '#f9fafb',
          '100': '#f3f4f6',
          '200': '#e5e7eb',
          '300': '#d1d5db',
          '400': '#9ca3af',
          '500': '#6b7280',
          '600': '#4b5563',
          '700': '#374151',
          '800': '#1f2937',
          '850': '#1a202c',
          '900': '#111827',
          '950': '#0d1117',
        },
        'dark': {
          '50': '#fafafa',
          '100': '#f4f4f5',
          '200': '#e4e4e7',
          '300': '#d4d4d8',
          '400': '#a1a1aa',
          '500': '#71717a',
          '600': '#52525b',
          '700': '#3f3f46',
          '800': '#27272a',
          '850': '#1f1f23',
          '900': '#18181b',
          '925': '#141417',
          '950': '#0a0a0a',
        },
        'accent': {
          'blue': '#3b82f6',
          'purple': '#8b5cf6',
          'emerald': '#10b981',
          'orange': '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}

