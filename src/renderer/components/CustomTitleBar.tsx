import React from 'react';

interface CustomTitleBarProps {
  title?: string;
  subtitle?: string;
}

export const CustomTitleBar: React.FC<CustomTitleBarProps> = ({
  title = 'MonitorSlide',
  subtitle
}) => {
  return (
    <div
      className="h-[42px] w-full flex items-center justify-between px-4 select-none border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-30 transition-colors"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5 min-w-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0">
          M
        </div>
        <span className="text-xs font-bold tracking-wide text-slate-800 dark:text-slate-100 truncate">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono truncate hidden sm:inline-block">
            {subtitle}
          </span>
        )}
      </div>

      {/* Spacer reserved for native Windows titleBarOverlay window controls (138px width) */}
      <div
        className="w-[138px] h-full shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      />
    </div>
  );
};
