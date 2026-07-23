import { useEffect, useRef, useState } from 'react';

// Anima un número entero de su valor anterior al nuevo (ease-out, ~700ms).
// `target=null` (dato aún no cargado) se deja pasar tal cual — el llamador
// decide qué mostrar en ese caso (normalmente "—").
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target == null || Number.isNaN(target)) return undefined;
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
