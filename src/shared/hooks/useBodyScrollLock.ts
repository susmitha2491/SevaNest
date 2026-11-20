import { useEffect } from 'react';
import { acquireBodyScrollLock, releaseBodyScrollLock } from '../utils/bodyScrollLock';

/**
 * Reusable React Hook for Reference-Counted Background Scroll Locking.
 *
 * Use this in any modal, dialog, drawer, or full-screen overlay component.
 * Automatically increments the global lock count when active, prevents background
 * interaction/scrolling, and decrements on unmount or when isLocked becomes false.
 *
 * @param isLocked Whether the modal is actively open (defaults to true).
 */
export function useBodyScrollLock(isLocked: boolean = true): void {
  useEffect(() => {
    if (!isLocked) return;

    acquireBodyScrollLock();

    return () => {
      releaseBodyScrollLock();
    };
  }, [isLocked]);
}

export { acquireBodyScrollLock, releaseBodyScrollLock, getBodyScrollLockCount, forceResetBodyScrollLock } from '../utils/bodyScrollLock';

