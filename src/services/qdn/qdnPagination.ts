// Video Center — QDN pagination for resource discovery
// Canonical reference: Discussion-Boards/src/services/qdn/qdnPagination.ts
// Uses LIST_QDN_RESOURCES instead of SEARCH_QDN_RESOURCES for index-free discovery.

import { requestQortium } from '../qortium/qortiumClient.js';
import type { SearchResultItem } from '../../types/video.js';

// ── Types ──────────────────────────────────────────────────

export type QdnDiscoveryCompleteness = 'complete' | 'partial' | 'unavailable';

export type QdnPaginationDiagnosticCode =
  | 'PAGINATION_INCOMPLETE'
  | 'PAGINATION_BUDGET_REACHED'
  | 'PAGINATION_LOOP_DETECTED'
  | 'PAGINATION_REQUEST_FAILED'
  | 'DUPLICATE_RESOURCE'
  | 'PARTIAL_DISCOVERY'
  | 'NAMESPACE_BUDGET_PRESSURE';

export type QdnPaginationDiagnostic = {
  code: QdnPaginationDiagnosticCode;
  detail: string;
  page?: number;
  offset?: number;
};

export type QdnPaginationStoppedReason =
  | 'exhausted'
  | 'page-budget'
  | 'resource-budget'
  | 'repeated-page'
  | 'request-failed'
  | 'malformed-response';

export type QdnDiscoveryResult<T> = {
  items: T[];
  completeness: QdnDiscoveryCompleteness;
  pagesFetched: number;
  resourcesSeen: number;
  stoppedReason: QdnPaginationStoppedReason;
  diagnostics: QdnPaginationDiagnostic[];
};

export type QdnPaginationBudget = {
  pageSize: number;
  maxPages: number;
  maxResources: number;
  maxRepeatedPages: number;
  retryCount: number;
  retryBackoffMs: number;
};

export const DEFAULT_QDN_PAGINATION_BUDGET: Readonly<QdnPaginationBudget> = {
  pageSize: 100,
  maxPages: 100,
  maxResources: 10_000,
  maxRepeatedPages: 1,
  retryCount: 2,
  retryBackoffMs: 150,
};

export type DiscoveredQdnResource = SearchResultItem;

// ── Budget normalisation ───────────────────────────────────

const sleep = async (durationMs: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const positiveInteger = (value: number, fallback: number) =>
  Number.isSafeInteger(value) && value > 0 ? value : fallback;

const normalizeBudget = (input?: Partial<QdnPaginationBudget>): QdnPaginationBudget => ({
  pageSize: positiveInteger(
    input?.pageSize ?? DEFAULT_QDN_PAGINATION_BUDGET.pageSize,
    DEFAULT_QDN_PAGINATION_BUDGET.pageSize,
  ),
  maxPages: positiveInteger(
    input?.maxPages ?? DEFAULT_QDN_PAGINATION_BUDGET.maxPages,
    DEFAULT_QDN_PAGINATION_BUDGET.maxPages,
  ),
  maxResources: positiveInteger(
    input?.maxResources ?? DEFAULT_QDN_PAGINATION_BUDGET.maxResources,
    DEFAULT_QDN_PAGINATION_BUDGET.maxResources,
  ),
  maxRepeatedPages: positiveInteger(
    input?.maxRepeatedPages ?? DEFAULT_QDN_PAGINATION_BUDGET.maxRepeatedPages,
    DEFAULT_QDN_PAGINATION_BUDGET.maxRepeatedPages,
  ),
  retryCount:
    Number.isSafeInteger(input?.retryCount) && (input?.retryCount ?? -1) >= 0
      ? (input?.retryCount ?? DEFAULT_QDN_PAGINATION_BUDGET.retryCount)
      : DEFAULT_QDN_PAGINATION_BUDGET.retryCount,
  retryBackoffMs:
    Number.isFinite(input?.retryBackoffMs) && (input?.retryBackoffMs ?? -1) >= 0
      ? (input?.retryBackoffMs ?? DEFAULT_QDN_PAGINATION_BUDGET.retryBackoffMs)
      : DEFAULT_QDN_PAGINATION_BUDGET.retryBackoffMs,
});

// ── Diagnostics helpers ────────────────────────────────────

const incompleteDiagnostics = (
  diagnostics: QdnPaginationDiagnostic[],
  detail: string,
): QdnPaginationDiagnostic[] => [
  ...diagnostics,
  { code: 'PAGINATION_INCOMPLETE' as const, detail },
  { code: 'PARTIAL_DISCOVERY' as const, detail },
];

// ── Resource keying and comparison ─────────────────────────

const resourceKey = (resource: DiscoveredQdnResource): string =>
  `${resource.service ?? ''}\u0000${resource.name.trim().toLowerCase()}\u0000${resource.identifier}`;

const effectiveResourceTime = (resource: DiscoveredQdnResource): number =>
  typeof resource.updated === 'number'
    ? resource.updated
    : typeof resource.created === 'number'
      ? resource.created
      : Number.MIN_SAFE_INTEGER;

export const compareDiscoveredQdnResources = (
  left: DiscoveredQdnResource,
  right: DiscoveredQdnResource,
): number => {
  const time = effectiveResourceTime(left) - effectiveResourceTime(right);
  if (time !== 0) return time;
  const sig = (left as Record<string, unknown>).latestSignature;
  const rightSig = (right as Record<string, unknown>).latestSignature;
  const signatureCmp = (typeof sig === 'string' ? sig : '').localeCompare(
    typeof rightSig === 'string' ? rightSig : '',
  );
  return signatureCmp || resourceKey(left).localeCompare(resourceKey(right));
};

const preferCurrentResource = (
  left: DiscoveredQdnResource,
  right: DiscoveredQdnResource,
): DiscoveredQdnResource => (compareDiscoveredQdnResources(left, right) >= 0 ? left : right);

// ── Core pagination engine ─────────────────────────────────

type PaginationOptions<T> = {
  requestPage: (input: { limit: number; offset: number; attempt: number }) => Promise<unknown>;
  keyOf: (item: T) => string;
  compareItems?: (left: T, right: T) => number;
  preferItem?: (left: T, right: T) => T;
  budget?: Partial<QdnPaginationBudget>;
  wait?: (durationMs: number) => Promise<void>;
};

export const paginateQdnResources = async <T>(
  options: PaginationOptions<T>,
): Promise<QdnDiscoveryResult<T>> => {
  const budget = normalizeBudget(options.budget);
  const wait = options.wait ?? sleep;
  const byKey = new Map<string, T>();
  const seenPageFingerprints = new Map<string, number>();
  const diagnostics: QdnPaginationDiagnostic[] = [];
  let pagesFetched = 0;
  let resourcesSeen = 0;

  for (let pageIndex = 0; pageIndex < budget.maxPages; pageIndex += 1) {
    const offset = pageIndex * budget.pageSize;
    let rawPage: unknown;
    let requestError: unknown;

    for (let attempt = 0; attempt <= budget.retryCount; attempt += 1) {
      try {
        rawPage = await options.requestPage({ limit: budget.pageSize, offset, attempt });
        requestError = undefined;
        break;
      } catch (error) {
        requestError = error;
        if (attempt < budget.retryCount && budget.retryBackoffMs > 0) {
          await wait(budget.retryBackoffMs * (attempt + 1));
        }
      }
    }

    if (requestError !== undefined) {
      const detail = `QDN page ${pageIndex + 1} at offset ${offset} failed after ${budget.retryCount + 1} attempt(s).`;
      const requestDiag: QdnPaginationDiagnostic = {
        code: 'PAGINATION_REQUEST_FAILED',
        detail,
        page: pageIndex + 1,
        offset,
      };
      return {
        items: [...byKey.values()].sort(options.compareItems),
        completeness: pagesFetched === 0 ? 'unavailable' : 'partial',
        pagesFetched,
        resourcesSeen,
        stoppedReason: 'request-failed',
        diagnostics:
          pagesFetched === 0
            ? [requestDiag]
            : incompleteDiagnostics([...diagnostics, requestDiag], detail),
      };
    }

    if (!Array.isArray(rawPage)) {
      const detail = `QDN page ${pageIndex + 1} returned a non-array response.`;
      const requestDiag: QdnPaginationDiagnostic = {
        code: 'PAGINATION_REQUEST_FAILED',
        detail,
        page: pageIndex + 1,
        offset,
      };
      return {
        items: [...byKey.values()].sort(options.compareItems),
        completeness: pagesFetched === 0 ? 'unavailable' : 'partial',
        pagesFetched,
        resourcesSeen,
        stoppedReason: 'malformed-response',
        diagnostics:
          pagesFetched === 0
            ? [requestDiag]
            : incompleteDiagnostics([...diagnostics, requestDiag], detail),
      };
    }

    const page = rawPage as T[];
    pagesFetched += 1;
    resourcesSeen += page.length;

    const sortedPage = [...page].sort(
      options.compareItems ??
        ((left, right) => options.keyOf(left).localeCompare(options.keyOf(right))),
    );
    const fingerprint = sortedPage.map(options.keyOf).join('\n');

    if (page.length > 0) {
      const repeated = (seenPageFingerprints.get(fingerprint) ?? 0) + 1;
      seenPageFingerprints.set(fingerprint, repeated);
      if (repeated > budget.maxRepeatedPages) {
        const detail = `QDN pagination repeated a prior page at offset ${offset}.`;
        return {
          items: [...byKey.values()].sort(options.compareItems),
          completeness: 'partial',
          pagesFetched,
          resourcesSeen,
          stoppedReason: 'repeated-page',
          diagnostics: incompleteDiagnostics(
            [
              ...diagnostics,
              { code: 'PAGINATION_LOOP_DETECTED', detail, page: pageIndex + 1, offset },
            ],
            detail,
          ),
        };
      }
    }

    for (const item of sortedPage) {
      const key = options.keyOf(item);
      const existing = byKey.get(key);
      if (existing !== undefined) {
        diagnostics.push({
          code: 'DUPLICATE_RESOURCE',
          detail: `Duplicate QDN resource ${key} was returned during pagination.`,
          page: pageIndex + 1,
          offset,
        });
        byKey.set(key, options.preferItem?.(existing, item) ?? existing);
        continue;
      }
      if (byKey.size >= budget.maxResources) {
        const detail = `QDN discovery reached its ${budget.maxResources}-resource safety budget.`;
        return {
          items: [...byKey.values()].sort(options.compareItems),
          completeness: 'partial',
          pagesFetched,
          resourcesSeen,
          stoppedReason: 'resource-budget',
          diagnostics: incompleteDiagnostics(
            [
              ...diagnostics,
              { code: 'PAGINATION_BUDGET_REACHED', detail },
              { code: 'NAMESPACE_BUDGET_PRESSURE', detail },
            ],
            detail,
          ),
        };
      }
      byKey.set(key, item);
    }

    if (page.length < budget.pageSize) {
      return {
        items: [...byKey.values()].sort(options.compareItems),
        completeness: 'complete',
        pagesFetched,
        resourcesSeen,
        stoppedReason: 'exhausted',
        diagnostics,
      };
    }
  }

  const detail = `QDN discovery reached its ${budget.maxPages}-page safety budget.`;
  return {
    items: [...byKey.values()].sort(options.compareItems),
    completeness: 'partial',
    pagesFetched,
    resourcesSeen,
    stoppedReason: 'page-budget',
    diagnostics: incompleteDiagnostics(
      [
        ...diagnostics,
        { code: 'PAGINATION_BUDGET_REACHED', detail },
        { code: 'NAMESPACE_BUDGET_PRESSURE', detail },
      ],
      detail,
    ),
  };
};

// ── Video Center discovery ─────────────────────────────────
// Uses SEARCH_QDN_RESOURCES with identifier prefix (proven pattern from Discussion Boards).
// The search index is maintained by Core and reliably returns all matching resources.
// LIST_QDN_RESOURCES (/arbitrary/resources) is less reliable for discovery.

export type QdnResourceFilter = {
  service: string;
  identifierPrefix?: string;
  name?: string;
  reverse?: boolean;
  includeMetadata?: boolean;
};

export const discoverVcQdnResources = (
  filter: QdnResourceFilter,
  budget?: Partial<QdnPaginationBudget>,
): Promise<QdnDiscoveryResult<DiscoveredQdnResource>> =>
  paginateQdnResources<DiscoveredQdnResource>({
    requestPage: ({ limit, offset }) =>
      requestQortium<unknown>({
        action: 'SEARCH_QDN_RESOURCES',
        service: filter.service,
        ...(filter.identifierPrefix
          ? { identifier: filter.identifierPrefix, prefix: true }
          : {}),
        ...(filter.name ? { name: filter.name, exactMatchNames: true } : {}),
        mode: 'ALL',
        limit,
        offset,
        reverse: filter.reverse ?? true,
        includeMetadata: filter.includeMetadata ?? true,
        includeStatus: true,
      }),
    keyOf: resourceKey,
    compareItems: compareDiscoveredQdnResources,
    preferItem: preferCurrentResource,
    budget,
  });

export const combineQdnDiscoveryResults = <T>(
  results: QdnDiscoveryResult<T>[],
  options: Pick<PaginationOptions<T>, 'keyOf' | 'compareItems' | 'preferItem'>,
): QdnDiscoveryResult<T> => {
  const byKey = new Map<string, T>();
  const diagnostics = results.flatMap((r) => r.diagnostics);

  for (const result of results) {
    for (const item of result.items) {
      const key = options.keyOf(item);
      const existing = byKey.get(key);
      byKey.set(
        key,
        existing === undefined ? item : (options.preferItem?.(existing, item) ?? existing),
      );
    }
  }

  const hasIncomplete = results.some((r) => r.completeness !== 'complete');
  const allUnavailable =
    results.length > 0 && results.every((r) => r.completeness === 'unavailable');
  const completeness =
    allUnavailable && byKey.size === 0 ? 'unavailable' : hasIncomplete ? 'partial' : 'complete';

  const combinedDiagnostics =
    completeness === 'partial' && !diagnostics.some((d) => d.code === 'PARTIAL_DISCOVERY')
      ? incompleteDiagnostics(
          diagnostics,
          'Combined discovery is incomplete across multiple search scopes.',
        )
      : diagnostics;

  return {
    items: [...byKey.values()].sort(options.compareItems),
    completeness,
    pagesFetched: results.reduce((sum, r) => sum + r.pagesFetched, 0),
    resourcesSeen: results.reduce((sum, r) => sum + r.resourcesSeen, 0),
    stoppedReason: hasIncomplete ? 'resource-budget' : 'exhausted',
    diagnostics: combinedDiagnostics,
  };
};
