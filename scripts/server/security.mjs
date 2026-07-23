import crypto from 'node:crypto'

const TOKEN_BYTES = 32

export const ADMIN_PERMISSIONS = Object.freeze({
  super_admin: ['*'],
  operations: ['dashboard:read', 'venue:read', 'venue:write', 'refund:read', 'refund:decide', 'upload:sign'],
  finance: ['dashboard:read', 'refund:read', 'refund:decide'],
  auditor: ['dashboard:read', 'venue:read', 'refund:read', 'audit:read'],
})

export const newOpaqueToken = (prefix = 'nyq') => `${prefix}_${crypto.randomBytes(TOKEN_BYTES).toString('base64url')}`

export const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex')

export const bearerToken = (req) => {
  const value = String(req.headers.authorization || '').trim()
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

export const hasAdminPermission = (role, permission) => {
  const permissions = ADMIN_PERMISSIONS[role] || []
  return permissions.includes('*') || permissions.includes(permission)
}

export const safeUploadKey = (value) => {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
  if (!normalized || normalized.includes('..') || !/^[a-zA-Z0-9/_\-.]+$/.test(normalized)) return ''
  return normalized.slice(0, 240)
}

export const createUploadPolicy = ({ key, contentType, maxBytes, expiresAt, secret }) => {
  const payload = Buffer.from(JSON.stringify({ key, contentType, maxBytes, expiresAt })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return { payload, signature }
}
