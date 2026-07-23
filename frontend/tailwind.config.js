/** @type {import('tailwindcss').Config} */
export default {
  // El toggle de tema ya existente (App.jsx pone data-theme="dark" en <html>)
  // sigue siendo la única fuente de verdad — Tailwind solo observa ese atributo.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Puente a las variables CSS existentes (styles.css) en vez de una
      // paleta nueva y paralela: así los estilos legacy y los componentes
      // rediseñados con Tailwind comparten exactamente los mismos tokens,
      // y el toggle claro/oscuro sigue funcionando sin duplicar lógica.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ink: 'var(--text)',
        'ink-muted': 'var(--text-muted)',
        'ink-soft': 'var(--text-soft)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          weak: 'var(--accent-weak)',
          soft: 'var(--accent-soft)',
        },
        serene: 'var(--serene)',
        danger: 'var(--danger)',
        pro: 'var(--pro)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--shadow)',
        lift: '0 20px 40px -12px rgba(16, 60, 45, 0.25), 0 4px 12px -4px rgba(16, 60, 45, 0.15)',
        'lift-dark': '0 20px 40px -12px rgba(0, 0, 0, 0.55), 0 4px 12px -4px rgba(0, 0, 0, 0.4)',
        glow: '0 0 0 1px rgba(16, 185, 129, 0.15), 0 8px 24px -8px rgba(16, 185, 129, 0.35)',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(60% 50% at 15% 0%, rgba(16,185,129,0.08) 0%, transparent 60%), radial-gradient(50% 40% at 100% 20%, rgba(45,140,130,0.06) 0%, transparent 60%)',
        'mesh-dark':
          'radial-gradient(60% 50% at 15% 0%, rgba(16,185,129,0.16) 0%, transparent 60%), radial-gradient(55% 45% at 100% 15%, rgba(20,184,166,0.12) 0%, transparent 60%)',
        'accent-gradient': 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
