import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers range
  const pages = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-matte-900 border-t border-matte-700/80 text-xs text-gray-400">
      <div>
        Showing <span className="font-semibold text-gray-200">{startItem}</span> to{' '}
        <span className="font-semibold text-gray-200">{endItem}</span> of{' '}
        <span className="font-semibold text-gray-200">{totalItems}</span> results
      </div>

      <div className="flex items-center gap-1.5 sm:gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 sm:p-1.5 rounded-lg border border-matte-700 hover:bg-matte-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-target sm:min-h-0 flex items-center justify-center"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Mobile Compact Page Pill */}
        <div className="sm:hidden px-3 py-1.5 text-xs font-mono font-bold text-white bg-matte-800 border border-matte-700 rounded-lg">
          {currentPage} / {totalPages}
        </div>

        {/* Desktop / Tablet Number Buttons */}
        <div className="hidden sm:flex items-center gap-1">
          {startPage > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-2.5 py-1 rounded-lg border border-matte-700 hover:bg-matte-800 text-gray-300"
              >
                1
              </button>
              {startPage > 2 && <span className="px-1 text-gray-600">...</span>}
            </>
          )}

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                p === currentPage
                  ? 'bg-firebase-600 text-white font-bold border-firebase-500 shadow-sm'
                  : 'border-matte-700 hover:bg-matte-800 text-gray-300'
              }`}
            >
              {p}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-1 text-gray-600">...</span>}
              <button
                onClick={() => onPageChange(totalPages)}
                className="px-2.5 py-1 rounded-lg border border-matte-700 hover:bg-matte-800 text-gray-300"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 sm:p-1.5 rounded-lg border border-matte-700 hover:bg-matte-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-target sm:min-h-0 flex items-center justify-center"
          aria-label="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
