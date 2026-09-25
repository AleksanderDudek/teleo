import type { CacheLike, CacheStorageLike } from '@/domain/speech/whisper/cache'

const absolute = (url: string) => new URL(url, 'https://teleo.test/').href

/** In-memory Cache Storage (unit tests). Keys are resolved like the real API resolves request strings. */
export class FakeCache implements CacheLike {
  readonly entries = new Map<string, Response>()

  async match(request: string): Promise<Response | undefined> {
    return this.entries.get(absolute(request))?.clone()
  }

  async put(request: string, response: Response): Promise<void> {
    this.entries.set(absolute(request), response)
  }

  async delete(request: string): Promise<boolean> {
    return this.entries.delete(absolute(request))
  }

  async keys(): Promise<Array<{ url: string }>> {
    return [...this.entries.keys()].map((url) => ({ url }))
  }

  /** Test helper: store a body of `bytes` zeros under `url`. */
  seed(url: string, bytes = 1) {
    this.entries.set(absolute(url), new Response(new Uint8Array(bytes)))
    return this
  }
}

export class FakeCacheStorage implements CacheStorageLike {
  readonly caches = new Map<string, FakeCache>()

  async has(name: string): Promise<boolean> {
    return this.caches.has(name)
  }

  async open(name: string): Promise<FakeCache> {
    let cache = this.caches.get(name)
    if (!cache) {
      cache = new FakeCache()
      this.caches.set(name, cache)
    }
    return cache
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name)
  }

  /** Synchronous access for assertions and seeding. */
  cache(name: string): FakeCache {
    let cache = this.caches.get(name)
    if (!cache) {
      cache = new FakeCache()
      this.caches.set(name, cache)
    }
    return cache
  }
}
