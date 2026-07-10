import { Search, X } from './icons.jsx';

export default function SearchBar({ value, onChange, onClear }) {
  return (
    <div className="searchbar">
      <Search className="searchbar__icon" width={16} height={16} />
      <input
        className="searchbar__input"
        type="text"
        placeholder="Buscar en la Psicoteca…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="searchbar__clear"
          onClick={onClear}
          title="Limpiar búsqueda"
          aria-label="Limpiar búsqueda"
        >
          <X width={15} height={15} />
        </button>
      )}
    </div>
  );
}
