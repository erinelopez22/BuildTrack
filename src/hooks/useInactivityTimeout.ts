import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, tokenStore } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'click',
  'keydown',
  'scroll',
  'touchstart',
  'touchmove',
] as const;

export function useInactivityTimeout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(async () => {
    await authApi.logout();
    tokenStore.clear();
    queryClient.clear();
    toast({
      title: 'Session expired',
      description: 'Session expired due to inactivity.',
      variant: 'destructive',
    });
    navigate('/login', { replace: true });
  }, [navigate, toast, queryClient]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleTimeout, INACTIVITY_TIMEOUT);
  }, [handleTimeout]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handler, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handler);
      });
    };
  }, [resetTimer]);
}
