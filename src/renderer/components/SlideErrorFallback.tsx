import React from 'react';
import { WebsiteSlide } from '../../types';
import { Logo } from './Logo';
import { AppLanguage, getTranslations } from '../i18n';

interface SlideErrorFallbackProps {
  slide: WebsiteSlide | null;
  errorMessage?: string;
  retryCount?: number;
  remainingSeconds: number;
  language?: AppLanguage;
  onReload: () => void;
  onNext: () => void;
}

export const SlideErrorFallback: React.FC<SlideErrorFallbackProps> = ({
  slide,
  errorMessage,
  retryCount = 0,
  remainingSeconds,
  language = 'id',
  onReload,
  onNext
}) => {
  const t = getTranslations(language);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-light-blue-950/80 dark:bg-light-blue-950/92 p-6">
      <div className="w-full max-w-md bg-white dark:bg-light-blue-900 border border-rose-300 dark:border-rose-500/40 rounded-xl p-6 shadow-xl flex flex-col items-center text-center">
        <div className="flex items-center gap-2 mb-4">
          <Logo size={24} variant="mark-gradient" className="shrink-0" />
          <span className="text-xs font-bold text-slate-500 dark:text-light-blue-300 tracking-wider uppercase">
            {t.appName}
          </span>
        </div>

        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          {t.errFallbackTitle}
        </h2>
        <p className="text-sm font-medium text-slate-600 dark:text-light-blue-200 mb-2 truncate max-w-full">
          {slide?.name || t.errFallbackDefaultSlide}
        </p>

        {retryCount > 0 && (
          <span className="mb-3 px-2.5 py-0.5 rounded-full text-[11px] bg-mustard-50 border border-mustard-400 text-mustard-800 dark:bg-mustard-950/80 dark:border-mustard-500/40 dark:text-mustard-300">
            {t.errAutoRetry(retryCount)}
          </span>
        )}

        <div className="w-full bg-slate-50 dark:bg-light-blue-950 border border-slate-200 dark:border-light-blue-800 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 mb-5 text-left overflow-x-auto break-all">
          <div className="text-slate-500 dark:text-light-blue-300 mb-1">URL: {slide?.url}</div>
          <div className="text-rose-600 dark:text-rose-400 font-semibold">{errorMessage || t.errDefaultReason}</div>
        </div>

        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onReload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-light-blue-800 dark:hover:bg-light-blue-700 text-slate-800 dark:text-slate-100 text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-light-blue-400 border border-slate-200 dark:border-light-blue-700"
          >
            {t.reloadBtn}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {t.skipBtn} · {remainingSeconds}s
          </button>
        </div>
      </div>
    </div>
  );
};
