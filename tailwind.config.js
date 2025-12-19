import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%',
            h1: {
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.5rem',
              marginTop: '2rem',
              marginBottom: '1rem',
            },
            h2: {
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: '0.3rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
            },
            'thead th': {
              backgroundColor: '#f8fafc',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
            },
            'tbody td': {
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
            },
            blockquote: {
              fontStyle: 'normal',
              fontWeight: '400',
              borderLeftWidth: '4px',
              borderLeftColor: '#e2e8f0',
              backgroundColor: '#f8fafc',
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
            },
            code: {
              backgroundColor: '#f1f5f9',
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
}