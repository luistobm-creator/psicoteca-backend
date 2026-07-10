import { ArrowLeft, ArrowRight } from './icons.jsx';

export default function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ArrowLeft width={15} height={15} /> Anterior
      </button>
      <span className="pagination__info">
        Página {page} de {totalPages} · {total} elementos
      </span>
      <button
        type="button"
        className="btn"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente <ArrowRight width={15} height={15} />
      </button>
    </div>
  );
}
