import {
  Activity,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Cloud,
  Code,
  Download,
  Eye,
  Gauge,
  GitBranch,
  GitCompare,
  GitMerge,
  Hourglass,
  KeyRound,
  Lock,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Split,
  Star,
  Terminal,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useId, type JSX } from 'react';

import type { FeatureIcon } from './features.ts';

/** Lucide icons (ADR 0012), decorative: the text next to them carries the meaning. */
function icon(Component: LucideIcon): () => JSX.Element {
  return function Icon(): JSX.Element {
    return <Component className="icon" strokeWidth={1.75} aria-hidden="true" focusable="false" />;
  };
}

export const PulseIcon = icon(Activity);
export const BranchIcon = icon(GitBranch);
export const LockIcon = icon(Lock);
export const ClockIcon = icon(Clock);
export const StarIcon = icon(Star);
export const SearchIcon = icon(Search);
export const AlertIcon = icon(TriangleAlert);
export const ArrowIcon = icon(ArrowRight);
export const CheckIcon = icon(Check);
export const BookIcon = icon(BookOpen);
export const KeyIcon = icon(KeyRound);
export const CloudIcon = icon(Cloud);
export const ShieldIcon = icon(ShieldCheck);
export const RocketIcon = icon(Rocket);
export const CodeIcon = icon(Code);
export const UserIcon = icon(User);

const FEATURE_ICONS: Record<FeatureIcon, () => JSX.Element> = {
  branch: BranchIcon,
  clock: ClockIcon,
  lock: LockIcon,
  terminal: icon(Terminal),
  activity: PulseIcon,
  calendar: icon(Calendar),
  diverge: icon(Split),
  users: icon(Users),
  shield: icon(Shield),
  sparkle: icon(Sparkles),
  merge: icon(GitMerge),
  eye: icon(Eye),
  hourglass: icon(Hourglass),
  message: icon(MessageSquare),
  gauge: icon(Gauge),
  compare: icon(GitCompare),
  download: icon(Download),
};

export function FeatureIconView({ name }: { readonly name: FeatureIcon }): JSX.Element {
  const Icon = FEATURE_ICONS[name];
  return <Icon />;
}

/** Lucide no longer ships brand marks, so the GitHub mark stays drawn here. */
export function GitHubIcon(): JSX.Element {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  );
}

/** The heartbeat of the mark, which then forks into two branches. */
export const LOGO_PULSE = 'M5 18h5l2.5-7 3.5 12 2.5-8 2 3';
export const LOGO_BRANCHES = 'M20.5 18c2.6 0 3.4-6 6-6.5M20.5 18c2.6 0 3.4 5.6 6 6';

/**
 * The DevPulse mark: a heartbeat that splits into two Git branches, on a night tile.
 * Each instance gets its own gradient ids, since the header and the footer both draw it.
 */
export function Logo({ size = 32 }: { readonly size?: number }): JSX.Element {
  const id = useId();
  const tile = `${id}-tile`;
  const stroke = `${id}-stroke`;
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#172457" />
          <stop offset="1" stopColor="#0a0e27" />
        </linearGradient>
        <linearGradient id={stroke} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4c9aff" />
          <stop offset="1" stopColor="#5ef0b0" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill={`url(#${tile})`} stroke="#2b3670" />
      <path
        d={`${LOGO_PULSE}${LOGO_BRANCHES}`}
        fill="none"
        stroke={`url(#${stroke})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="18" r="1.7" fill="#4c9aff" />
      <circle cx="26.5" cy="11.5" r="1.9" fill="#5ef0b0" />
      <circle cx="26.5" cy="24" r="1.9" fill="#5ef0b0" />
    </svg>
  );
}
