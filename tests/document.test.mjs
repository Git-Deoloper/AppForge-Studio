import test from 'node:test'
import assert from 'node:assert/strict'
import { createSampleDocument } from '../src/sampleDocument.ts'
import { validateDocument, isSafeImageSource } from '../src/validation.ts'
import { generateFiles } from '../src/exporters.ts'
import { createZip } from '../src/zip.ts'
import { inflateRawSync } from 'node:zlib'

test('sample document survives a JSON round trip', () => {
  assert.equal(validateDocument(JSON.parse(JSON.stringify(createSampleDocument()))), true)
})

test('malformed nested documents are rejected without throwing', () => {
  const invalid = [null, {}, { screens: [], assets: [], tokens: [] }]
  for (const mutate of [
    doc => { delete doc.exportSettings },
    doc => { doc.screens = [] },
    doc => { doc.screens[0].nodes = [null] },
    doc => { doc.screens[0].nodes[0].width = -1 },
    doc => { doc.screens[0].nodes[0].x = Infinity },
    doc => { doc.screens[1].id = doc.screens[0].id },
    doc => { doc.screens[0].nodes[0].assetId = 'missing' },
    doc => { doc.screens[0].nodes[3].action.targetScreenId = 'missing' },
    doc => { doc.assets[0].src = 'javascript:alert(1)' },
  ]) {
    const doc = createSampleDocument()
    mutate(doc)
    invalid.push(doc)
  }
  for (const value of invalid) assert.equal(validateDocument(value), false)
})

test('image URLs reject credentials and executable schemes', () => {
  assert.equal(isSafeImageSource('https://example.com/image.png'), true)
  assert.equal(isSafeImageSource('https://user:password@example.com/image.png'), false)
  assert.equal(isSafeImageSource('javascript:alert(1)'), false)
  assert.equal(isSafeImageSource('data:text/html,test'), false)
  assert.equal(isSafeImageSource('/relative.png'), false)
})

test('export names remain unique and valid for duplicate, numeric and non-Latin titles', () => {
  const doc = createSampleDocument()
  doc.screens[0].name = '123'
  doc.screens[1].name = '123'
  doc.exportSettings.appName = '123'
  const files = generateFiles(doc)
  assert.equal(new Set(files.map(file => file.path)).size, files.length)
  const router = files.find(file => file.path.endsWith('AppRouter.swift')).content
  assert.match(router, /case screen1Item123/)
  assert.match(router, /case screen2Item123/)
  assert.ok(files.some(file => file.path.endsWith('Screen1Item123View.swift')))
  doc.screens.forEach(screen => { screen.name = 'مرحبا' })
  assert.equal(new Set(generateFiles(doc).map(file => file.path)).size, files.length)
})

test('generated source escapes multiline text, tokens and Kotlin interpolation', () => {
  const doc = createSampleDocument()
  const node = doc.screens[0].nodes.find(node => node.type === 'text')
  node.text = 'Say "hello"\n$amount \\ next'
  node.x = 10.5
  doc.tokens[0].value = 'a"\nb'
  doc.screens[0].background = 'transparent'
  doc.exportSettings.androidPackageName = '123.bad-name.class'
  const files = generateFiles(doc)
  const swift = files.find(file => file.path.endsWith('Screen1HomeView.swift')).content
  const kotlin = files.find(file => file.path.endsWith('Screen1Home.kt')).content
  const tokens = files.find(file => file.path.endsWith('DesignTokens.swift')).content
  assert.ok(swift.includes('Say \\"hello\\"\\u{a}$amount \\\\ next'))
  assert.ok(kotlin.includes('\\$amount'))
  assert.ok(kotlin.includes('10.5f.dp'))
  assert.ok(kotlin.includes('import androidx.compose.foundation.layout.absoluteOffset'))
  assert.ok(kotlin.includes('Color.Transparent'))
  assert.ok(kotlin.includes('package pkg_123.bad_name.pkg_class.screens'))
  assert.ok(tokens.includes('a\\"\\u{a}b'))
})

test('ZIP preserves nested UTF-8 files in a single downloadable archive', () => {
  const input = [{ path: 'app/مرحبا.txt', content: 'Hello مرحبا' }, { path: 'app/main.swift', content: 'import SwiftUI\n' }]
  const zip = createZip(input)
  const view = new DataView(zip.buffer)
  const decoder = new TextDecoder()
  let offset = 0
  for (const file of input) {
    assert.equal(view.getUint32(offset, true), 0x04034b50)
    const method = view.getUint16(offset + 8, true)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    assert.equal(decoder.decode(zip.slice(offset + 30, offset + 30 + nameLength)), file.path)
    const start = offset + 30 + nameLength + extraLength
    const body = zip.slice(start, start + size)
    assert.equal(decoder.decode(method === 0 ? body : inflateRawSync(body)), file.content)
    offset = start + size
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50)
  assert.throws(() => createZip([{ path: '../bad.txt', content: '' }]), /Invalid/)
})
