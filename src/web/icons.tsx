import type { JSX } from 'react';

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
