import { useEffect, useRef, useCallback } from 'react';
import { tokenStore } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const SIGNALR_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5069'}/hubs/notifications`;

interface OrderStatusUpdate {
  id: string;
  orderNumber: string;
  status: string;
  projectName?: string;
}

type OrderStatusCallback = (update: OrderStatusUpdate) => void;

export function useOrderStatusUpdates(onStatusChange: OrderStatusCallback) {
  const { user } = useAuth();
  const connectionRef = useRef<any>(null);
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    if (!user) return;

    import('@microsoft/signalr')
      .then(({ HubConnectionBuilder, LogLevel }) => {
        const token = tokenStore.getAccess();
        const connection = new HubConnectionBuilder()
          .withUrl(SIGNALR_URL, token ? { accessTokenFactory: () => token } : {})
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on('OrderStatusChanged', (update: OrderStatusUpdate) => {
          callbackRef.current(update);
        });

        connection.start().catch((err: any) =>
          console.warn('SignalR order updates connection failed:', err)
        );

        connectionRef.current = connection;
      })
      .catch(() => {
        // SignalR not available
      });

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop().catch(() => {});
        connectionRef.current = null;
      }
    };
  }, [user]);
}
