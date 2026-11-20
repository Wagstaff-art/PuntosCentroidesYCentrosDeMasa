import type { Config } from 'tailwindcss';

const withVar = (name: string): string => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: withVar('--lab-bg'),
          panel: withVar('--lab-panel'),
          border: withVar('--lab-border'),
          accent: withVar('--lab-accent'),
          stable: withVar('--lab-stable'),
          danger: withVar('--lab-danger'),
          warn: withVar('--lab-warn'),
          'surface-1': withVar('--lab-surface-1'),
          'surface-2': withVar('--lab-surface-2'),
          elevated: withVar('--lab-elevated'),
          muted: withVar('--lab-text-muted'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      width: {
        'panel-left': '320px',
        'panel-right': '380px',
      },
    },
  },
  plugins: [],
};

export default config;
