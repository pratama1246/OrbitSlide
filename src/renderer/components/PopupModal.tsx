import React from 'react';

interface PopupModalProps {
  onClose: () => void;
}

export const PopupModal: React.FC<PopupModalProps> = ({ onClose }) => {
  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-slate-900/95 border-b border-slate-700/80 px-5 flex items-center justify-between z-50 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="text-sm font-medium text-slate-200">
          Tautan Terbuka dalam Popup
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
          Slideshow Dijeda
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        title="Tutup Popup (Esc)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold shadow transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>Tutup (Esc)</span>
      </button>
    </div>
  );
};
