export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'unsupported'

/** The share sheet can be closed by a gesture the browser never reports; don't wait for it forever. */
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))])

/**
 * The system share sheet first (it knows the apps on the phone), with the picture when files can be
 * shared; otherwise the text is copied. Cancelling the sheet is not an error.
 */
export async function systemShare({ text, title, url, file }: { text: string; title: string; url?: string; file?: File | null }): Promise<ShareResult> {
  const full = url ? `${text}\n${url}` : text
  if (navigator.share) {
    try {
      const payload = file && navigator.canShare?.({ files: [file] }) ? { files: [file], text: full } : { title, text, ...(url ? { url } : {}) }
      if (await withTimeout(navigator.share(payload).then(() => true), 20_000, false)) return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await withTimeout(navigator.clipboard.writeText(full), 3_000, undefined)
    return 'copied'
  } catch {
    return 'unsupported'
  }
}
