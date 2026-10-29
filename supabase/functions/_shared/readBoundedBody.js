export async function readBoundedBody(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('Invalid body limit');
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { return null; }
}
