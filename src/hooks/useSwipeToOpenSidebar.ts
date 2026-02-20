import { useEffect, useRef, useCallback } from "react";

const EDGE_ZONE = 28; // px from left edge to start gesture
const SWIPE_THRESHOLD_RATIO = 0.4; // 40% of screen width
const DIRECTION_LOCK_RATIO = 1.3; // horizontal must exceed vertical by this ratio
const TABLET_BREAKPOINT = 1024; // px

interface UseSwipeToOpenSidebarOptions {
  isMobile: boolean;
  isOpen: boolean;
  onOpen: () => void;
}

function isMobileOrTablet() {
  return window.innerWidth < TABLET_BREAKPOINT;
}

export function useSwipeToOpenSidebar({ isMobile, isOpen, onOpen }: UseSwipeToOpenSidebarOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const directionLocked = useRef(false);
  const isHorizontal = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobileOrTablet() || isOpen) return;
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_ZONE) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        isSwiping.current = true;
        directionLocked.current = false;
        isHorizontal.current = false;
      }
    },
    [isOpen],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isSwiping.current) return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX.current;
      const dy = Math.abs(touch.clientY - touchStartY.current);

      // Lock direction after enough movement
      if (!directionLocked.current && (dx > 10 || dy > 10)) {
        directionLocked.current = true;
        isHorizontal.current = dx > dy * DIRECTION_LOCK_RATIO;
        if (!isHorizontal.current) {
          // Vertical scroll — abort
          isSwiping.current = false;
          return;
        }
      }

      // Prevent vertical scroll while swiping horizontally
      if (isHorizontal.current) {
        e.preventDefault();
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      if (!isHorizontal.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX.current;
      const threshold = window.innerWidth * SWIPE_THRESHOLD_RATIO;

      if (dx > threshold) {
        onOpen();
      }
    },
    [onOpen],
  );

  useEffect(() => {
    // Listen on both mobile and tablet
    if (!isMobileOrTablet()) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}
