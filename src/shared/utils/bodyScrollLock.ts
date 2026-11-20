/* global HTMLElement, WheelEvent, TouchEvent, KeyboardEvent */
/**
 * Global Reference-Counted Body Scroll Lock Manager
 *
 * Enforces strict scroll containment across the entire SevaNest Admin Portal:
 * 1. Locks background document scrolling on both body and documentElement.
 * 2. Reference-counts active locks so nested modals do not prematurely unlock scrolling.
 * 3. Prevents background wheel, touchpad, touchmove, and keyboard scrolling while allowing
 *    smooth scrolling inside the modal's internal scrollable body.
 * 4. Stops scroll chaining at modal boundaries.
 * 5. Compensates for scrollbar width to prevent horizontal page layout shifts.
 * 6. Preserves and restores original scroll positions upon closing all dialogs.
 * 7. Safely resets on route changes so pages are never permanently locked.
 */

interface SavedState {
  bodyOverflow: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
  scrollX: number;
  scrollY: number;
}

let lockCount = 0;
let savedState: SavedState | null = null;
let touchStartY = 0;
let touchStartX = 0;

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

/**
 * Checks whether an element or any of its ancestors up to document.body is scrollable.
 */
function findScrollableAncestor(
  target: HTMLElement | null,
  isVertical: boolean
): { element: HTMLElement; isScrollable: boolean } | null {
  let el = target;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const overflowVal = isVertical ? style.overflowY : style.overflowX;
    const canScroll = overflowVal === 'auto' || overflowVal === 'scroll';
    const hasScrollSpace = isVertical
      ? el.scrollHeight > el.clientHeight
      : el.scrollWidth > el.clientWidth;

    if (canScroll && hasScrollSpace) {
      return { element: el, isScrollable: true };
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Prevents wheel scrolling outside of scrollable modal containers and prevents scroll chaining at boundaries.
 */
function handleGlobalWheel(e: WheelEvent): void {
  if (lockCount <= 0) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const scrollInfo = findScrollableAncestor(target, true);

  if (!scrollInfo || !scrollInfo.isScrollable) {
    // Wheel happened on backdrop, modal header, footer, or static area -> block it completely
    e.preventDefault();
    return;
  }

  // Inside a scrollable container: prevent scroll chaining when reaching boundaries
  const { element } = scrollInfo;
  const deltaY = e.deltaY;
  const isAtTop = element.scrollTop <= 0 && deltaY < 0;
  const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1 && deltaY > 0;

  if (isAtTop || isAtBottom) {
    e.preventDefault();
  }
}

/**
 * Records touch start coordinate to determine scroll direction on touchmove.
 */
function handleGlobalTouchStart(e: TouchEvent): void {
  if (e.touches.length > 0) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }
}

/**
 * Prevents touchmove scrolling outside of scrollable modal containers and stops chaining at boundaries.
 */
function handleGlobalTouchMove(e: TouchEvent): void {
  if (lockCount <= 0) return;
  const target = e.target as HTMLElement | null;
  if (!target || e.touches.length === 0) return;

  const currentY = e.touches[0].clientY;
  const currentX = e.touches[0].clientX;
  const deltaY = touchStartY - currentY;
  const deltaX = touchStartX - currentX;

  const isVertical = Math.abs(deltaY) >= Math.abs(deltaX);
  const scrollInfo = findScrollableAncestor(target, isVertical);

  if (!scrollInfo || !scrollInfo.isScrollable) {
    e.preventDefault();
    return;
  }

  const { element } = scrollInfo;
  if (isVertical) {
    const isAtTop = element.scrollTop <= 0 && deltaY < 0;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1 && deltaY > 0;
    if (isAtTop || isAtBottom) {
      e.preventDefault();
    }
  } else {
    const isAtLeft = element.scrollLeft <= 0 && deltaX < 0;
    const isAtRight = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 && deltaX > 0;
    if (isAtLeft || isAtRight) {
      e.preventDefault();
    }
  }
}

/**
 * Prevents keyboard scrolling keys when focus is on non-editable elements outside scrollable containers.
 */
function handleGlobalKeyDown(e: KeyboardEvent): void {
  if (lockCount <= 0) return;
  if (!SCROLL_KEYS.has(e.key)) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Let form inputs and editable controls handle their own keys
  const tagName = target.tagName ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
    return;
  }

  const scrollInfo = findScrollableAncestor(target, true);
  if (!scrollInfo || !scrollInfo.isScrollable) {
    e.preventDefault();
  }
}

/**
 * Acquires a scroll lock. Increments the reference count and locks the background on the first acquisition.
 */
export function acquireBodyScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount === 0) {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;

    // Calculate scrollbar width for compensation
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    savedState = {
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
      scrollX,
      scrollY,
    };

    if (scrollBarWidth > 0) {
      const existingPadding = parseFloat(window.getComputedStyle(document.body).paddingRight || '0') || 0;
      document.body.style.paddingRight = `${existingPadding + scrollBarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-scroll-locked');

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    window.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('keydown', handleGlobalKeyDown, { passive: false });
  }

  lockCount++;
}

/**
 * Releases a scroll lock. Decrements reference count and restores background scrolling when count drops to zero.
 */
export function releaseBodyScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (lockCount <= 0) return;

  lockCount--;

  if (lockCount === 0 && savedState) {
    window.removeEventListener('wheel', handleGlobalWheel);
    window.removeEventListener('touchstart', handleGlobalTouchStart);
    window.removeEventListener('touchmove', handleGlobalTouchMove);
    window.removeEventListener('keydown', handleGlobalKeyDown);

    document.body.style.overflow = savedState.bodyOverflow;
    document.body.style.paddingRight = savedState.bodyPaddingRight;
    document.documentElement.style.overflow = savedState.htmlOverflow;
    document.body.classList.remove('modal-scroll-locked');

    const { scrollX, scrollY } = savedState;
    savedState = null;

    const isMock = typeof window.scrollTo === 'function' && 'mock' in (window.scrollTo as unknown as Record<string, unknown>);
    const isJsdom = typeof navigator !== 'undefined' && Boolean(navigator.userAgent && navigator.userAgent.includes('jsdom'));

    if (isMock || (!isJsdom && typeof window.scrollTo === 'function')) {
      try {
        window.scrollTo(scrollX, scrollY);
      } catch {
        document.documentElement.scrollTop = scrollY;
        document.body.scrollTop = scrollY;
      }
    } else {
      document.documentElement.scrollTop = scrollY;
      document.body.scrollTop = scrollY;
    }
  }
}

/**
 * Returns current reference count (for test assertion and diagnostic reporting).
 */
export function getBodyScrollLockCount(): number {
  return lockCount;
}

/**
 * Force resets all locks and restores original page state (e.g., on full route transitions or test teardown).
 */
export function forceResetBodyScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.removeEventListener('wheel', handleGlobalWheel);
  window.removeEventListener('touchstart', handleGlobalTouchStart);
  window.removeEventListener('touchmove', handleGlobalTouchMove);
  window.removeEventListener('keydown', handleGlobalKeyDown);

  if (savedState) {
    document.body.style.overflow = savedState.bodyOverflow;
    document.body.style.paddingRight = savedState.bodyPaddingRight;
    document.documentElement.style.overflow = savedState.htmlOverflow;
    savedState = null;
  } else {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.documentElement.style.overflow = '';
  }

  document.body.classList.remove('modal-scroll-locked');
  lockCount = 0;
}

// Automatically reset on browser back/forward route changes
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (lockCount > 0) {
      forceResetBodyScrollLock();
    }
  });
}
