import { useEffect, useState } from "react";

/** Hash routing ("#/t/exams/abc") — works on static hosting with no server rewrites. */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => {
      setR(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}
export const go = (path: string) => {
  location.hash = path.startsWith("#") ? path : `#${path}`;
};
export const href = (path: string) => `#${path}`;
