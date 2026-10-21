import { useEffect, useState } from "react";
import { subscribe } from "./store";

/** Loads async data from the local store and reloads it whenever the store changes. */
export function useStore<T>(load: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => {
    let alive = true;
    const run = () => load().then((x) => alive && setV(x));
    run();
    const off = subscribe(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}
