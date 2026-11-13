/** @type {import('tailwindcss').Config} */
// Design tokens dealt by the design-taste-frontend skill:
//   palette "cool-white-slate" (Frost and slate): ground #f7f9fa, surface #ecf0f2, ink #1f3038, accent #0d7480
//   type: Be Vietnam Pro (display + text, full Vietnamese) + Noto Sans Mono (IPA, full IPA coverage), radius "round".
// `slate` is the neutral scale built on that ink, `indigo` is re-pointed at the teal accent so the
// whole UI stays one system; violet/fuchsia are removed (skill rule: never violet).
const neutral = {
  50: '#f7f9fa',
  100: '#ecf0f2',
  200: '#dde3e6',
  300: '#c3ccd0',
  400: '#627077',
  500: '#5d6b72',
  600: '#4a5960',
  700: '#36454c',
  800: '#2a3a41',
  900: '#1f3038',
  950: '#152227',
};
const accent = {
  50: '#eef7f8',
  100: '#d5ecee',
  200: '#acd8dc',
  300: '#78bcc3',
  400: '#3f9aa4',
  500: '#1a828d',
  600: '#0d7480',
  700: '#0b5f69',
  800: '#0c4d55',
  900: '#0e3f46',
  950: '#082a2f',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: neutral,
        indigo: accent,
        violet: accent,
        fuchsia: accent,
        ink: neutral[900],
        ground: neutral[50],
        surface: neutral[100],
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"Noto Sans Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        ui: 'cubic-bezier(.2,.8,.2,1)',
        enter: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
};
