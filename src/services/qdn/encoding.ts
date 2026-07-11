// Video Center — encoding utilities
// Canonical reference: qortium-blog/src/services/qdn/encoding.ts (VERIFIED-E2E)

export const encodeJsonToBase64 = (value: unknown) => {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export const parseJsonLike = <T = unknown>(raw: unknown): T => {
  if (typeof raw !== 'string') return raw as T;
  const trimmed = raw.trim();
  if (!trimmed) return null as unknown as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // attempt base64 decode
    try {
      const binary = atob(trimmed);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    } catch {
      return trimmed as unknown as T;
    }
  }
};

export const fileToBase64 = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};
