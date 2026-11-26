import type { DesignDocument } from './types'

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_ASSET_BYTES = 5 * 1024 * 1024

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 10_000): value is string => typeof value === 'string' && value.length <= max
const id = (value: unknown): value is string => text(value, 128) && value.length > 0
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const color = (value: unknown) => typeof value === 'string' && (value === 'transparent' || /^#[\da-f]{6}$/i.test(value))
const uniqueIds = (values: unknown[]) => values.every(record) && new Set(values.map(value => value.id)).size === values.length

export function isSafeImageSource(value: unknown): value is string {
  if (!text(value, MAX_DOCUMENT_BYTES)) return false
  if (/^data:image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml)[;,]/i.test(value)) return true
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
  } catch {
    return false
  }
}

/** Validate every field used by the editor and exporters before replacing a workspace. */
export function validateDocument(value: unknown): value is DesignDocument {
  if (!record(value) || !id(value.id) || !text(value.name, 256) || !text(value.description) ||
      !text(value.updatedAt, 64) || !Number.isFinite(Date.parse(value.updatedAt))) return false
  const { screens, assets, tokens, exportSettings: settings } = value
  if (!Array.isArray(screens) || screens.length < 1 || screens.length > 100 ||
      !Array.isArray(assets) || assets.length > 200 || !Array.isArray(tokens) || tokens.length > 500 ||
      !record(settings)) return false
  if (!['appName', 'bundleId', 'swiftModuleName', 'androidPackageName'].every(key => text(settings[key], 256)) ||
      !['swiftui', 'swift', 'metal', 'jetpack-compose'].includes(String(settings.primaryTarget))) return false
  if (!assets.every(asset => record(asset) && id(asset.id) && text(asset.name, 256) &&
      asset.kind === 'image' && isSafeImageSource(asset.src) && text(asset.mimeType, 128))) return false
  if (!tokens.every(token => record(token) && id(token.id) && text(token.name, 256) && text(token.value) &&
      ['color', 'spacing', 'radius'].includes(String(token.category)))) return false
  if (!screens.every(screen => record(screen) && id(screen.id) && text(screen.name, 256) && color(screen.background) &&
      Array.isArray(screen.nodes) && screen.nodes.length <= 500)) return false
  if (!uniqueIds(screens) || !uniqueIds(assets) || !uniqueIds(tokens)) return false
  const screenIds = new Set(screens.map(screen => screen.id))
  const assetIds = new Set(assets.map(asset => asset.id))
  return screens.every(screen => uniqueIds(screen.nodes) && screen.nodes.every((node: unknown) => {
    if (!record(node) || !id(node.id) || !text(node.name, 256) || !text(node.text) ||
        !['text', 'button', 'image', 'shape'].includes(String(node.type)) ||
        !color(node.fill) || !color(node.foreground)) return false
    if (!number(node.x, 0, 10_000) || !number(node.y, 0, 10_000) ||
        !number(node.width, 1, 10_000) || !number(node.height, 1, 10_000) ||
        !number(node.fontSize, 1, 512) || !number(node.fontWeight, 100, 900) || !number(node.radius, 0, 10_000)) return false
    if (node.assetId !== undefined && node.assetId !== '' && !assetIds.has(node.assetId)) return false
    if (node.action !== undefined && (!record(node.action) || node.action.type !== 'navigate' ||
        !screenIds.has(node.action.targetScreenId) || !['push', 'modal', 'fade'].includes(String(node.action.transition)))) return false
    return true
  }))
}
