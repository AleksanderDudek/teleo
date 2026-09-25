/** Bytes downloaded so far out of the (estimated) total of a model download. */
export interface DownloadProgress {
  loaded: number
  total: number
}

export interface ProgressAggregator {
  /** A file reported `loaded` of `total` bytes. */
  update(file: string, loaded: number, total?: number): DownloadProgress
  /** A file is complete (e.g. it came from the cache without byte events). */
  finish(file: string): DownloadProgress
  readonly current: DownloadProgress
}

/**
 * One progress bar for several files. The total starts from the expected sizes
 * (so the bar does not jump when the next file starts) and only grows when a
 * file turns out bigger; per-file progress never goes backwards.
 */
export function createProgressAggregator(expected: Readonly<Record<string, number>>): ProgressAggregator {
  const files = new Map<string, { loaded: number; total: number }>()
  for (const [file, bytes] of Object.entries(expected)) files.set(file, { loaded: 0, total: bytes })

  const snapshot = (): DownloadProgress => {
    let loaded = 0
    let total = 0
    for (const file of files.values()) {
      loaded += file.loaded
      total += file.total
    }
    return { loaded, total }
  }

  return {
    update(name, loaded, total = 0) {
      const file = files.get(name) ?? { loaded: 0, total: 0 }
      file.loaded = Math.max(file.loaded, loaded)
      file.total = Math.max(file.total, total, file.loaded)
      files.set(name, file)
      return snapshot()
    },
    finish(name) {
      const file = files.get(name) ?? { loaded: 0, total: 0 }
      file.loaded = file.total = Math.max(file.total, file.loaded)
      files.set(name, file)
      return snapshot()
    },
    get current() {
      return snapshot()
    },
  }
}

export function progressPercent({ loaded, total }: DownloadProgress): number {
  if (total <= 0) return 0
  return Math.min(100, Math.floor((loaded / total) * 100))
}
