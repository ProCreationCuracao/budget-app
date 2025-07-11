import React, { createContext, useContext, useState } from 'react';

const DateFilterContext = createContext();

/**
 * Wrap any subtree that needs date‐filtering hooks in this provider.
 */
export function DateFilterProvider({ children }) {
  // you can expand this state to include start/end dates, presets, etc.
  const [filter, setFilter] = useState('monthly');

  return (
    <DateFilterContext.Provider value={{ filter, setFilter }}>
      {children}
    </DateFilterContext.Provider>
  );
}

/**
 * Hook to consume date‐filter state.
 * Must be used inside <DateFilterProvider>.
 */
export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) {
    throw new Error('useDateFilter must be used inside a <DateFilterProvider>');
  }
  return ctx;
}
