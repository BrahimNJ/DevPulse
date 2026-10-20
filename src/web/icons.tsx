import type { JSX } from 'react';

import type { FeatureIcon } from './features.ts';

function Icon({ path }: { readonly path: string }): JSX.Element {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export const PulseIcon = (): JSX.Element => <Icon path="M3 12h4l3-7 4 14 3-7h4" />;
export const BranchIcon = (): JSX.Element => (
  <Icon path="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9" />
);
export const LockIcon = (): JSX.Element => <Icon path="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" />;
export const ClockIcon = (): JSX.Element => (
  <Icon path="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
);
export const StarIcon = (): JSX.Element => (
  <Icon path="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
);
export const SearchIcon = (): JSX.Element => (
  <Icon path="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3" />
);
export const AlertIcon = (): JSX.Element => (
  <Icon path="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
);

const FEATURE_PATHS: Record<FeatureIcon, string> = {
  branch:
    'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  terminal: 'm4 17 6-5-6-5M12 19h8',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  calendar:
    'M3 9h18M7 3v4m10-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 8h2m4 0h2m-8 4h2m4 0h2',
  diverge: 'M6 3v18M6 9c0 4 12 2 12 9m-2-3 2 3 2-3',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6',
  merge: 'M6 3v18M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 6a9 9 0 0 0 9 9h0',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  hourglass: 'M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  gauge: 'M12 14l4-4M3.3 19a10 10 0 1 1 17.4 0',
  compare:
    'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
};

export function FeatureIconView({ name }: { readonly name: FeatureIcon }): JSX.Element {
  return <Icon path={FEATURE_PATHS[name]} />;
}

export const ArrowIcon = (): JSX.Element => <Icon path="M5 12h14m-6-6 6 6-6 6" />;
export const CheckIcon = (): JSX.Element => <Icon path="m5 12 5 5L20 7" />;
