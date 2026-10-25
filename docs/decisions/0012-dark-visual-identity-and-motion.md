# 0012. Adopt a dark visual identity with motion, icons and bundled fonts

- Status: accepted
- Date: 2026-10-25

## Context

The interface of ADR 0006 grew page by page on a light grey background with an
indigo-to-green gradient, identical cards and hand-drawn icons. It has no identity of
its own, reports appear at once and loading shows only a spinner. Visitors judge a tool
by how it looks before they trust its numbers (#57). The production content security
policy of ADR 0007 (`default-src 'self'`, no inline script or style) must stay as it is.

## Decision

- **Dark only:** a layered deep navy background (a faint grid and two slow blurred
  glows), navy surfaces with hairline borders, an electric blue accent, and mint, amber
  and coral for status. Text contrast is at least WCAG AA. The light theme is removed.
- **Motion:** `motion` (formerly Framer Motion) for the sliding tab indicator, reveals
  on scroll, bars and lines drawn on arrival and page fades. It is loaded through
  `LazyMotion`, whose `domAnimation` features come as a separate chunk after the first
  render, and `MotionConfig` follows the visitor's `prefers-reduced-motion`. Counted
  figures use a frame loop rather than Motion's `animate`, which would bring the engine
  into the initial bundle. It writes styles through the CSSOM
  and the Web Animations API, which the policy allows.
- **Icons:** `lucide-react`, imported icon by icon so that only the icons used are
  bundled. The DevPulse mark stays a hand-drawn SVG.
- **Fonts:** Space Grotesk for headings and Inter for text, as variable fonts from
  `@fontsource-variable`, bundled by Vite and served from the same origin. Figures use
  tabular numbers.
- **Charts:** still hand-written SVG; no chart library.

## Alternatives considered

- **Tailwind with shadcn/ui, Aceternity UI or Magic UI:** the generic look this change
  sets out to leave, and a rewrite of the stylesheet into new tooling and build steps.
- **GSAP:** heavier and imperative for animations that React components declare.
- **CSS only:** no layout animation for the tab indicator or exit transitions without
  much custom code.
- **Google Fonts:** blocked by the policy, and a request to a third party on every visit.
- **Keeping a light theme:** doubles the palette work and dilutes the identity.

## Consequences

- Four runtime dependencies: `motion`, `lucide-react`, `@fontsource-variable/inter` and
  `@fontsource-variable/space-grotesk`. The initial script grows from 104.8 to 124.9 kB
  gzipped, plus 14.5 kB of motion features fetched after the first render; the
  stylesheet from 7.2 to 9.1 kB. Browsers download only the font subsets a page uses.
- Under reduced motion nothing moves, draws or counts: transforms are left out, the
  heartbeat is drawn whole and CSS animations are removed; content may still fade in.
  If the motion features fail to load or take more than three seconds, the page shows
  every element in its final state. Tests do not depend on motion.
- Visitors who prefer a light page no longer have one.
- Extends ADR 0006; leaves ADR 0007's policy unchanged.
