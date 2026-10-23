import React from 'react';
import { WebsiteSlide } from '../../types';
import { Logo } from './Logo';

interface SlideErrorFallbackProps {
  slide: WebsiteSlide | null;
  errorMessage?: string;
  retryCount?: number;
  remainingSeconds: number;
  onReload: () => void;
  onNext: () => void;
}

export const SlideErrorFallback: React.FC<SlideErrorFallbackProps> = ({
  slide,
  errorMessage,
  retryCount = 0,
  remainingSeconds,
  onReload,
  onNext
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/95 backdrop-blur-xs p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Brand Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <Logo size={24} variant="mark-gradient" className="shrink-0" />
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
            MonitorSlide
          </span>
        </div>

        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          Gagal Memuat Website
        </h2>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 truncate max-w-full">
          {slide?.name || 'Slide Monitoring'}
        </p>

        {retryCount > 0 && (
          <span className="mb-3 px-2.5 py-0.5 rounded-full text-[11px] bg-amber-50 border border-amber-300 text-amber-700 dark:bg-amber-950/80 dark:border-amber-500/40 dark:text-amber-300">
            Percobaan Pemulihan Otomatis: {retryCount} / 3
          </span>
        )}

        <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 mb-5 text-left overflow-x-auto break-all">
          <div className="text-slate-500 dark:text-slate-400 mb-1">URL: {slide?.url}</div>
          <div className="text-rose-600 dark:text-rose-400 font-semibold">{errorMessage || 'Koneksi terputus atau server tidak merespons.'}</div>
        </div>

        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onReload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 border border-slate-200 dark:border-transparent"
          >
            Muat Ulang (F5)
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            Lewati ({remainingSeconds}s)
          </button>
        </div>
      </div>
    </div>
  );
};
