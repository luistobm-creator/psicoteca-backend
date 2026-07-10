import { Star, ArrowRight, Lock } from './icons.jsx';
import { categoryIcon } from '../lib/categoryIcons.jsx';
import { fileType } from '../lib/fileType.js';

// "Accesos rápidos": si el usuario ya ha abierto documentos, muestra los más
// recientes (persistidos en localStorage por App). Si aún no hay historial,
// ofrece sugerencias a partir de las categorías principales, para que la
// sección nunca se vea vacía.
export default function QuickAccess({
  recents = [],
  topFolders = [],
  plan = 'free',
  onOpenFile,
  onOpenFolder,
}) {
  const hasRecents = recents.length > 0;
  const suggestions = topFolders.slice(0, 4);
  const isPro = plan === 'pro';

  if (!hasRecents && suggestions.length === 0) return null;

  return (
    <section className="dash-section quick fade-in">
      <header className="dash-section__head">
        <h2 className="dash-section__title">
          <Star width={17} height={17} />
          Accesos rápidos
        </h2>
        <span className="muted">
          {hasRecents ? 'Tus documentos recientes' : 'Sugerencias para empezar'}
        </span>
      </header>

      <div className="quick__row">
        {hasRecents
          ? recents.map((item) => {
              const { label, color } = fileType(item);
              const locked = !!item.is_premium && !isPro;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={'quick__item' + (locked ? ' quick__item--locked' : '')}
                  onClick={() => onOpenFile(item)}
                  title={locked ? `${item.name} · Contenido Pro` : item.name}
                >
                  <span
                    className="quick__chip"
                    style={{ '--chip': color }}
                    aria-hidden="true"
                  >
                    {label}
                  </span>
                  <span className="quick__name">{item.name}</span>
                  {locked && (
                    <span className="quick__lock" aria-label="Contenido Pro">
                      <Lock width={13} height={13} />
                    </span>
                  )}
                </button>
              );
            })
          : suggestions.map((f) => {
              const locked = !!f.is_premium && !isPro;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={
                    'quick__item quick__item--folder' +
                    (locked ? ' quick__item--locked' : '')
                  }
                  onClick={() => onOpenFolder(f)}
                  title={locked ? `${f.name} · Contenido Pro` : f.name}
                >
                  <span className="quick__icon" aria-hidden="true">
                    {categoryIcon(f.name, 17)}
                  </span>
                  <span className="quick__name">{f.name}</span>
                  {locked ? (
                    <span className="quick__lock" aria-label="Contenido Pro">
                      <Lock width={13} height={13} />
                    </span>
                  ) : (
                    <ArrowRight className="quick__arrow" width={14} height={14} />
                  )}
                </button>
              );
            })}
      </div>
    </section>
  );
}
