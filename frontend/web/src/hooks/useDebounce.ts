/**
 * hooks/useDebounce.ts
 * Generic debounce hook — delays updating the returned value until
 * the input has stopped changing for `delay` milliseconds.
 */

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}