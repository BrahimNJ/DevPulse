import type { JSX } from 'react';

/**
 * A report on its way: the shape of the page to come, shimmering, with the sentence
 * that says what is being read. The shapes are decorative; the sentence is the status.
 */
export function Loading({ label }: { readonly label: string }): JSX.Element {
  return (
    <div className="loading" role="status">
      <p className="loading-label">
        <span className="pulse-dot" aria-hidden="true" />
        {label}
      </p>
      <div className="skeleton" aria-hidden="true">
        <div className="skeleton-row">
          <span className="skeleton-block" />
          <span className="skeleton-block" />
          <span className="skeleton-block" />
          <span className="skeleton-block" />
        </div>
        <div className="skeleton-row skeleton-row-2">
          <span className="skeleton-block skeleton-tall" />
          <span className="skeleton-block skeleton-tall" />
        </div>
      </div>
    </div>
  );
}
