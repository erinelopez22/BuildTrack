// Order status change notifications — REST polling (every 30s).
// Realtime/SignalR was removed for the Vercel serverless deployment.
import { useEffect, useRef } from 'react';
import { ordersApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const POLL_MS = 30_000;

interface OrderStatusUpdate {
  id: string;
  orderNumber: string;
  status: string;
  projectName?: string;
}

type OrderStatusCallback = (update: OrderStatusUpdate) => void;

export function useOrderStatusUpdates(onStatusChange: OrderStatusCallback) {
  const { user } = useAuth();
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;
  const lastStatus = useRef<Map<string, string>>(new Map());
  const primed = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const tick = async () => {
      const res = await ordersApi.getAll();
      if (cancelled || !res.success || !res.data) return;
      const seen = lastStatus.current;
      for (const o of res.data) {
        const prev = seen.get(o.id);
        if (primed.current && prev !== undefined && prev !== o.status) {
          callbackRef.current({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            projectName: o.projectName,
          });
        }
        seen.set(o.id, o.status);
      }
      primed.current = true;
    };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);
}
