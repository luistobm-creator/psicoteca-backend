// Estructura del menú "Perfil" (Estudio / Progreso / Consultorio / Comunidad /
// Biblioteca / Cuenta), extraída tal cual de `profileSections` en el diseño
// fuente (`Psicoteca App.dc.html`). Los `iconPath` son el `d` SVG exacto del
// diseño; `to` apunta a una ruta real ya existente o a un placeholder
// "Próximamente" (`/app/...`) para las herramientas aún no construidas.
export const PROFILE_MENU = [
  {
    title: 'Estudio',
    rows: [
      { label: 'Modo examen', to: '/app/modo-examen', iconPath: 'M9 11l3 3 8-8 M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { label: 'Tarjetas de repaso', to: '/app/tarjetas-repaso', iconPath: 'M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8 3h11a2 2 0 0 1 2 2v11' },
      { label: 'Modo enfoque', to: '/app/modo-enfoque', iconPath: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01' },
      { label: 'Glosario clínico', to: '/app/glosario', iconPath: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z M9 7h7 M9 11h5' },
      { label: 'Citas y referencias APA', to: '/app/citas-apa', iconPath: 'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z' },
    ],
  },
  {
    title: 'Progreso',
    rows: [
      { label: 'Estadísticas de estudio', to: '/app/estadisticas', iconPath: 'M3 3v18h18 M7 14l4-4 3 3 5-6' },
      { label: 'Historial de lectura', to: '/app/historial', iconPath: 'M12 8v4l3 2 M3.05 11a9 9 0 1 1 .5 4 M3 5v5h5' },
      { label: 'Logros y medallas', to: '/app/logros', iconPath: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M17 5h2a2 2 0 0 1 0 4h-2 M7 5H5a2 2 0 0 0 0 4h2' },
    ],
  },
  {
    title: 'Consultorio',
    rows: [
      { label: 'Configurar consultorio', to: '/app/consultorio/configurar', iconPath: 'M3 21h18 M5 21V7l7-4 7 4v14 M9 21v-6h6v6 M9 11h.01 M15 11h.01' },
      { label: 'Agenda de citas', to: '/app/agenda', iconPath: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
      { label: 'Directorio de pacientes', to: '/app/pacientes', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
      { label: 'Estadísticas del consultorio', to: '/app/consultorio/estadisticas', iconPath: 'M3 3v18h18 M7 15l4-4 3 3 5-6' },
      { label: 'Tareas terapéuticas', to: '/app/tareas', iconPath: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { label: 'Notas de voz', to: '/app/notas-voz', iconPath: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4' },
      { label: 'Facturación de consulta', to: '/app/facturacion-consulta', iconPath: 'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
      { label: 'Consentimiento con firma', to: '/app/consentimiento', iconPath: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z M3 21c2-4 5-4 7-2' },
      { label: 'Plantillas de formato', to: '/app/plantillas', iconPath: 'M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 12h6 M9 16h4' },
    ],
  },
  {
    title: 'Comunidad',
    rows: [
      { label: 'Mensajes', to: '/app/mensajes', iconPath: 'M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z' },
      { label: 'Grupos de estudio', to: '/app/grupos', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
      { label: 'Ranking de la comunidad', to: '/app/ranking', iconPath: 'M3 3v18h18 M7 16v-5 M12 16V8 M17 16v-8' },
      { label: 'Refiere colegas', to: '/app/referidos', iconPath: 'M16 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0z M2.5 21a6.5 6.5 0 0 1 13 0 M19 8v6 M22 11h-6' },
    ],
  },
  {
    title: 'Biblioteca',
    rows: [
      { label: 'Favoritos rápidos', to: '/app', iconPath: 'M12 2l2.9 6.3 6.9.6-5.2 4.6 1.5 6.8L12 17.3 5.9 20.9l1.5-6.8L2.2 9.5l6.9-.6z' },
      { label: 'Mis descargas', to: '/app/descargas', iconPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
      { label: 'Suscripción y facturación', to: '/configuracion', iconPath: 'M2 7h20v12H2z M2 11h20' },
    ],
  },
  {
    title: 'Cuenta',
    rows: [
      { label: 'Ajustes', to: '/configuracion', iconPath: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
      { label: 'Notificaciones', to: '/app/notificaciones', iconPath: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0' },
      { label: 'Buzón de sugerencias', to: '/app/sugerencias', iconPath: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' },
      { label: 'Ayuda y soporte', to: '/app/ayuda', iconPath: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01' },
    ],
  },
];

// Rutas que YA tienen una herramienta real construida (además de /app y
// /configuracion, que ya se excluían). Cada una que se agregue aquí deja de
// caer en la página "Próximamente".
const BUILT_ROUTES = new Set([
  '/app',
  '/configuracion',
  '/app/glosario',
  '/app/agenda',
  '/app/pacientes',
  '/app/notas-voz',
  '/app/tareas',
  '/app/modo-examen',
  '/app/tarjetas-repaso',
  '/app/facturacion-consulta',
  '/app/consultorio/estadisticas',
]);

// Rutas nuevas (no existentes aún) que deben caer en la página "Próximamente".
// Se deriva de PROFILE_MENU en vez de mantenerse a mano, para que nunca se
// desincronice: cualquier `to` que no esté en BUILT_ROUTES es, por
// definición, una herramienta que todavía no existe.
export const COMING_SOON_ROUTES = PROFILE_MENU.flatMap((section) =>
  section.rows
    .filter((row) => !BUILT_ROUTES.has(row.to))
    .map((row) => ({ path: row.to, title: row.label }))
);
