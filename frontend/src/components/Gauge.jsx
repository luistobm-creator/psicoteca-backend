import { ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

// Medidor circular (0-100%) reutilizado por las páginas de Estadísticas
// (consultorio y estudio). `value=null` se pinta como "—" (sin dato real).
export default function Gauge({ label, value }) {
  const pct = value ?? 0;
  const chartData = [{ name: label, value: pct, fill: 'var(--accent)' }];
  return (
    <div className="gauge">
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
          <RadialBar dataKey="value" background={{ fill: 'var(--surface-2)' }} cornerRadius={8} max={100} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="gauge__label">
        <span className="gauge__value">{value == null ? '—' : `${value}%`}</span>
        <span className="settings__muted">{label}</span>
      </div>
    </div>
  );
}
