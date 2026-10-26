import React from 'react';
import { Logo } from './Logo';
import { AppLanguage, getTranslations } from '../i18n';

interface PopupModalProps {
  url: string | null;
  profile: string | null;
  isMonitoring: boolean;
  language?: AppLanguage;
  onClose: () => void;
}

export const PopupModal: React.FC<PopupModalProps> = ({
  url,
  profile,
  isMonitoring,
  language = 'id',
  onClose
}) => {
  const t = getTranslations(language);
  const isStandbyPreview = !!url && url.startsWith('local://standby');

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-light-blue-900 border-b border-slate-200 dark:border-light-blue-800 px-5 flex items-center justify-between z-50 shadow-md">
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-4">
        <Logo size={22} variant="mark-gradient" className="shrink-0" />
        <span className="w-2 h-2 rounded-full bg-mustard-500 shrink-0" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 shrink-0">
          {isStandbyPreview
            ? t.popupStandbyPreview
            : isMonitoring
              ? t.popupWindow
              : t.popupTestLogin}
        </span>
        {!isStandbyPreview && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-light-blue-50 border border-light-blue-200 text-light-blue-700 dark:bg-light-blue-950/80 dark:border-light-blue-700 dark:text-light-blue-300 shrink-0">
            {t.popupProfileBadge}: {profile || 'default'}
          </span>
        )}
        {url && !isStandbyPreview && (
          <span
            className="text-xs text-slate-600 dark:text-light-blue-200 truncate bg-slate-100 dark:bg-light-blue-950/90 px-2.5 py-1 rounded border border-slate-200 dark:border-light-blue-800 max-w-md"
            title={url}
          >
            {url}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        title={t.popupCloseTooltip}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition shrink-0 focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>{t.close}</span>
      </button>
    </div>
  );
};
