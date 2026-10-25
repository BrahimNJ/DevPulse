import {
  LazyMotion,
  m,
  MotionConfig,
  useInView,
  useReducedMotion,
  type FeatureBundle,
  type Variants,
} from 'motion/react';
import { useLayoutEffect, useRef, type JSX, type ReactNode } from 'react';

/** `domAnimation`, fetched as its own chunk once the page has rendered. */
const loadFeatures = (): Promise<FeatureBundle> =>
  import('./motion-features.ts').then((module) => module.default);

/**
 * Motion for the whole interface (ADR 0012). `domAnimation` covers animations, gestures
 * and exits without layout projection, and `reducedMotion: 'user'` turns transforms off
 * for visitors who ask for less motion. Motion writes styles through the CSSOM, which the
 * production content security policy allows.
 */
export function MotionProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** The easing of every entrance: fast start, long settle. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const REVEAL: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const STAGGER: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08 } },
};

/** A block that rises into place the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number;
}): JSX.Element {
  return (
    <m.div
      className={className}
      variants={REVEAL}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay }}
    >
      {children}
    </m.div>
  );
}

/** A list whose items enter one after the other; pair with `RevealItem`. */
export function RevealList({
  children,
  className,
  ordered = false,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly ordered?: boolean;
  readonly label?: string;
}): JSX.Element {
  const List = ordered ? m.ol : m.ul;
  return (
    <List
      className={className}
      aria-label={label}
      variants={STAGGER}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.1 }}
    >
      {children}
    </List>
  );
}

export function RevealItem({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): JSX.Element {
  return (
    <m.li className={className} variants={REVEAL}>
      {children}
    </m.li>
  );
}

const COUNT_MS = 1100;

function easeOutQuart(progress: number): number {
  return 1 - (1 - progress) ** 4;
}

/**
 * A figure that counts up from zero when it first comes into view. React never owns the
 * animated text, which the effect writes; screen readers get the final value at once.
 */
export function CountUp({
  value,
  format,
}: {
  readonly value: number;
  readonly format: (value: number) => string;
}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion() === true;
  const animated = !reduced && value > 0;
  // Callers pass a new function on every render; only a new text (value or language)
  // restarts the count.
  const formatRef = useRef(format);
  formatRef.current = format;
  const text = format(value);

  // Before the first paint, so the final value never flashes before the count starts.
  useLayoutEffect(() => {
    const format = formatRef.current;
    const node = ref.current;
    if (node === null) {
      return;
    }
    if (!animated) {
      node.textContent = format(value);
      return;
    }
    if (!inView) {
      node.textContent = format(0);
      return;
    }
    // A frame loop rather than Motion's `animate`, which would pull its engine in early.
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now: number): void {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      const latest = value * easeOutQuart(progress);
      node.textContent = format(Number.isInteger(value) ? Math.round(latest) : latest);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    });
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [animated, inView, value, text]);

  return (
    <>
      <span ref={ref} aria-hidden="true" />
      <span className="visually-hidden">{text}</span>
    </>
  );
}
