/// <reference types="vite/client" />

interface QdnRequestFunction {
  <T = unknown>(request: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    qdnRequest?: QdnRequestFunction;
    _qdnBase?: string;
  }
}

export {};
