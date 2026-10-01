import { BACKUP_APP, BACKUP_SCHEMA_VERSION, type BackupErrorCode, type BackupFile } from './validate'

/*
 * Password-protected backups (owner request 2026-10-01, DECISIONS #111). Religious practice is special-category
 * data (GDPR art. 9) and a backup is meant to leave the device (cloud drive, e-mail), so it may be sealed with a
 * password: AES-256-GCM with a key from PBKDF2-SHA-256. Web Crypto only — no dependency, no server. The header
 * (app, format, date, version) stays readable for the preview and is authenticated with the data.
 */

/** OWASP (2023) work factor for PBKDF2-HMAC-SHA-256. */
export const BACKUP_KDF_ITERATIONS = 600_000
/** A file asking for more would freeze the app while deriving the key. */
const MAX_ITERATIONS = 10_000_000
const SALT_BYTES = 16
const IV_BYTES = 12

export interface EncryptedPayload {
  v: 1
  kdf: 'PBKDF2-SHA-256'
  cipher: 'AES-256-GCM'
  iterations: number
  /** Base64. */
  salt: string
  /** Base64 (the GCM nonce). */
  iv: string
  /** Base64 ciphertext of the plain backup file's JSON, tag included. */
  data: string
}

export interface EncryptedBackup {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: number
  appVersion?: string
  encrypted: EncryptedPayload
}

export type BackupCryptoErrorCode = 'wrongPassword' | 'invalidEnvelope'

export class BackupCryptoError extends Error {
  readonly code: BackupCryptoErrorCode
  constructor(code: BackupCryptoErrorCode) {
    super(`Backup decryption failed: ${code}`)
    this.name = 'BackupCryptoError'
    this.code = code
  }
}

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function fromBase64(text: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof text !== 'string') return null
  try {
    const binary = atob(text)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** The readable header, bound to the ciphertext: a changed date or version fails decryption. */
const headerOf = (file: { app: string; schemaVersion: number; exportedAt: number; appVersion?: string }) =>
  encoder.encode(`${file.app}|${file.schemaVersion}|${file.exportedAt}|${file.appVersion ?? ''}`)

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: KeyUsage): Promise<CryptoKey> {
  // NFC: the same password typed on another keyboard (precomposed or combining "ś") opens the file.
  const material = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, [usage])
}

export async function encryptBackup(file: BackupFile, password: string, options: { iterations?: number } = {}): Promise<EncryptedBackup> {
  const iterations = options.iterations ?? BACKUP_KDF_ITERATIONS
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt, iterations, 'encrypt')
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: headerOf(file) }, key, encoder.encode(JSON.stringify(file)))
  return {
    app: BACKUP_APP,
    schemaVersion: file.schemaVersion,
    exportedAt: file.exportedAt,
    ...(file.appVersion ? { appVersion: file.appVersion } : {}),
    encrypted: { v: 1, kdf: 'PBKDF2-SHA-256', cipher: 'AES-256-GCM', iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) },
  }
}

/** The plain backup's JSON; throws {@link BackupCryptoError} for a wrong password or a changed file. */
export async function decryptBackup(envelope: EncryptedBackup, password: string): Promise<string> {
  const { iterations } = envelope.encrypted
  const salt = fromBase64(envelope.encrypted.salt)
  const iv = fromBase64(envelope.encrypted.iv)
  const data = fromBase64(envelope.encrypted.data)
  if (!salt || !iv || !data) throw new BackupCryptoError('invalidEnvelope')
  try {
    const key = await deriveKey(password, salt, iterations, 'decrypt')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: headerOf(envelope) }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    // AES-GCM cannot tell a wrong password from a modified file: both fail authentication.
    throw new BackupCryptoError('wrongPassword')
  }
}

function validPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    p.v === 1 &&
    p.kdf === 'PBKDF2-SHA-256' &&
    p.cipher === 'AES-256-GCM' &&
    Number.isInteger(p.iterations) &&
    (p.iterations as number) >= 1 &&
    (p.iterations as number) <= MAX_ITERATIONS &&
    fromBase64(p.salt)?.length === SALT_BYTES &&
    fromBase64(p.iv)?.length === IV_BYTES &&
    (fromBase64(p.data)?.length ?? 0) > 16
  )
}

export type BackupText =
  | { kind: 'plain'; json: string }
  | { kind: 'encrypted'; envelope: EncryptedBackup }
  | { kind: 'error'; code: BackupErrorCode; path?: string }

/**
 * First look at a chosen file: a plain backup (validated in full by `parseBackup`), a password-protected one
 * (its envelope checked here), or neither.
 */
export function readBackupText(json: string): BackupText {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { kind: 'error', code: 'notJson' }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { kind: 'error', code: 'invalidShape' }
  const file = value as Record<string, unknown>
  if (file.app !== BACKUP_APP) return { kind: 'error', code: 'wrongApp' }
  if (!('encrypted' in file)) return { kind: 'plain', json }
  const version = file.schemaVersion
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > BACKUP_SCHEMA_VERSION) {
    return { kind: 'error', code: 'unsupportedVersion' }
  }
  if (typeof file.exportedAt !== 'number' || !Number.isFinite(file.exportedAt)) return { kind: 'error', code: 'invalidShape', path: 'exportedAt' }
  if (file.appVersion !== undefined && typeof file.appVersion !== 'string') return { kind: 'error', code: 'invalidShape', path: 'appVersion' }
  if (!validPayload(file.encrypted)) return { kind: 'error', code: 'invalidShape', path: 'encrypted' }
  return { kind: 'encrypted', envelope: file as unknown as EncryptedBackup }
}
