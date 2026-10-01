import { describe, expect, it } from 'vitest'
import { BackupCryptoError, BACKUP_KDF_ITERATIONS, decryptBackup, encryptBackup, readBackupText } from './crypto'
import { createBackupFile, type BackupData } from './validate'

const data = (): BackupData => ({
  texts: [],
  segments: [],
  sessionTemplates: [],
  sessionRuns: [],
  attempts: [],
  dailyStats: [],
  textStats: [],
  achievements: [],
  xpLedger: [{ timestamp: 1, dayKey: '2026-09-30', reason: 'segment', amount: 12 }],
  settings: [],
  bibleReadings: [],
  friends: [],
})

const FAST = { iterations: 1_000 }

describe('encryptBackup / decryptBackup', () => {
  it('round-trips a backup with the right password and keeps the date and version readable', async () => {
    const file = { ...createBackupFile(data(), 1_700_000_000_000), appVersion: '1.2.0' }
    const envelope = await encryptBackup(file, 'zdrowaś maryjo', FAST)
    expect(envelope).toMatchObject({ app: 'teleo', schemaVersion: 1, exportedAt: 1_700_000_000_000, appVersion: '1.2.0' })
    expect(envelope.encrypted).toMatchObject({ v: 1, kdf: 'PBKDF2-SHA-256', cipher: 'AES-256-GCM', iterations: 1_000 })
    expect(JSON.stringify(envelope)).not.toContain('segment')
    expect(JSON.parse(await decryptBackup(envelope, 'zdrowaś maryjo'))).toEqual(file)
  })

  it('uses a fresh salt and nonce every time', async () => {
    const file = createBackupFile(data(), 1)
    const a = await encryptBackup(file, 'secret', FAST)
    const b = await encryptBackup(file, 'secret', FAST)
    expect(a.encrypted.salt).not.toBe(b.encrypted.salt)
    expect(a.encrypted.iv).not.toBe(b.encrypted.iv)
    expect(a.encrypted.data).not.toBe(b.encrypted.data)
  })

  it('refuses a wrong password', async () => {
    const envelope = await encryptBackup(createBackupFile(data(), 1), 'right one', FAST)
    await expect(decryptBackup(envelope, 'wrong one')).rejects.toMatchObject({ code: 'wrongPassword' })
  })

  it('refuses a tampered file', async () => {
    const envelope = await encryptBackup(createBackupFile(data(), 1), 'pw', FAST)
    const bytes = atob(envelope.encrypted.data)
    const flipped = String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1)
    await expect(decryptBackup({ ...envelope, encrypted: { ...envelope.encrypted, data: btoa(flipped) } }, 'pw')).rejects.toBeInstanceOf(BackupCryptoError)
  })

  it('derives the key with the recommended work factor by default', async () => {
    expect(BACKUP_KDF_ITERATIONS).toBe(600_000)
    const envelope = await encryptBackup(createBackupFile(data(), 1), 'pw')
    expect(envelope.encrypted.iterations).toBe(600_000)
    expect(JSON.parse(await decryptBackup(envelope, 'pw'))).toMatchObject({ app: 'teleo' })
  }, 20_000)
})

describe('readBackupText', () => {
  it('tells a plain backup from a password-protected one', async () => {
    const plain = JSON.stringify(createBackupFile(data(), 5))
    expect(readBackupText(plain)).toEqual({ kind: 'plain', json: plain })
    const envelope = await encryptBackup(createBackupFile(data(), 5), 'pw', FAST)
    expect(readBackupText(JSON.stringify(envelope))).toEqual({ kind: 'encrypted', envelope })
  })

  it('reports files that are neither', () => {
    expect(readBackupText('nope')).toEqual({ kind: 'error', code: 'notJson' })
    expect(readBackupText('{"app":"other"}')).toEqual({ kind: 'error', code: 'wrongApp' })
  })

  it.each([
    ['an unknown cipher', { cipher: 'ROT13' }],
    ['a short salt', { salt: btoa('short') }],
    ['an absurd work factor', { iterations: 1e12 }],
    ['a nonce of the wrong size', { iv: btoa('0123456789abcdef') }],
  ])('rejects an envelope with %s', async (_, patch) => {
    const envelope = await encryptBackup(createBackupFile(data(), 5), 'pw', FAST)
    const broken = { ...envelope, encrypted: { ...envelope.encrypted, ...patch } }
    expect(readBackupText(JSON.stringify(broken))).toEqual({ kind: 'error', code: 'invalidShape', path: 'encrypted' })
  })
})
