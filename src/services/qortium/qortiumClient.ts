// Video Center — Qortium bridge client
// Canonical reference: qortium-blog/src/services/qortium/qortiumClient.ts (VERIFIED-E2E)
// Bridge: github-clones/qortium-home electron/qdn-app-preload.cts + src/platform.ts

import type { QortiumRequest } from '../../types/qortium';

const DEFAULT_NODE_API_URL = 'http://127.0.0.1:24891';

const getNodeApiUrl = () =>
  (import.meta.env.VITE_QORTIUM_NODE_API_URL || DEFAULT_NODE_API_URL).replace(/\/+$/, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeNodePath = (path: unknown) => {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Node API paths must start with /.');
  }
  if ([...path].some((character) => character.charCodeAt(0) < 32)) {
    throw new Error('Node API path contains invalid control characters.');
  }
  const url = new URL(path, DEFAULT_NODE_API_URL);
  return `${url.pathname}${url.search}`;
};

const sanitizeReadMethod = (method: unknown) => {
  const normalized =
    typeof method === 'string' && method.trim() ? method.trim().toUpperCase() : 'GET';
  if (normalized !== 'GET' && normalized !== 'HEAD') {
    throw new Error('Only GET and HEAD node API requests are supported in browser development.');
  }
  return normalized;
};

const appendQueryValue = (query: URLSearchParams, key: string, value: unknown) => {
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(query, key, item));
    return;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    query.append(key, String(value));
    return;
  }
  if (typeof value === 'string' && value.trim()) {
    query.append(key, value.trim());
  }
};

const buildQdnResourcesPath = (request: QortiumRequest, pathBase: string) => {
  const query = new URLSearchParams();
  const fields: Record<string, string> = {
    service: 'service',
    identifier: 'identifier',
    name: 'name',
    query: 'query',
    prefix: 'prefix',
    exactMatchNames: 'exactmatchnames',
    excludeBlocked: 'excludeblocked',
    includeMetadata: 'includemetadata',
    includeStatus: 'includestatus',
    limit: 'limit',
    offset: 'offset',
    reverse: 'reverse',
    mode: 'mode',
    default: 'default',
    description: 'description',
    title: 'title',
    names: 'name',
  };

  Object.entries(fields).forEach(([requestKey, queryKey]) => {
    appendQueryValue(query, queryKey, request[requestKey]);
  });

  const queryString = query.toString();
  return queryString ? `${pathBase}?${queryString}` : pathBase;
};

const fallbackQortiumRequest = async <T = unknown>(request: QortiumRequest): Promise<T> => {
  const action = typeof request.action === 'string' ? request.action.trim() : '';

  // Read-only node API fallback for browser development
  if (action === 'FETCH_NODE_API') {
    const path = sanitizeNodePath(request.path);
    const method = sanitizeReadMethod(request.method);
    const nodeUrl = `${getNodeApiUrl()}${path}`;
    const response = await fetch(nodeUrl, {
      method,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Node API error: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // SEARCH_QDN_RESOURCES and LIST_QDN_RESOURCES fallback
  if (action === 'SEARCH_QDN_RESOURCES' || action === 'LIST_QDN_RESOURCES') {
    const pathBase =
      action === 'SEARCH_QDN_RESOURCES'
        ? '/arbitrary/resources/search'
        : '/arbitrary/resources';
    const path = buildQdnResourcesPath(request, pathBase);
    const nodeUrl = `${getNodeApiUrl()}${path}`;
    const response = await fetch(nodeUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`QDN search error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  // FETCH_QDN_RESOURCE fallback
  if (action === 'FETCH_QDN_RESOURCE') {
    const service = typeof request.service === 'string' ? request.service.trim() : '';
    const name = typeof request.name === 'string' ? request.name.trim() : '';
    const identifier = typeof request.identifier === 'string' ? request.identifier.trim() : 'default';
    if (!service || !name) {
      throw new Error('FETCH_QDN_RESOURCE requires service and name.');
    }
    const path = `/arbitrary/${service}/${name}/${identifier}`;
    const nodeUrl = `${getNodeApiUrl()}${path}`;
    const response = await fetch(nodeUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`QDN fetch error: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // GET_QDN_RESOURCE_URL fallback
  if (action === 'GET_QDN_RESOURCE_URL') {
    const service = typeof request.service === 'string' ? request.service.trim() : '';
    const name = typeof request.name === 'string' ? request.name.trim() : '';
    const identifier = typeof request.identifier === 'string' ? request.identifier.trim() : 'default';
    if (!service || !name) {
      throw new Error('GET_QDN_RESOURCE_URL requires service and name.');
    }
    return `/arbitrary/${service}/${name}/${identifier}` as unknown as T;
  }

  throw new Error(
    `Action "${action}" is not available in browser development. Run inside Qortium Home for full bridge support.`,
  );
};

export const hasQortiumBridge = () =>
  typeof window !== 'undefined' && typeof window.qdnRequest === 'function';

export const requestQortium = async <T = unknown>(request: QortiumRequest): Promise<T> => {
  if (!isRecord(request) || typeof request.action !== 'string' || !request.action.trim()) {
    throw new Error('QDN requests must include an action.');
  }

  if (typeof window !== 'undefined' && typeof window.qdnRequest === 'function') {
    return window.qdnRequest<T>(request);
  }

  return fallbackQortiumRequest<T>(request);
};
