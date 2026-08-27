/* Minimal stroke icon set — one visual language (1.8px stroke, 24px grid)
   shared by every screen so the UI never mixes icon styles. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Svg = ({ children, size = 20, className = '', ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...base} {...rest}>
    {children}
  </svg>
);

export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M15.5 18.5h5L19 15.6a2.2 2.2 0 0 1-.65-1.55v-3a6.35 6.35 0 1 0-12.7 0v3c0 .58-.23 1.14-.64 1.55l-1.51 2.9h5m6.99 0v.9a2.95 2.95 0 1 1-5.9 0v-.9m5.91 0H9.09" />
  </Svg>
);

export const IconStar = ({ filled = false, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M11.05 3.7a1 1 0 0 1 1.9 0l1.52 4.67a1 1 0 0 0 .95.69h4.92a1 1 0 0 1 .58 1.81l-3.97 2.89a1 1 0 0 0-.37 1.12l1.52 4.67a1 1 0 0 1-1.54 1.12l-3.98-2.89a1 1 0 0 0-1.17 0l-3.98 2.89a1 1 0 0 1-1.53-1.12l1.51-4.67a1 1 0 0 0-.36-1.12L3.07 10.87A1 1 0 0 1 3.66 9.06h4.91a1 1 0 0 0 .95-.69L11.05 3.7Z" />
  </Svg>
);

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M15.5 16.5 19 13m0 0-3.5-3.5M19 13H9.5M13 5.5H7A2.5 2.5 0 0 0 4.5 8v8A2.5 2.5 0 0 0 7 18.5h6" />
  </Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconX = (p) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M4 12h16m0 0-6-6m6 6-6 6" />
  </Svg>
);

export const IconCheckCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </Svg>
);

export const IconSparkle = (p) => (
  <Svg {...p}>
    <path d="M12 4.5 13.8 9.7 19 11.5l-5.2 1.8L12 18.5l-1.8-5.2L5 11.5l5.2-1.8L12 4.5Z" />
    <path d="M19 3v3M17.5 4.5h3" />
  </Svg>
);

export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M6.8 3.5H9l1.5 4-2 1.5a11.5 11.5 0 0 0 4.5 4.5l1.5-2 4 1.5v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.8 5.7a2 2 0 0 1 2-2.2Z" />
  </Svg>
);

export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="m4.5 7 7.5 5.5L19.5 7" />
  </Svg>
);

export const IconPrinter = (p) => (
  <Svg {...p}>
    <path d="M7 9V4.5h10V9M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-4A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5v4a1.5 1.5 0 0 1-1.5 1.5H17" />
    <path d="M7 14h10v6H7zM18 12h.01" />
  </Svg>
);

export const IconMapPin = (p) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 1 1 13 0c0 4.8-6.5 10-6.5 10Z" />
    <circle cx="12" cy="10.5" r="2.2" />
  </Svg>
);
