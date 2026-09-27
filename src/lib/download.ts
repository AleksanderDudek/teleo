/** Saves a blob as a file through a temporary object URL (works offline, no server). */
export function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Saves text as a file. */
export function downloadText(fileName: string, content: string, mimeType: string): void {
  download(new Blob([content], { type: mimeType }), fileName)
}
