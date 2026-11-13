/**
 * Debounce lunar-name searches and discard cancelled or stale responses.
 * Coordinate navigation remains independent of provider availability.
 * @author Sultan
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { isMapLocation, type MapLocation } from "@/components/explorer/lunar-map-coordinates";

export type LunarSearchResult = MapLocation & { id: number };
type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "ready"; query: string; results: LunarSearchResult[] }
  | { status: "error"; query: string };

function isResult(value: unknown): value is LunarSearchResult {
  return isMapLocation(value) && "id" in value && typeof value.id === "number" && Number.isInteger(value.id) &&
    typeof value.name === "string";
}

export function useLunarSearch() {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function search(query: string) {
    cancel();
    const term = query.trim();
    if (term.length < 2 || /^[-+\d.\s,]+$/.test(term)) { setState({ status: "idle" }); return; }
    const controller = new AbortController();
    abort.current = controller;
    setState({ status: "loading", query: term });
    timer.current = setTimeout(() => {
      void fetch(`/api/lunar-locations?${new URLSearchParams({ q: term })}`, { signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error("Search unavailable");
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("results" in payload) ||
          !Array.isArray(payload.results) || !payload.results.every(isResult)) throw new Error("Invalid search results");
        if (!controller.signal.aborted) setState({ status: "ready", query: term, results: payload.results });
      }).catch(() => { if (!controller.signal.aborted) setState({ status: "error", query: term }); });
    }, 300);
  }

  function reset() { cancel(); setState({ status: "idle" }); }
  useEffect(() => () => {
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { state, search, reset };
}
