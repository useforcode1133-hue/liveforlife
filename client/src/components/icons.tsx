import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Base({ size = 24, title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const P = "#4E65F6";
const B = "#5B5CE6";
const M = "#5B5CE6";
const S = "#D9FA64";
const C = "#5B5CE6";

export const HomeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4V14h-5v6.5h-4A1.5 1.5 0 0 1 4 19v-8.5Z" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M9.5 20.5V14h5v6.5" stroke={P} strokeWidth="1.7" />
  </Base>
);

export const BuildingIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3.5" width="11" height="17" rx="2" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M15 9.5h3.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H15" stroke={P} strokeWidth="1.7" />
    <path d="M7.5 7.5h1.5M11 7.5h1M7.5 11h1.5M11 11h1M7.5 14.5h1.5M11 14.5h1" stroke={B} strokeWidth="1.55" />
    <path d="M9 20.5v-3h2.5v3" fill={B} stroke={B} strokeWidth="1.4" />
  </Base>
);

export const FloorsIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" stroke={B} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M4 13 12 17.5 20 13" stroke={P} strokeWidth="1.7" />
    <path d="M4 17.5 12 22l8-4.5" stroke={M} strokeWidth="1.7" />
  </Base>
);

export const RoomIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M3.5 9.5h17" stroke={B} strokeWidth="1.55" />
    <circle cx="16" cy="15" r="1.3" fill={C} />
    <path d="M7.5 16.5v-3.2h4.2v3.2" stroke={B} strokeWidth="1.55" />
  </Base>
);

export const BedIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 18v-7.5A2.5 2.5 0 0 1 5.5 8h13A2.5 2.5 0 0 1 21 10.5V18" stroke={P} strokeWidth="1.7" />
    <path d="M3 15h18" stroke={P} strokeWidth="1.7" />
    <path d="M6 8V6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5V8" stroke={B} strokeWidth="1.55" />
    <rect x="6.5" y="10.5" width="4" height="3" rx="1.2" fill={S} />
    <path d="M3 18v2.5M21 18v2.5" stroke={P} strokeWidth="1.7" />
  </Base>
);

export const ResidentsIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9.5" cy="8" r="3.2" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M3.5 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke={P} strokeWidth="1.7" />
    <circle cx="17" cy="9" r="2.3" stroke={B} strokeWidth="1.55" fill="#CBE4FF" />
    <path d="M16 14.2c2.8-.4 5 1.7 5 4.4" stroke={B} strokeWidth="1.55" />
  </Base>
);

export const RentIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="2.5" y="6" width="19" height="12.5" rx="2.5" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <circle cx="12" cy="12.2" r="3.4" stroke={B} strokeWidth="1.7" fill="#fff" />
    <path d="M12 10.2v4M10.6 11.2h2.4a1 1 0 0 1 0 2h-2a1 1 0 0 0 0 2h2.5" stroke={M} strokeWidth="1.4" />
  </Base>
);

export const PaymentsIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 3.5h11l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V5a1.5 1.5 0 0 1 1-1.5Z" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M8 8.5h5M8 12h8M8 15.5h5" stroke={B} strokeWidth="1.55" />
    <circle cx="17" cy="17" r="3.6" fill={M} />
    <path d="m15.5 17 1.2 1.3 2-2.4" stroke="#fff" strokeWidth="1.55" />
  </Base>
);

export const FoodIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8Z" stroke={C} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M9 8c0-1.2 1-1.6 1-2.8M12.5 7.5c0-1.4 1-1.8 1-3M16 8c0-1.2 1-1.6 1-2.8" stroke={S} strokeWidth="1.55" />
    <path d="M3 21h18" stroke={P} strokeWidth="1.7" />
  </Base>
);

export const WifiIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M2.5 8.5a15 15 0 0 1 19 0" stroke={B} strokeWidth="1.7" />
    <path d="M5.5 12a10.5 10.5 0 0 1 13 0" stroke={P} strokeWidth="1.7" />
    <path d="M8.5 15.5a6 6 0 0 1 7 0" stroke={M} strokeWidth="1.7" />
    <circle cx="12" cy="19" r="1.6" fill={S} />
  </Base>
);

export const ComplaintIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3.5 21 19.5a1.5 1.5 0 0 1-1.3 2.2H4.3A1.5 1.5 0 0 1 3 19.5L12 3.5Z" stroke={C} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M12 9v5" stroke={C} strokeWidth="2" />
    <circle cx="12" cy="17.3" r="1.1" fill={C} />
  </Base>
);

export const BellIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M9.5 18.5a2.6 2.6 0 0 0 5 0" stroke={P} strokeWidth="1.7" />
    <circle cx="18" cy="5" r="3" fill={C} />
  </Base>
);

export const SettingsIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" stroke={P} strokeWidth="1.7" fill="#fff" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" stroke={B} strokeWidth="1.55" />
  </Base>
);

export const ProfileIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8.5" r="4" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" stroke={P} strokeWidth="1.7" />
  </Base>
);

export const CalendarIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M3.5 10h17M8 3v3.5M16 3v3.5" stroke={P} strokeWidth="1.7" />
    <rect x="7" y="13" width="3.5" height="3.5" rx="1" fill={S} />
    <rect x="13.5" y="13" width="3.5" height="3.5" rx="1" fill={B} opacity="0.8" />
  </Base>
);

export const MaintenanceIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M14.5 3.5a5 5 0 0 0-4.2 7.6L4 17.4V20h2.6l6.3-6.3a5 5 0 0 0 7.6-6.2l-3 2.2-2.6-.6-.6-2.6 2.2-3Z" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
  </Base>
);

export const ElectricityIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M13.5 2.5 5 13.5h5.5L9.5 21.5 19 10h-5.5l.5-7.5Z" stroke={S} strokeWidth="1.7" fill="#D9FA64" />
  </Base>
);

export const WaterIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z" stroke={B} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M9.3 13.8c0 1.5 1.1 2.6 2.6 2.6" stroke={B} strokeWidth="1.5" />
  </Base>
);

export const LaundryIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="2.5" width="16" height="19" rx="2.5" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <circle cx="12" cy="13" r="5" stroke={B} strokeWidth="1.7" fill="#fff" />
    <path d="M9.5 12.5c1.5 1.8 3.5 1.8 5 0" stroke={M} strokeWidth="1.55" />
    <circle cx="8" cy="6" r="1.2" fill={C} />
    <circle cx="12" cy="6" r="1.2" fill={S} />
  </Base>
);

export const SecurityIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 2.8 20 6v6c0 4.6-3.3 8-8 9.2C7.3 20 4 16.6 4 12V6l8-3.2Z" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" stroke={M} strokeWidth="2" />
  </Base>
);

export const AnnouncementIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 10.5v3a2 2 0 0 0 2 2h1.5L13 20V4L7.5 8.5H6a2 2 0 0 0-2 2Z" stroke={P} strokeWidth="1.7" fill="#CBE4FF" />
    <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" stroke={C} strokeWidth="1.55" />
  </Base>
);

export const CheckInIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5H14" stroke={P} strokeWidth="1.7" />
    <path d="M11 12h10M17.5 8.5 21 12l-3.5 3.5" stroke={M} strokeWidth="1.7" />
  </Base>
);

export const CheckOutIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M10 3.5h7.5A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5H10" stroke={P} strokeWidth="1.7" />
    <path d="M14 12H4M7.5 8.5 4 12l3.5 3.5" stroke={C} strokeWidth="1.7" />
  </Base>
);

export const SparkIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z" stroke={S} strokeWidth="1.55" fill="#D9FA64" />
    <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill={C} />
  </Base>
);

export const BuildingScene = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 320 220" className={className} fill="none" aria-hidden="true">
    <ellipse cx="160" cy="198" rx="128" ry="14" fill="#000" opacity="0.08" />
    <rect x="40" y="96" width="74" height="98" rx="10" fill="#ffffff" fillOpacity="0.22" stroke="#ffffff" strokeOpacity="0.5" />
    <rect x="124" y="56" width="92" height="138" rx="12" fill="#ffffff" fillOpacity="0.94" />
    <rect x="226" y="112" width="62" height="82" rx="10" fill="#ffffff" fillOpacity="0.3" stroke="#ffffff" strokeOpacity="0.45" />
    <rect x="124" y="56" width="92" height="14" rx="7" fill="#D9FA64" />
    <rect x="139" y="86" width="18" height="18" rx="4" fill="#CBE4FF" stroke="#5B5CE6" />
    <rect x="167" y="86" width="18" height="18" rx="4" fill="#CBE4FF" stroke="#5B5CE6" />
    <rect x="195" y="86" width="10" height="18" rx="4" fill="#CBE4FF" stroke="#5B5CE6" />
    <rect x="139" y="114" width="18" height="18" rx="4" fill="#CBE4FF" stroke="#5B5CE6" />
    <rect x="167" y="114" width="18" height="18" rx="4" fill="#CBE4FF" stroke="#4E65F6" />
    <rect x="139" y="142" width="46" height="52" rx="6" fill="#4E65F6" />
    <circle cx="176" cy="169" r="2.4" fill="#fff" />
    <rect x="54" y="116" width="16" height="14" rx="3" fill="#5B5CE6" fillOpacity="0.85" />
    <rect x="82" y="116" width="16" height="14" rx="3" fill="#D9FA64" fillOpacity="0.9" />
    <rect x="54" y="142" width="16" height="14" rx="3" fill="#5B5CE6" fillOpacity="0.85" />
    <rect x="82" y="142" width="16" height="14" rx="3" fill="#5B5CE6" fillOpacity="0.7" />
    <circle cx="255" cy="138" r="8" fill="#D9FA64" fillOpacity="0.9" />
    <circle cx="255" cy="162" r="8" fill="#CBE4FF" fillOpacity="0.9" />
    <circle cx="255" cy="186" r="8" fill="#5B5CE6" fillOpacity="0.9" />
    <path d="M232 194c0-10 7-16 16-16s16 6 16 16" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" />
    <circle cx="78" cy="74" r="16" fill="#D9FA64" fillOpacity="0.9" />
    <circle cx="78" cy="74" r="24" fill="#D9FA64" fillOpacity="0.25" />
    <path d="M12 194h296" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
  </svg>
);

export const LogoMark = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="12" fill="url(#pgGradient)" />
    <path d="M11 22.5 20 15l9 7.5V29a1.5 1.5 0 0 1-1.5 1.5H12.5A1.5 1.5 0 0 1 11 29v-6.5Z" fill="#fff" fillOpacity="0.95" />
    <path d="M17 30.5V24h6v6.5" fill="#4E65F6" />
    <circle cx="28.5" cy="12" r="4" fill="#D9FA64" />
    <defs>
      <linearGradient id="pgGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4E65F6" />
        <stop offset="1" stopColor="#5B5CE6" />
      </linearGradient>
    </defs>
  </svg>
);
