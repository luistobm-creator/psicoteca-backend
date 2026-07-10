import { Search, X } from './icons.jsx';

export default function SearchBar({
  value,
  onChange,
  onClear,
  inputRef,
  placeholder = 'Buscar en la Psicoteca…',
  className = '',
  showHint = false,
}) {
  return (
    <div className={'searchbar' + (className ? ' ' + className : '')}>
      <Search className="searchbar__icon" width={16} height={16} />
      <input
        ref={inputRef}
        className="searchbar__input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        aria-label="Buscar en la biblioteca"
      />
      {value ? (
        <button
          type="button"
          className="searchbar__clear"
          onClick={onClear}
          title="Limpiar búsqueda"
          aria-label="Limpiar búsqueda"
        >
          <X width={15} height={15} />
        </button>
      ) : (
        showHint && (
          <kbd className="searchbar__kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        )
      )}
    </div>
  );
}
