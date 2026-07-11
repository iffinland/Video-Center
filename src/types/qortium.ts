// Video Center — Qortium bridge types

export type QortiumRequest = {
  action: string;
  method?: string;
  path?: string;
  maxBytes?: number;
  [key: string]: unknown;
};

export type NodeApiFetchResult<T = unknown> = {
  body: string;
  contentLength?: number;
  contentType: string;
  data: T;
  ok: boolean;
  status: number;
  statusText: string;
};
