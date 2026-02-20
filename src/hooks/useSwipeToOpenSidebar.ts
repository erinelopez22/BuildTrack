import { useEffect, useRef, useCallback } from "react";

const EDGE_ZONE = 28; // px from left edge to start gesture
const SWIPE_THRESHOLD_RATIO = 0.4; // 40% of screen width
const DIRECTION_LOCK_RATIO = 1.3; // horizontal must exceed vertical by this ratio
const TABLET_BREAKPOINT = 1024; // px
const DOUBLE_TAP_INTERVAL = 280; // ms max between taps
const DOUBLE_TAP_MAX_MOVE = 20; // px max movement between taps

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

  // Double-tap state
  const lastTapTime = useRef(0);
  const lastTapX = useRef(0);
  const lastTapY = useRef(0);
  const tapMoved = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobileOrTablet() || isOpen) return;
      const touch = e.touches[0];
      tapMoved.current = false;
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
      if (!isSwiping.current) {
        tapMoved.current = true;
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX.current;
      const dy = Math.abs(touch.clientY - touchStartY.current);

      // Lock direction after enough movement
      if (!directionLocked.current && (dx > 10 || dy > 10)) {
        directionLocked.current = true;
        isHorizontal.current = dx > dy * DIRECTION_LOCK_RATIO;
        tapMoved.current = true;
        if (!isHorizontal.current) {
          // Vertical scroll — abort
          isSwiping.current = false;
          return;
        }
      }

      // Prevent vertical scroll while swiping horizontally
      if (isHorizontal.current) {
        e.preventDefault();
        tapMoved.current = true;
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const touch = e.changedTouches[0];

      // --- Swipe detection ---
      if (isSwiping.current) {
        isSwiping.current = false;
        if (isHorizontal.current) {
          const dx = touch.clientX - touchStartX.current;
          const threshold = window.innerWidth * SWIPE_THRESHOLD_RATIO;
          if (dx > threshold) {
            onOpen();
            return;
          }
        }
      }

      // --- Double-tap detection (edge zone only, no swipe in progress) ---
      if (isOpen || tapMoved.current || touch.clientX > EDGE_ZONE) return;

      const now = Date.now();
      const dt = now - lastTapTime.current;
      const movedX = Math.abs(touch.clientX - lastTapX.current);
      const movedY = Math.abs(touch.clientY - lastTapY.current);

      if (dt < DOUBLE_TAP_INTERVAL && movedX < DOUBLE_TAP_MAX_MOVE && movedY < DOUBLE_TAP_MAX_MOVE) {
        // Double-tap confirmed
        onOpen();
        lastTapTime.current = 0; // reset so triple-tap doesn't re-fire
        return;
      }

      lastTapTime.current = now;
      lastTapX.current = touch.clientX;
      lastTapY.current = touch.clientY;
    },
    [onOpen, isOpen],
  );

  useEffect(() => {
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
