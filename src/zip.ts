import type { GeneratedFile } from './types'

const encode = new TextEncoder()
const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** ZIP STORE format: preserve the generated directory tree in one browser download. */
export function createZip(files: Pick<GeneratedFile, 'path' | 'content'>[]): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0
  const paths = new Set<string>()
  for (const file of files) {
    if (file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').some(part => !part || part === '..') || paths.has(file.path)) {
      throw new Error('Invalid or duplicate export path')
    }
    paths.add(file.path)
    const name = encode.encode(file.path)
    const body = encode.encode(file.content)
    const crc = crc32(body)
    const local = new Uint8Array(30 + name.length)
    const header = new DataView(local.buffer)
    header.setUint32(0, 0x04034b50, true)
    header.setUint16(4, 20, true)
    header.setUint16(6, 0x0800, true)
    header.setUint16(12, 33, true) // 1980-01-01: valid DOS date, deterministic archive.
    header.setUint32(14, crc, true)
    header.setUint32(18, body.length, true)
    header.setUint32(22, body.length, true)
    header.setUint16(26, name.length, true)
    local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const entry = new DataView(central.buffer)
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, 0x0800, true)
    entry.setUint16(14, 33, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, body.length, true)
    entry.setUint32(24, body.length, true)
    entry.setUint16(28, name.length, true)
    entry.setUint32(42, offset, true)
    central.set(name, 46)
    chunks.push(local, body)
    directory.push(central)
    offset += local.length + body.length
  }
  const directorySize = directory.reduce((sum, entry) => sum + entry.length, 0)
  const end = new Uint8Array(22)
  const trailer = new DataView(end.buffer)
  trailer.setUint32(0, 0x06054b50, true)
  trailer.setUint16(8, files.length, true)
  trailer.setUint16(10, files.length, true)
  trailer.setUint32(12, directorySize, true)
  trailer.setUint32(16, offset, true)
  const result = new Uint8Array(offset + directorySize + end.length)
  let position = 0
  for (const chunk of [...chunks, ...directory, end]) {
    result.set(chunk, position)
    position += chunk.length
  }
  return result
}
