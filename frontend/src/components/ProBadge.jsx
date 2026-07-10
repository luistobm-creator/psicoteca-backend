import { Lock, Crown } from './icons.jsx';

// Etiqueta discreta para señalar contenido premium.
//  - Plan 'free'  -> candado (bloqueado): invita a mejorar de plan.
//  - Plan 'pro'   -> corona (desbloqueado): confirma acceso incluido.
// `size`: 'sm' (por defecto) para tarjetas, 'xs' para chips compactos.
export default function ProBadge({ plan = 'free', size = 'sm', className = '' }) {
  const locked = plan !== 'pro';
  const px = size === 'xs' ? 11 : 12;

  return (
    <span
      className={
        'probadge probadge--' +
        size +
        (locked ? ' probadge--locked' : ' probadge--unlocked') +
        (className ? ' ' + className : '')
      }
      title={
        locked
          ? 'Contenido Pro · mejora tu plan para acceder'
          : 'Contenido Pro · incluido en tu plan'
      }
    >
      {locked ? <Lock width={px} height={px} /> : <Crown width={px} height={px} />}
      <span className="probadge__text">Pro</span>
    </span>
  );
}
