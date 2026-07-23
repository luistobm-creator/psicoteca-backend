// Agregados chartables a partir de filas con `created_at` real — nunca
// números inventados. Compartido por Dashboard y Estadísticas de estudio.

/** Altas por día de los últimos `days` días (terminando hoy), a partir de `created_at`. */
export function dailyCounts(rows, days = 7) {
  const buckets = new Array(days).fill(0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  rows.forEach((row) => {
    if (!row.created_at) return;
    const d = new Date(row.created_at);
    const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((today - dMidnight) / 86400000);
    const idx = days - 1 - dayDiff;
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  });
  return buckets;
}
