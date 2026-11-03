import { useEffect, type RefObject } from 'react';

/** The key that leads to the search field, as on GitHub. */
export const SEARCH_KEY = '/';

interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
}

interface FocusedElement {
  readonly tagName: string;
  readonly isContentEditable: boolean;
}

/**
 * Whether a key press should move to the search field: a bare `/`, never while the
 * visitor is already typing somewhere, where the character belongs to what they write.
 */
export function isSearchShortcut(press: KeyPress, focused: FocusedElement | null): boolean {
  if (press.key !== SEARCH_KEY || press.defaultPrevented) {
    return false;
  }
  if (press.ctrlKey || press.metaKey || press.altKey) {
    return false;
  }
  if (focused === null) {
    return true;
  }
  return !focused.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName);
}

/** Focuses and selects the field when the visitor presses `/` anywhere else on the page. */
export function useSearchShortcut(field: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (field.current === null || !isSearchShortcut(event, focused)) {
        return;
      }
      event.preventDefault();
      field.current.focus();
      field.current.select();
    }
    document.addEventListener('keydown', onKeyDown);
    return (): void => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [field]);
}
