// Video Center — QDN file publication with Home source token
// Canonical reference: Discussion-Boards/src/services/qortium/qdnFilePublication.ts
// Large files (>2 MiB) use SELECT_QDN_PUBLISH_SOURCE → sourceToken → PUBLISH_QDN_RESOURCE
// Small files (≤2 MiB) use inline base64

import { requestQortium } from './qortiumClient.js';
import { fileToBase64 } from '../qdn/encoding.js';

// ── Constants ──────────────────────────────────────────────

/** Files up to 10 MiB can be published inline as base64.
 *  Raised from 2 MiB to cover common MVP test videos without requiring
 *  the source-token file picker (which confuses users who already
 *  selected a file in the browser). */
export const QDN_INLINE_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Qortium Home enforces a 100 MiB maximum for source-token publishes. */
export const QDN_HOME_SOURCE_MAX_BYTES = 100 * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────

export type QdnFileTransport = 'inline-base64' | 'home-source-token';

export type QdnFileResourceSpec = {
  service: string;
  name: string;
  identifier: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type QdnFilePublicationInput = {
  file: File;
  resource: QdnFileResourceSpec;
};

export type QdnSourceTokenResult = {
  sourceToken: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type QdnFilePublicationResult = {
  status: 'PUBLISHED';
  resource: QdnFileResourceSpec;
  transport: QdnFileTransport;
  transactionSignature?: string;
};

// ── Error types ────────────────────────────────────────────

export class QdnFilePublicationError extends Error {
  readonly code: 'USER_CANCELLED' | 'FILE_TOO_LARGE' | 'SOURCE_TOKEN_FAILED' | 'PUBLICATION_FAILED';

  constructor(code: QdnFilePublicationError['code'], detail: string) {
    super(`[${code}] ${detail}`);
    this.name = 'QdnFilePublicationError';
    this.code = code;
  }
}

// ── Helpers ────────────────────────────────────────────────

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isKnownCancellation = (error: unknown): boolean =>
  error instanceof Error && /cancel/i.test(error.message);

const selectSourceToken = async (kind: 'file' | 'directory'): Promise<QdnSourceTokenResult> => {
  const response = await requestQortium<unknown>({
    action: 'SELECT_QDN_PUBLISH_SOURCE',
    kind,
  });

  if (!isObject(response)) {
    throw new QdnFilePublicationError(
      'SOURCE_TOKEN_FAILED',
      'Home did not return a valid file selection.',
    );
  }

  if (response.canceled === true) {
    throw new QdnFilePublicationError(
      'USER_CANCELLED',
      'File selection was cancelled in Qortium Home.',
    );
  }

  if (
    typeof response.sourceToken !== 'string' ||
    !response.sourceToken.trim() ||
    typeof response.fileName !== 'string' ||
    typeof response.size !== 'number'
  ) {
    throw new QdnFilePublicationError(
      'SOURCE_TOKEN_FAILED',
      'Home did not return a valid source token.',
    );
  }

  return {
    sourceToken: response.sourceToken,
    filename: response.fileName,
    mimeType:
      typeof response.mimeType === 'string' ? response.mimeType : 'application/octet-stream',
    size: response.size,
  };
};

const publishWithSourceToken = async (
  resource: QdnFileResourceSpec,
  sourceToken: string,
): Promise<void> => {
  const response = await requestQortium<unknown>({
    action: 'PUBLISH_QDN_RESOURCE',
    service: resource.service,
    name: resource.name,
    identifier: resource.identifier,
    title: resource.filename,
    description: `${resource.mimeType} - ${resource.size} bytes`,
    filename: resource.filename,
    sourceToken,
  });

  if (isObject(response) && response.accepted === false) {
    throw new QdnFilePublicationError(
      'PUBLICATION_FAILED',
      'Home rejected the publication request.',
    );
  }
};

const publishInline = async (resource: QdnFileResourceSpec, data64: string): Promise<void> => {
  const response = await requestQortium<unknown>({
    action: 'PUBLISH_QDN_RESOURCE',
    service: resource.service,
    name: resource.name,
    identifier: resource.identifier,
    title: resource.filename,
    description: `${resource.mimeType} - ${resource.size} bytes`,
    filename: resource.filename,
    data64,
  });

  if (isObject(response) && response.accepted === false) {
    throw new QdnFilePublicationError(
      'PUBLICATION_FAILED',
      'Home rejected the publication request.',
    );
  }
};

// ── Main publish function ──────────────────────────────────

export const publishQdnFile = async (
  input: QdnFilePublicationInput,
): Promise<QdnFilePublicationResult> => {
  const { file, resource } = input;

  if (file.size > QDN_HOME_SOURCE_MAX_BYTES) {
    throw new QdnFilePublicationError(
      'FILE_TOO_LARGE',
      `File size ${(file.size / (1024 * 1024)).toFixed(1)} MiB exceeds the ${QDN_HOME_SOURCE_MAX_BYTES / (1024 * 1024)} MiB limit.`,
    );
  }

  // Determine transport: inline for small files, source token for large
  const transport: QdnFileTransport =
    file.size <= QDN_INLINE_FILE_MAX_BYTES ? 'inline-base64' : 'home-source-token';

  if (transport === 'inline-base64') {
    // Small files: encode to base64 and publish inline
    const data64 = await fileToBase64(file);
    await publishInline(resource, data64);
  } else {
    // Large files: ask Home to select the file, get a source token
    let sourceToken: string;
    try {
      const selection = await selectSourceToken('file');
      sourceToken = selection.sourceToken;

      // Verify the selected file matches
      if (selection.size !== file.size) {
        throw new QdnFilePublicationError(
          'SOURCE_TOKEN_FAILED',
          'The selected file size does not match the original.',
        );
      }
    } catch (error) {
      if (isKnownCancellation(error)) {
        throw new QdnFilePublicationError('USER_CANCELLED', 'File selection was cancelled.');
      }
      throw error;
    }

    await publishWithSourceToken(resource, sourceToken);
  }

  return {
    status: 'PUBLISHED',
    resource,
    transport,
  };
};

/** Convenience: publish multiple files, choosing the right transport for each. */
export const publishQdnFiles = async (
  files: QdnFilePublicationInput[],
): Promise<QdnFilePublicationResult[]> => {
  const results: QdnFilePublicationResult[] = [];

  for (const file of files) {
    results.push(await publishQdnFile(file));
  }

  return results;
};
