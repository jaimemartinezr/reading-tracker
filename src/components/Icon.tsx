import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'today'
  | 'library'
  | 'chart'
  | 'settings'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'edit'
  | 'close'
  | 'check'
  | 'sync'
  | 'cloud'
  | 'cloudOff'
  | 'flame'
  | 'download'
  | 'upload'
  | 'external'
  | 'chevron'
  | 'book'
  | 'alert'
  | 'calendar';

const SHAPES: Record<IconName, ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  library: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />,
  settings: (
    <>
      <path d="M4 6h9M18 6h2M4 12h4M12 12h8M4 18h9M18 18h2" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />,
  edit: (
    <>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  sync: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14 4l2-2" />
      <path d="M20 20v-5h-5" />
    </>
  ),
  cloud: (
    <path d="M17.5 19a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.2 9.2 4.5 4.5 0 0 0 6.5 19h11Z" />
  ),
  cloudOff: (
    <>
      <path d="M17.5 19a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.2 9.2 4.5 4.5 0 0 0 6.5 19h11Z" />
      <path d="M3 3l18 18" />
    </>
  ),
  flame: (
    <path d="M12 3c3.5 3.5 5 6.5 5 9.5A5 5 0 0 1 7 12.5c0-1.4.5-2.7 1.5-3.9.4 1.4 1 2.2 2 2.7.5-2.7 1-5.3 1.5-8.3Z" />
  ),
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />,
  upload: <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 20h14" />,
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  book: (
    <>
      <path d="M12 6.5C10.5 5 8.5 4 4 4v14c4.5 0 6.5 1 8 2.5 1.5-1.5 3.5-2.5 8-2.5V4c-4.5 0-6.5 1-8 2.5Z" />
      <path d="M12 6.5v14" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {SHAPES[name]}
    </svg>
  );
}
