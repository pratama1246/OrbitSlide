import React from 'react';

export type LogoVariant = 'mark-gradient' | string;

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: LogoVariant;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  className = '',
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="slideGradFramelessComp" x1="22" y1="33" x2="88" y2="79" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#338399" />
          <stop offset="50%" stopColor="#40a4bf" />
          <stop offset="100%" stopColor="#66b6cc" />
        </linearGradient>
      </defs>
      <rect x="15" y="27" width="66" height="46" rx="8" fill="#66b6cc" fillOpacity="0.26" stroke="#40a4bf" strokeOpacity="0.45" strokeWidth="1.4" transform="rotate(-6 15 27)" />
      <rect x="22" y="33" width="66" height="46" rx="8" fill="url(#slideGradFramelessComp)" />
      <rect x="29" y="43" width="23" height="4.5" rx="2" fill="#ffffff" />
      <rect x="29" y="52" width="35" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.82" />
      <rect x="29" y="59" width="19" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.52" />
      <circle cx="72" cy="56" r="8" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M 68 57 L 71 54 L 76 59" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="86" cy="31" r="4.5" fill="#2ed131" />
      <circle cx="86" cy="31" r="7" stroke="#2ed131" strokeWidth="1.5" strokeOpacity="0.38" fill="none" />
    </svg>
  );
};
