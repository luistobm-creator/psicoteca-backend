// Mini-gráfico de barras hecho a mano (sin librería nueva, mismo criterio
// que los SVG de icons.jsx). La barra de hoy se resalta en acento.
export default function Sparkline({ data }) {
  const max = Math.max(1, ...data);
  const w = data.length * 7 - 2;
  return (
    <svg className="sparkline" width={w} height={26} viewBox={`0 0 ${w} 26`} aria-hidden="true">
      {data.map((v, i) => {
        const h = Math.max(2, Math.round((v / max) * 22));
        const isNow = i === data.length - 1;
        return (
          <rect
            key={i}
            x={i * 7}
            y={26 - h}
            width={5}
            height={h}
            rx={1.5}
            className={'sparkline__bar' + (isNow ? ' sparkline__bar--now' : '')}
          />
        );
      })}
    </svg>
  );
}
