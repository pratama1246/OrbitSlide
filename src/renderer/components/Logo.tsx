import React from 'react';

export type LogoVariant = 
  // Versi Non-Pembungkus (Frameless / Transparan)
  | 'mark-gradient'        // Kartu gradien indigo-cyan, tanpa pembungkus (cocok untuk header dark/light)
  | 'mark-white'           // Kartu putih bersih di atas latar transparan
  | 'mark-dark'            // Kartu hitam/gelap di atas latar transparan
  | 'mark-white-card'      // Kartu depan putih dengan aksen indigo, tanpa pembungkus
  // Versi Dengan Pembungkus (Squircle App Icon)
  | 'carousel-white'       // Base squircle putih bersih
  | 'carousel-clean-dark'  // Base squircle gelap bersih
  | 'carousel-white-card'  // Base squircle gelap, kartu depan putih
  | 'carousel-monochrome'  // Siluet putih
  | 'carousel'             // Default: mark-gradient
  | 'loop' 
  | 'monogram' 
  | 'dualpane';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: LogoVariant;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  variant = 'mark-gradient',
  className = '',
  ...props
}) => {
  // -------------------------------------------------------------
  // 1. VERSI NON-PEMBUNGKUS (FRAMELESS / PURE LOGO MARK)
  // -------------------------------------------------------------

  // Mark Gradient (Indigo -> Cyan) - Tanpa Pembungkus
  if (variant === 'mark-gradient' || variant === 'carousel') {
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
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect x="15" y="27" width="66" height="46" rx="8" fill="#818cf8" fillOpacity="0.25" stroke="#6366f1" strokeOpacity="0.4" strokeWidth="1.4" transform="rotate(-6 15 27)" />
        <rect x="22" y="33" width="66" height="46" rx="8" fill="url(#slideGradFramelessComp)" />
        <rect x="29" y="43" width="23" height="4.5" rx="2" fill="#ffffff" />
        <rect x="29" y="52" width="35" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.8" />
        <rect x="29" y="59" width="19" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.5" />
        <circle cx="72" cy="56" r="8" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
        <path d="M 68 57 L 71 54 L 76 59" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="86" cy="31" r="4.5" fill="#10b981" />
        <circle cx="86" cy="31" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
      </svg>
    );
  }

  // Mark White - Tanpa Pembungkus (untuk background gelap)
  if (variant === 'mark-white') {
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
        <rect x="15" y="27" width="66" height="46" rx="8" fill="#ffffff" fillOpacity="0.22" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.4" transform="rotate(-6 15 27)" />
        <rect x="22" y="33" width="66" height="46" rx="8" fill="#ffffff" />
        <rect x="29" y="43" width="23" height="4.5" rx="2" fill="#0f172a" />
        <rect x="29" y="52" width="35" height="3" rx="1.5" fill="#0f172a" fillOpacity="0.6" />
        <rect x="29" y="59" width="19" height="3" rx="1.5" fill="#0f172a" fillOpacity="0.4" />
        <circle cx="72" cy="56" r="8" fill="#0f172a" fillOpacity="0.1" stroke="#0f172a" strokeOpacity="0.3" strokeWidth="1.2" />
        <path d="M 68 57 L 71 54 L 76 59" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="86" cy="31" r="4.5" fill="#10b981" />
        <circle cx="86" cy="31" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
      </svg>
    );
  }

  // Mark Dark - Tanpa Pembungkus (untuk background terang / dokumen)
  if (variant === 'mark-dark') {
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
        <rect x="15" y="27" width="66" height="46" rx="8" fill="#0f172a" fillOpacity="0.12" stroke="#0f172a" strokeOpacity="0.25" strokeWidth="1.4" transform="rotate(-6 15 27)" />
        <rect x="22" y="33" width="66" height="46" rx="8" fill="#0f172a" />
        <rect x="29" y="43" width="23" height="4.5" rx="2" fill="#ffffff" />
        <rect x="29" y="52" width="35" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.75" />
        <rect x="29" y="59" width="19" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.5" />
        <circle cx="72" cy="56" r="8" fill="#ffffff" fillOpacity="0.15" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.2" />
        <path d="M 68 57 L 71 54 L 76 59" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="86" cy="31" r="4.5" fill="#10b981" />
        <circle cx="86" cy="31" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
      </svg>
    );
  }

  // Mark White Card - Tanpa Pembungkus
  if (variant === 'mark-white-card') {
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
        <rect x="15" y="27" width="66" height="46" rx="8" fill="#4f46e5" fillOpacity="0.15" stroke="#4f46e5" strokeOpacity="0.3" strokeWidth="1.4" transform="rotate(-6 15 27)" />
        <rect x="22" y="33" width="66" height="46" rx="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />
        <rect x="29" y="43" width="23" height="4.5" rx="2" fill="#4f46e5" />
        <rect x="29" y="52" width="35" height="3" rx="1.5" fill="#64748b" />
        <rect x="29" y="59" width="19" height="3" rx="1.5" fill="#94a3b8" />
        <circle cx="72" cy="56" r="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.2" />
        <path d="M 68 57 L 71 54 L 76 59" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="86" cy="31" r="4.5" fill="#10b981" />
        <circle cx="86" cy="31" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
      </svg>
    );
  }

  // -------------------------------------------------------------
  // 2. VERSI DENGAN PEMBUNGKUS (SQUIRCLE APP ICON)
  // -------------------------------------------------------------

  // Squircle White
  if (variant === 'carousel-white') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        <defs>
          <linearGradient id="slideGradCleanWhite_c" x1="28" y1="36" x2="94" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="104" height="104" rx="26" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="23" y="32" width="64" height="44" rx="8" fill="#e0e7ff" stroke="#c7d2fe" strokeWidth="1.2" transform="rotate(-6 23 32)" />
        <rect x="30" y="38" width="64" height="44" rx="8" fill="url(#slideGradCleanWhite_c)" />
        <rect x="37" y="48" width="22" height="4" rx="2" fill="#ffffff" />
        <rect x="37" y="56" width="34" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.8" />
        <rect x="37" y="63" width="18" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.5" />
        <circle cx="78" cy="60" r="8" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
        <path d="M 74 61 L 77 58 L 82 63" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="92" cy="36" r="4.5" fill="#10b981" />
        <circle cx="92" cy="36" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      </svg>
    );
  }

  // Squircle Clean Dark
  if (variant === 'carousel-clean-dark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        <defs>
          <linearGradient id="slideGradCleanDark_c" x1="28" y1="36" x2="94" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="104" height="104" rx="26" fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />
        <rect x="23" y="32" width="64" height="44" rx="8" fill="#312e81" fillOpacity="0.5" stroke="#4f46e5" strokeOpacity="0.4" strokeWidth="1.2" transform="rotate(-6 23 32)" />
        <rect x="30" y="38" width="64" height="44" rx="8" fill="url(#slideGradCleanDark_c)" />
        <rect x="37" y="48" width="22" height="4" rx="2" fill="#ffffff" />
        <rect x="37" y="56" width="34" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.8" />
        <rect x="37" y="63" width="18" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.5" />
        <circle cx="78" cy="60" r="8" fill="#ffffff" fillOpacity="0.2" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
        <path d="M 74 61 L 77 58 L 82 63" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="92" cy="36" r="4.5" fill="#10b981" />
        <circle cx="92" cy="36" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      </svg>
    );
  }

  // Squircle White Card
  if (variant === 'carousel-white-card') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        <rect x="8" y="8" width="104" height="104" rx="26" fill="#090d16" stroke="#1e293b" strokeWidth="1.5" />
        <rect x="23" y="32" width="64" height="44" rx="8" fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.2" transform="rotate(-6 23 32)" />
        <rect x="30" y="38" width="64" height="44" rx="8" fill="#ffffff" />
        <rect x="37" y="48" width="22" height="4" rx="2" fill="#4f46e5" />
        <rect x="37" y="56" width="34" height="3" rx="1.5" fill="#64748b" />
        <rect x="37" y="63" width="18" height="3" rx="1.5" fill="#94a3b8" />
        <circle cx="78" cy="60" r="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.2" />
        <path d="M 74 61 L 77 58 L 82 63" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="92" cy="36" r="4.5" fill="#10b981" />
        <circle cx="92" cy="36" r="7" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      </svg>
    );
  }

  return null;
};
