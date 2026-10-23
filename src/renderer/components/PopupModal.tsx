import React from 'react';

interface PopupModalProps {
  url: string | null;
  profile: string | null;
  isMonitoring: boolean;
  onClose: () => void;
}

export const PopupModal: React.FC<PopupModalProps> = ({
  url,
  profile,
  isMonitoring,
  onClose
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/80 px-5 flex items-center justify-between z-50 shadow-md">
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 shrink-0">
          {isMonitoring ? 'Jendela Popup' : 'Uji & Login Sesi'}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-500/40 dark:text-indigo-300 font-mono shrink-0">
          Profil: {profile || 'default'}
        </span>
        {url && (
          <span
            className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate bg-slate-100 dark:bg-slate-950/80 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 max-w-md"
            title={url}
          >
            {url}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        title="Tutup Jendela (Esc)"
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition shrink-0 focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>Tutup (Esc)</span>
      </button>
    </div>
  );
};
