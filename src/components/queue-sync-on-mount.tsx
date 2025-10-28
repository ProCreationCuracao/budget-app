"use client";

import { useEffect } from "react";
import { useSyncStatus } from "@/lib/offline-queue";

export default function QueueSyncOnMount() {
  const { processQueue } = useSyncStatus();
  useEffect(() => {
    processQueue();
    const id = setInterval(() => processQueue(), 15000);
    return () => clearInterval(id);
  }, [processQueue]);
  return null;
}
