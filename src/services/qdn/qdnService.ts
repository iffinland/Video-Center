// Video Center — QDN service operations
// Canonical reference: qortium-blog/src/services/qdn/qdnService.ts (VERIFIED-E2E)

import type { QdnResourceRef, QdnResourceStatus, SearchResultItem } from '../../types/video';
import { requestQortium } from '../qortium/qortiumClient';
import { encodeJsonToBase64, fileToBase64, parseJsonLike } from './encoding';

const sleep = async (durationMs: number) => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
};

export const searchResources = async (params: {
  service: string;
  identifier?: string;
  name?: string;
  names?: string[];
  query?: string;
  prefix?: boolean;
  exactMatchNames?: boolean;
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
}): Promise<SearchResultItem[]> => {
  // NOTE: SEARCH_QDN_RESOURCES uses a separate index from FETCH_QDN_RESOURCE.
  // Newly published resources may take several minutes to appear in search results.
  // Direct fetch via FETCH_QDN_RESOURCE is immediate after waitForResourceReady confirms READY.
  const response = await requestQortium<unknown>({
    action: 'SEARCH_QDN_RESOURCES',
    mode: 'LATEST',
    reverse: true,
    excludeBlocked: true,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    includeMetadata: params.includeMetadata ?? true,
    ...params,
  });

  return Array.isArray(response) ? (response as SearchResultItem[]) : [];
};

// LIST_QDN_RESOURCES — does NOT use the search index, returns all resources for a service.
// More reliable for recently published content, but can be slow for large result sets.
// Used as fallback when SEARCH_QDN_RESOURCES returns empty.
export const listResources = async (params: {
  service: string;
  name?: string;
  identifier?: string;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  includeMetadata?: boolean;
}): Promise<SearchResultItem[]> => {
  const response = await requestQortium<unknown>({
    action: 'LIST_QDN_RESOURCES',
    service: params.service,
    name: params.name,
    identifier: params.identifier,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
    reverse: params.reverse ?? true,
    includeMetadata: params.includeMetadata ?? true,
    excludeBlocked: true,
  });

  return Array.isArray(response) ? (response as SearchResultItem[]) : [];
};

export const fetchJsonResource = async <T>(
  service: string,
  name: string,
  identifier: string,
): Promise<T> => {
  const raw = await requestQortium<unknown>({
    action: 'FETCH_QDN_RESOURCE',
    service,
    name,
    identifier,
  });
  return parseJsonLike<T>(raw);
};

export const getResourceStatus = async (
  service: string,
  name: string,
  identifier: string,
): Promise<QdnResourceStatus> => {
  const status = await requestQortium<unknown>({
    action: 'GET_QDN_RESOURCE_STATUS',
    service,
    name,
    identifier,
  });

  if (typeof status === 'string') return { status: status.toUpperCase(), description: status };
  if (!status || typeof status !== 'object') return { status: 'UNKNOWN' };
  const record = status as Record<string, unknown>;
  return {
    status: typeof record.status === 'string' ? record.status.toUpperCase() : 'UNKNOWN',
    description: typeof record.description === 'string' ? record.description : undefined,
    localChunkCount:
      typeof record.localChunkCount === 'number' ? record.localChunkCount : undefined,
    totalChunkCount:
      typeof record.totalChunkCount === 'number' ? record.totalChunkCount : undefined,
    percentLoaded: typeof record.percentLoaded === 'number' ? record.percentLoaded : undefined,
  };
};

export const getQdnResourceUrl = async (ref: QdnResourceRef): Promise<string> => {
  const value = await requestQortium<unknown>({
    action: 'GET_QDN_RESOURCE_URL',
    service: ref.service,
    name: ref.name,
    identifier: ref.identifier,
    filename: ref.filename,
  });
  return typeof value === 'string' ? value : '';
};

export const waitForResourceReady = async (
  service: string,
  name: string,
  identifier: string,
  timeoutMs = 45_000,
): Promise<QdnResourceStatus> => {
  const startedAt = Date.now();
  let latest: QdnResourceStatus = { status: 'UNKNOWN' };
  let buildRequested = false;

  while (Date.now() - startedAt < timeoutMs) {
    latest = await getResourceStatus(
      service,
      name,
      identifier,
    );

    if (!buildRequested) {
      // Request build on first poll
      await requestQortium<unknown>({
        action: 'GET_QDN_RESOURCE_STATUS',
        service,
        name,
        identifier,
        build: true,
      });
      buildRequested = true;
    }

    if (latest.status === 'READY' || latest.status === 'NOT_PUBLISHED') return latest;
    await sleep(1500);
  }

  return latest;
};

// ── Publishing ──────────────────────────────────────────────
// Canonical reference: qortium-blog/src/services/qdn/qdnService.ts (VERIFIED-E2E)

export type QdnResourceToPublish =
  | {
      service: string;
      name: string;
      identifier: string;
      title?: string;
      description?: string;
      tags?: string[];
      filename?: string;
      data64: string;
    }
  | {
      service: string;
      name: string;
      identifier: string;
      title?: string;
      description?: string;
      tags?: string[];
      filename?: string;
      file: File;
    };

const isStagingError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('directory') ||
    message.includes('staging') ||
    message.includes('dataexception')
  );
};

const withPublishRetry = async <T>(publish: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await publish();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isStagingError(error)) {
        await sleep(2000 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
};

const normalizeResourceForPublish = async (
  resource: QdnResourceToPublish,
): Promise<QdnResourceToPublish> => {
  if ('data64' in resource && resource.data64) return resource;
  if ('file' in resource && resource.file) {
    const { file, ...rest } = resource as { file: File } & QdnResourceToPublish;
    return { ...rest, data64: await fileToBase64(file) };
  }
  return resource;
};

const parseMultiResourcePublishError = (response: unknown): string | null => {
  if (!Array.isArray(response)) return null;
  const failedIndex = response.findIndex((item) => {
    if (item === null || item === undefined) return true;
    if (typeof item === 'string') {
      const trimmed = item.trim().toLowerCase();
      return !trimmed || trimmed === 'false' || trimmed.startsWith('error');
    }
    if (typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return record.error === true || record.success === false;
  });
  if (failedIndex === -1) return null;
  const failed = response[failedIndex];
  const message =
    typeof failed === 'object' && failed !== null
      ? ((failed as Record<string, unknown>).message ?? (failed as Record<string, unknown>).error)
      : failed;
  return typeof message === 'string' && message.trim()
    ? `Qortium resource publish failed at item ${failedIndex + 1}: ${message}`
    : `Qortium resource publish failed at item ${failedIndex + 1}.`;
};

export const publishMultipleQdnResources = async (resources: QdnResourceToPublish[]) => {
  if (resources.length === 0) return [];
  const normalized = await Promise.all(resources.map(normalizeResourceForPublish));

  return withPublishRetry(async () => {
    const response = await requestQortium<unknown>({
      action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
      resources: normalized,
    });
    const publishError = parseMultiResourcePublishError(response);
    if (publishError) throw new Error(publishError);
    return response;
  });
};

export const publishJsonResource = async ({
  service,
  name,
  identifier,
  payload,
  title,
  description,
  tags,
  filename = 'data.json',
}: {
  service: string;
  name: string;
  identifier: string;
  payload: unknown;
  title?: string;
  description?: string;
  tags?: string[];
  filename?: string;
}) => {
  const tagFields = (tags ?? [])
    .slice(0, 5)
    .reduce<Record<string, string>>((fields, tag, index) => {
      fields[`tag${index + 1}`] = tag;
      return fields;
    }, {});

  await withPublishRetry(() =>
    requestQortium({
      action: 'PUBLISH_QDN_RESOURCE',
      service,
      name,
      identifier,
      data64: encodeJsonToBase64(payload),
      filename,
      title,
      description,
      ...tagFields,
    }),
  );

  await waitForResourceReady(service, name, identifier);
};

export const verifyJsonResource = async <T>(
  service: string,
  name: string,
  identifier: string,
  verify?: (value: unknown) => boolean,
  retries = 5,
): Promise<T> => {
  let latestError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const value = await fetchJsonResource<T>(service, name, identifier);
      if (!verify || verify(value)) return value;
      latestError = new Error('Published resource did not match the expected schema.');
    } catch (error) {
      latestError = error;
    }

    if (attempt < retries) await sleep(1200 * attempt);
  }

  throw latestError instanceof Error
    ? latestError
    : new Error('Published resource could not be verified.');
};
