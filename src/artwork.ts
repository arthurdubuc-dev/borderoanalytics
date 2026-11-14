export function resolveArtworkSource(
  fileId?: string | null,
  url?: string | null,
): string | null {
  if (
    fileId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      fileId,
    )
  )
    return "file:" + fileId;
  try {
    const parsed = new URL(url ?? "");
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
export function imageDataUri(bytes: ArrayBuffer, type: string): string {
  const data = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < data.length; i += 8192)
    binary += String.fromCharCode(...data.subarray(i, i + 8192));
  return `data:${type};base64,${btoa(binary)}`;
}
