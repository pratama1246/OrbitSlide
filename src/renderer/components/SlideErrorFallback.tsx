import React from 'react';
import { WebsiteSlide } from '../../types';

interface SlideErrorFallbackProps {
  slide: WebsiteSlide | null;
  errorMessage?: string;
  remainingSeconds: number;
  onReload: () => void;
  onNext: () => void;
}

export const SlideErrorFallback: React.FC<SlideErrorFallbackProps> = ({
  slide,
  errorMessage,
  remainingSeconds,
  onReload,
  onNext
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6">
      <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-slate-100 mb-1">
          Gagal Memuat Website
        </h2>
        <p className="text-sm font-medium text-slate-300 mb-2 truncate max-w-full">
          {slide?.name || 'Slide'}
        </p>

        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 font-mono mb-5 text-left overflow-x-auto break-all">
          <div className="text-slate-500 mb-1">Target URL: {slide?.url}</div>
          <div className="text-rose-400">{errorMessage || 'Koneksi terputus atau server tidak merespons.'}</div>
        </div>

        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onReload}
            className="flex-1 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
          >
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
          >
            Lewati ({remainingSeconds}s)
          </button>
        </div>

        <p className="text-[11px] text-slate-400 mt-4">
          Slideshow akan otomatis beralih ke slide berikutnya saat hitungan waktu berakhir.
        </p>
      </div>
    </div>
  );
};
