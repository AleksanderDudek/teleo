import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/test/db'
import { dismissInstallOffer, readSettings, updateMeta } from './settings'

beforeEach(resetDb)

describe('dismissInstallOffer', () => {
  it('counts each "Not now" in meta and keeps the rest of it', async () => {
    await updateMeta({ tourVersion: 1 })
    await dismissInstallOffer(1_000)
    await dismissInstallOffer(2_000)
    const { meta } = await readSettings()
    expect(meta.installOffer).toEqual({ dismissals: 2, lastDismissedAt: 2_000 })
    expect(meta.tourVersion).toBe(1)
  })
})
