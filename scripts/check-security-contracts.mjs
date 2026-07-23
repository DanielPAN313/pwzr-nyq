import assert from 'node:assert/strict'
import {
  bearerToken,
  createUploadPolicy,
  hashToken,
  hasAdminPermission,
  newOpaqueToken,
  safeUploadKey,
} from './server/security.mjs'

const token = newOpaqueToken('nyq_test')
assert.match(token, /^nyq_test_[A-Za-z0-9_-]+$/)
assert.equal(hashToken(token).length, 64)
assert.equal(bearerToken({ headers: { authorization: `Bearer ${token}` } }), token)
assert.equal(bearerToken({ headers: {} }), '')

assert.equal(hasAdminPermission('super_admin', 'anything:write'), true)
assert.equal(hasAdminPermission('finance', 'refund:decide'), true)
assert.equal(hasAdminPermission('finance', 'venue:write'), false)
assert.equal(hasAdminPermission('auditor', 'audit:read'), true)

assert.equal(safeUploadKey('venue/photo-01.webp'), 'venue/photo-01.webp')
assert.equal(safeUploadKey('../secret.txt'), '')
assert.equal(safeUploadKey('bad key.png'), '')

const policy = createUploadPolicy({
  key: 'admin/2026/07/example.png',
  contentType: 'image/png',
  maxBytes: 1024,
  expiresAt: 123456789,
  secret: '01234567890123456789012345678901',
})
assert.ok(policy.payload)
assert.ok(policy.signature)
assert.notEqual(policy.payload, policy.signature)

console.log('Security contract check passed.')
