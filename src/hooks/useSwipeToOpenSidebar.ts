import { useEffect, useRef, useCallback } from "react";

const EDGE_ZONE = 25; // px from left edge to start gesture
const SWIPE_THRESHOLD = 80; // px to commit open
const DIRECTION_LOCK_RATIO = 1.5; // horizontal must exceed vertical by this ratio

interface UseSwipeToOpenSidebarOptions {
  isMobile: boolean;
  isOpen: boolean;
  onOpen: () => void;
}

export function useSwipeToOpenSidebar({ isMobile, isOpen, onOpen }: UseSwipeToOpenSidebarOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || isOpen) return;
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_ZONE) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        isSwiping.current = true;
      }
    },
    [isMobile, isOpen],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX.current;
      const dy = Math.abs(touch.clientY - touchStartY.current);

      // Only trigger if horizontal movement dominates vertical
      if (dx > SWIPE_THRESHOLD && dx > dy * DIRECTION_LOCK_RATIO) {
        onOpen();
      }
    },
    [onOpen],
  );

  useEffect(() => {
    if (!isMobile) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, handleTouchStart, handleTouchEnd]);
}
