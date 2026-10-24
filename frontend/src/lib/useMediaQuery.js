/**
 * FILE: frontend/src/lib/useMediaQuery.js
 *
 * A custom React hook: a function starting with "use" that calls other hooks,
 * so components can reuse stateful logic. It subscribes to a CSS media query
 * and re-renders the component when the query starts or stops matching
 * (e.g. on window resize or device rotation).
 *
 *   const isWide = useIsWide();
 *   return isWide ? <TaskTable/> : <TaskList/>;
 */
import { useEffect, useState } from "react";

/**
 * True while the media query matches. Used where desktop and mobile need
 * different *structure* (a table vs. a list), so only one of them is ever in
 * the DOM — hiding one with CSS would duplicate every row and every label.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  // Subscribe on mount (and if the query changes); the returned cleanup
  // unsubscribes so no listener outlives the component.
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tables are used from the `md` breakpoint (768px) up. */
export const useIsWide = () => useMediaQuery("(min-width: 768px)");
