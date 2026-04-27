/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50:  '#f0edff',
                    100: '#e0d9ff',
                    200: '#c2b3ff',
                    300: '#a38dff',
                    400: '#8566ff',
                    500: '#6B46FE',
                    600: '#5535e0',
                    700: '#4027b8',
                    800: '#2c1a90',
                    900: '#1a0e68',
                },
                surface: {
                    bg:      '#F5F6FA',
                    card:    '#FFFFFF',
                    border:  '#E5E7EB',
                    hover:   '#F9FAFB',
                    divider: '#F3F4F6',
                },
            },
            boxShadow: {
                card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.08)',
            },
        },
    },
    plugins: [],
}
