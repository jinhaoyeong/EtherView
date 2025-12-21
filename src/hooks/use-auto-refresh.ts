"use client";

import { useEffect, useRef } from 'react';
import { useSettings } from './use-settings';

export function useAutoRefresh(
  refreshFn: () => Promise<void> | void, 
  isActive: boolean = true,
  defaultInterval: number = 60
) {
  const { settings } = useSettings();
  const savedCallback = useRef<(() => void) | undefined>(() => {});

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = refreshFn;
  }, [refreshFn]);

  // Determine effective interval
  const effectiveInterval = settings?.data.isCustomRefreshInterval 
    ? settings.data.refreshInterval 
    : defaultInterval;

  // Track if it's the initial mount to avoid double-fetching
  const isFirstRun = useRef(true);

  // Set up the interval
  useEffect(() => {
    // Only set interval if:
    // 1. Component is active
    // 2. Auto-refresh is enabled in settings
    // 3. We have a valid refresh interval (>= 10 seconds)
    if (
      isActive && 
      settings?.data.autoRefresh && 
      effectiveInterval >= 10
    ) {
      console.log(`⏱️ Auto-refresh enabled: ${effectiveInterval}s ${settings.data.isCustomRefreshInterval ? '(Custom)' : '(Default)'}`);
      
      const tick = () => {
        if (savedCallback.current) {
          console.log('⏱️ Triggering auto-refresh...');
          savedCallback.current();
        }
      };

      // If settings changed (and it's not the first run), trigger immediate refresh
      if (!isFirstRun.current) {
        console.log('⏱️ Settings changed, triggering immediate refresh...');
        tick();
      } else {
        isFirstRun.current = false;
      }

      const id = setInterval(tick, effectiveInterval * 1000);
      return () => clearInterval(id);
    }
  }, [isActive, settings?.data.autoRefresh, effectiveInterval, settings?.data.isCustomRefreshInterval]);
}
