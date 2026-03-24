"use client";

import { useState, useRef, useCallback } from "react";
import type { AIAction } from "@/types/ai";

interface UseAIReturn<T = unknown> {
  trigger: (action: AIAction, payload: Record<string, unknown>, stream?: boolean) => Promise<T | string | null>;
  data: T | string | null;
  loading: boolean;
  streaming: boolean;
  streamText: string;
  error: string | null;
  abort: () => void;
  reset: () => void;
}

export function useAI<T = unknown>(): UseAIReturn<T> {
  const [data, setData] = useState<T | string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setStreamText("");
    setError(null);
    setLoading(false);
    setStreaming(false);
  }, []);

  const trigger = useCallback(
    async (action: AIAction, payload: Record<string, unknown>, stream = false): Promise<T | string | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      setError(null);
      setStreamText("");
      setData(null);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        if (stream && res.body) {
          setStreaming(true);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            setStreamText(accumulated);
          }

          setData(accumulated as unknown as T);
          setStreaming(false);
          setLoading(false);
          return accumulated as unknown as T;
        } else {
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          setData(json.data as T);
          setLoading(false);
          return json.data as T;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setLoading(false);
          return null;
        }
        const msg = err instanceof Error ? err.message : "AI request failed";
        setError(msg);
        setLoading(false);
        return null;
      }
    },
    []
  );

  return { trigger, data, loading, streaming, streamText, error, abort, reset };
}
