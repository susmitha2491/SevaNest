// Global popstate / history traversal tracker
let isPopStateActive = false;
let popStateResetTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    isPopStateActive = true;
    if (popStateResetTimer) clearTimeout(popStateResetTimer);
    popStateResetTimer = setTimeout(() => {
      isPopStateActive = false;
    }, 500);
  });
}

export function isPopStateNavigation(): boolean {
  return isPopStateActive;
}

export function triggerPopStateForTesting(): void {
  isPopStateActive = true;
  if (popStateResetTimer) clearTimeout(popStateResetTimer);
  popStateResetTimer = setTimeout(() => {
    isPopStateActive = false;
  }, 500);
}

