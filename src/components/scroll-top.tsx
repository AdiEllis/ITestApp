"use client";
import { useEffect } from "react";

/** Brings a just-shown notice into view (a redirect can keep the previous page's scroll position). */
export function ScrollTop() {
  useEffect(() => window.scrollTo(0, 0), []);
  return null;
}
