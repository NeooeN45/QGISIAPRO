import { useEffect, useState } from "react";

export interface ServerInfo {
  port: number;
  url: string;
  bridge_status: "connected" | "disconnected" | "error";
  timestamp: number;
}

export function useServerHealth() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;
    let pollDelay = 30000; // Start with 30s (exponential backoff on failure)
    const maxDelay = 120000; // Max 2 minutes
    const minDelay = 30000; // Min 30 seconds

    const fetchServerInfo = async () => {
      try {
        const response = await fetch("/api/qgis/serverInfo", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (mounted) {
          setServerInfo(data);
          setIsConnected(true);
          setError(null);
          setLastFetch(Date.now());
          // Reset backoff on success
          pollDelay = minDelay;
        }
      } catch (err) {
        if (mounted) {
          setIsConnected(false);
          setError(err instanceof Error ? err.message : "Connection failed");
          // Exponential backoff: double delay up to maxDelay
          pollDelay = Math.min(pollDelay * 2, maxDelay);
        }
      }
    };

    // Fetch immediately
    fetchServerInfo();

    // Schedule next poll with adaptive delay
    const scheduleNextPoll = () => {
      if (mounted) {
        interval = setTimeout(() => {
          fetchServerInfo();
          scheduleNextPoll(); // Reschedule with updated delay
        }, pollDelay);
      }
    };
    scheduleNextPoll();

    return () => {
      mounted = false;
      if (interval) clearTimeout(interval);
    };
  }, []);

  return {
    serverInfo,
    isConnected,
    error,
    lastFetch,
    port: serverInfo?.port,
    url: serverInfo?.url,
  };
}
