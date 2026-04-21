import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { filterFilesByTarget, generateFiles } from './exporters'
import {
  SCREEN_SIZE,
  createComponentPreset,
  createNode,
  createSampleDocument,
  createScreen,
} from './sampleDocument'
import type { AssetItem, DesignDocument, DesignNode, ExportTarget, GeneratedFile, Screen, TransitionType } from './types'

const STORAGE_KEY = 'appforge-studio-document'
const exportTargets: ExportTarget[] = ['swiftui', 'swift', 'metal', 'jetpack-compose']

const FALLBACK_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" fill="none"><rect width="480" height="320" rx="32" fill="#0F172A"/><path d="M96 224L176 152L240 216L312 120L384 224" stroke="#38BDF8" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><circle cx="176" cy="112" r="28" fill="#7C3AED"/></svg>',
)}`

const isSafeImageSource = (value: string) => {
  if (value.startsWith('data:image/') || value.startsWith('blob:')) {
    return true
  }

  try {
    const parsed = new URL(value, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const getRenderableAssetSrc = (asset?: AssetItem) =>
  asset && isSafeImageSource(asset.src) ? asset.src : FALLBACK_IMAGE

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const validateDocument = (value: unknown): value is DesignDocument => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<DesignDocument>
  return Array.isArray(candidate.screens) && Array.isArray(candidate.assets) && Array.isArray(candidate.tokens)
}

const createInitialWorkspace = () => {
  const fallback = createSampleDocument()

  if (typeof window === 'undefined') {
    return {
      documentModel: fallback,
      selectedScreenId: fallback.screens[0]?.id ?? '',
      previewScreenId: fallback.screens[0]?.id ?? '',
      exportTarget: fallback.exportSettings.primaryTarget,
      statusMessage: 'Ready',
    }
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return {
      documentModel: fallback,
      selectedScreenId: fallback.screens[0]?.id ?? '',
      previewScreenId: fallback.screens[0]?.id ?? '',
      exportTarget: fallback.exportSettings.primaryTarget,
      statusMessage: 'Ready',
    }
  }

  try {
    const parsed = JSON.parse(stored) as unknown

    if (validateDocument(parsed)) {
      return {
        documentModel: parsed,
        selectedScreenId: parsed.screens[0]?.id ?? '',
        previewScreenId: parsed.screens[0]?.id ?? '',
        exportTarget: parsed.exportSettings.primaryTarget,
        statusMessage: 'Loaded autosaved workspace',
      }
    }
  } catch {
    return {
      documentModel: fallback,
      selectedScreenId: fallback.screens[0]?.id ?? '',
      previewScreenId: fallback.screens[0]?.id ?? '',
      exportTarget: fallback.exportSettings.primaryTarget,
      statusMessage: 'Saved workspace was invalid and ignored',
    }
  }

  return {
    documentModel: fallback,
    selectedScreenId: fallback.screens[0]?.id ?? '',
    previewScreenId: fallback.screens[0]?.id ?? '',
    exportTarget: fallback.exportSettings.primaryTarget,
    statusMessage: 'Ready',
  }
}

function App() {
  const initialWorkspace = useMemo(() => createInitialWorkspace(), [])
  const [documentModel, setDocumentModel] = useState<DesignDocument>(initialWorkspace.documentModel)
  const [selectedScreenId, setSelectedScreenId] = useState<string>(initialWorkspace.selectedScreenId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [previewScreenId, setPreviewScreenId] = useState<string>(initialWorkspace.previewScreenId)
  const [exportTarget, setExportTarget] = useState<ExportTarget>(initialWorkspace.exportTarget)
  const [selectedFilePath, setSelectedFilePath] = useState<string>('')
  const [assetUrl, setAssetUrl] = useState('')
  const [statusMessage, setStatusMessage] = useState(initialWorkspace.statusMessage)
  const [assetUploadVersion, setAssetUploadVersion] = useState(0)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)

  const screens = documentModel.screens
  const selectedScreen = useMemo(
    () => screens.find((screen) => screen.id === selectedScreenId) ?? screens[0],
    [screens, selectedScreenId],
  )
  const previewScreen = useMemo(
    () => screens.find((screen) => screen.id === previewScreenId) ?? selectedScreen,
    [previewScreenId, screens, selectedScreen],
  )
  const selectedNode = useMemo(
    () => selectedScreen?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, selectedScreen],
  )

  const generatedFiles = useMemo(() => generateFiles(documentModel), [documentModel])
  const visibleFiles = useMemo(
    () => filterFilesByTarget(generatedFiles, exportTarget),
    [exportTarget, generatedFiles],
  )
  const activeFilePath = visibleFiles.some((file) => file.path === selectedFilePath)
    ? selectedFilePath
    : (visibleFiles[0]?.path ?? '')
  const selectedGeneratedFile = visibleFiles.find((file) => file.path === activeFilePath) ?? null

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current || !selectedScreen || !canvasRef.current) {
        return
      }

      const bounds = canvasRef.current.getBoundingClientRect()
      const nextX = event.clientX - bounds.left - dragRef.current.offsetX
      const nextY = event.clientY - bounds.top - dragRef.current.offsetY

      setDocumentModel((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        screens: current.screens.map((screen) => {
          if (screen.id !== selectedScreen.id) {
            return screen
          }

          return {
            ...screen,
            nodes: screen.nodes.map((node) =>
              node.id === dragRef.current?.nodeId
                ? {
                    ...node,
                    x: clamp(nextX, 0, SCREEN_SIZE.width - node.width),
                    y: clamp(nextY, 0, SCREEN_SIZE.height - node.height),
                  }
                : node,
            ),
          }
        }),
      }))
    }

    const handlePointerUp = () => {
      dragRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [selectedScreen])

  const updateDocument = (updater: (current: DesignDocument) => DesignDocument) => {
    setDocumentModel((current) => {
      const updated = updater(current)
      return { ...updated, updatedAt: new Date().toISOString() }
    })
  }

  const updateScreen = (updater: (screen: Screen) => Screen) => {
    if (!selectedScreen) {
      return
    }

    updateDocument((current) => ({
      ...current,
      screens: current.screens.map((screen) =>
        screen.id === selectedScreen.id ? updater(screen) : screen,
      ),
    }))
  }

  const updateNode = (updater: (node: DesignNode) => DesignNode) => {
    if (!selectedScreen || !selectedNode) {
      return
    }

    updateScreen((screen) => ({
      ...screen,
      nodes: screen.nodes.map((node) => (node.id === selectedNode.id ? updater(node) : node)),
    }))
  }

  const addScreen = () => {
    const screen = createScreen(`Screen ${documentModel.screens.length + 1}`)
    updateDocument((current) => ({ ...current, screens: [...current.screens, screen] }))
    setSelectedScreenId(screen.id)
    setPreviewScreenId(screen.id)
    setSelectedNodeId(null)
    setStatusMessage(`Added ${screen.name}`)
  }

  const duplicateScreen = () => {
    if (!selectedScreen) {
      return
    }

    const duplicated: Screen = {
      ...selectedScreen,
      id: crypto.randomUUID(),
      name: `${selectedScreen.name} Copy`,
      nodes: selectedScreen.nodes.map((node) => ({
        ...node,
        id: crypto.randomUUID(),
        action: node.action ? { ...node.action } : undefined,
      })),
    }

    updateDocument((current) => ({ ...current, screens: [...current.screens, duplicated] }))
    setSelectedScreenId(duplicated.id)
    setSelectedNodeId(null)
    setStatusMessage(`Duplicated ${selectedScreen.name}`)
  }

  const addNodeToSelectedScreen = (type: DesignNode['type']) => {
    if (!selectedScreen) {
      return
    }

    const nextNode = createNode(type, {
      x: 28 + selectedScreen.nodes.length * 8,
      y: 32 + selectedScreen.nodes.length * 16,
    })

    if (type === 'image' && documentModel.assets[0]) {
      nextNode.assetId = documentModel.assets[0].id
    }

    updateScreen((screen) => ({ ...screen, nodes: [...screen.nodes, nextNode] }))
    setSelectedNodeId(nextNode.id)
    setStatusMessage(`Inserted ${nextNode.name}`)
  }

  const insertPreset = (preset: 'hero' | 'cta' | 'card') => {
    updateScreen((screen) => ({
      ...screen,
      nodes: [...screen.nodes, ...createComponentPreset(preset)],
    }))
    setStatusMessage(`Added ${preset} component preset`)
  }

  const removeSelectedNode = () => {
    if (!selectedNode) {
      return
    }

    updateScreen((screen) => ({
      ...screen,
      nodes: screen.nodes.filter((node) => node.id !== selectedNode.id),
    }))
    setSelectedNodeId(null)
    setStatusMessage(`Deleted ${selectedNode.name}`)
  }

  const saveWorkspace = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documentModel))
    setStatusMessage('Workspace saved to local storage')
  }

  const resetWorkspace = () => {
    const next = createSampleDocument()
    setDocumentModel(next)
    setSelectedScreenId(next.screens[0]?.id ?? '')
    setPreviewScreenId(next.screens[0]?.id ?? '')
    setSelectedNodeId(null)
    setStatusMessage('Reset to the starter prototype')
  }

  const downloadDocument = () => {
    downloadTextFile(`${documentModel.name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(documentModel, null, 2))
    setStatusMessage('Design document downloaded')
  }

  const importDocument = async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown

    if (!validateDocument(parsed)) {
      throw new Error('Invalid document file')
    }

    setDocumentModel(parsed)
    setSelectedScreenId(parsed.screens[0]?.id ?? '')
    setPreviewScreenId(parsed.screens[0]?.id ?? '')
    setSelectedNodeId(null)
    setStatusMessage(`Imported ${parsed.name}`)
  }

  const addAssetByUrl = () => {
    if (!assetUrl.trim()) {
      return
    }

    if (!isSafeImageSource(assetUrl.trim())) {
      setStatusMessage('Only https, http, blob, or data:image assets are allowed')
      return
    }

    const nextAsset: AssetItem = {
      id: crypto.randomUUID(),
      name: `Remote Asset ${documentModel.assets.length + 1}`,
      kind: 'image',
      src: assetUrl.trim(),
      mimeType: 'image/*',
    }

    updateDocument((current) => ({ ...current, assets: [...current.assets, nextAsset] }))
    setAssetUrl('')
    setStatusMessage(`Added ${nextAsset.name}`)
  }

  const addAssetFromFile = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    const nextAsset: AssetItem = {
      id: crypto.randomUUID(),
      name: file.name,
      kind: 'image',
      src: dataUrl,
      mimeType: file.type || 'image/*',
    }

    updateDocument((current) => ({ ...current, assets: [...current.assets, nextAsset] }))
    setAssetUploadVersion((value) => value + 1)
    setStatusMessage(`Uploaded ${file.name}`)
  }

  const bindAssetToSelectedNode = (assetId: string) => {
    if (!selectedNode || selectedNode.type !== 'image') {
      return
    }

    updateNode((node) => ({ ...node, assetId }))
    setStatusMessage('Updated image asset binding')
  }

  const goToPreviewTarget = (node: DesignNode) => {
    if (node.action?.type !== 'navigate') {
      return
    }

    setPreviewScreenId(node.action.targetScreenId)
  }

  const downloadGeneratedFiles = (files: GeneratedFile[]) => {
    files.forEach((file) => {
      downloadTextFile(file.path.split('/').pop() ?? file.path, file.content)
    })
    setStatusMessage(`Downloaded ${files.length} generated files`)
  }

  const prototypeLinks = useMemo(
    () =>
      documentModel.screens.flatMap((screen) =>
        screen.nodes
          .filter((node) => node.action?.type === 'navigate')
          .map((node) => ({
            sourceScreenId: screen.id,
            sourceScreenName: screen.name,
            nodeName: node.name,
            targetScreenId: node.action?.targetScreenId ?? '',
            targetScreenName:
              documentModel.screens.find((candidate) => candidate.id === node.action?.targetScreenId)?.name ??
              'Missing target',
            transition: node.action?.transition ?? 'push',
          })),
      ),
    [documentModel.screens],
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">App design studio</p>
          <h1>{documentModel.name}</h1>
          <p className="subtle">{documentModel.description}</p>
        </div>
        <div className="topbar-actions">
          <button onClick={addScreen}>Add screen</button>
          <button onClick={duplicateScreen}>Duplicate</button>
          <button onClick={saveWorkspace}>Save</button>
          <button onClick={resetWorkspace}>Reset</button>
          <button onClick={downloadDocument}>Download JSON</button>
          <label className="buttonlike">
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  return
                }

                void importDocument(file).catch(() => setStatusMessage('Failed to import document'))
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="panel stack-gap">
          <section>
            <div className="panel-title-row">
              <h2>Screens</h2>
              <span>{documentModel.screens.length}</span>
            </div>
            <div className="screen-list">
              {documentModel.screens.map((screen) => (
                <button
                  key={screen.id}
                  className={screen.id === selectedScreen?.id ? 'screen-pill active' : 'screen-pill'}
                  onClick={() => {
                    setSelectedScreenId(screen.id)
                    setPreviewScreenId(screen.id)
                    setSelectedNodeId(null)
                  }}
                >
                  <strong>{screen.name}</strong>
                  <small>{screen.nodes.length} layers</small>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="panel-title-row">
              <h2>Insert</h2>
              <span>Elements</span>
            </div>
            <div className="insert-grid">
              {(['text', 'button', 'image', 'shape'] as const).map((type) => (
                <button key={type} onClick={() => addNodeToSelectedScreen(type)}>
                  {type}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="panel-title-row">
              <h2>Pattern library</h2>
              <span>Reusable</span>
            </div>
            <div className="insert-grid">
              <button onClick={() => insertPreset('hero')}>Hero</button>
              <button onClick={() => insertPreset('cta')}>CTA</button>
              <button onClick={() => insertPreset('card')}>Card</button>
            </div>
          </section>

          <section>
            <div className="panel-title-row">
              <h2>Layers</h2>
              <button className="ghost" onClick={removeSelectedNode} disabled={!selectedNode}>
                Delete
              </button>
            </div>
            <div className="layer-list">
              {selectedScreen?.nodes.map((node) => (
                <button
                  key={node.id}
                  className={node.id === selectedNode?.id ? 'layer-row active' : 'layer-row'}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <span>{node.name}</span>
                  <small>{node.type}</small>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="panel stack-gap">
          <section className="canvas-header">
            <div>
              <p className="eyebrow">Canvas</p>
              <h2>{selectedScreen?.name ?? 'No screen selected'}</h2>
            </div>
            {selectedScreen ? (
              <div className="inline-fields">
                <label>
                  Screen name
                  <input
                    value={selectedScreen.name}
                    onChange={(event) =>
                      updateScreen((screen) => ({ ...screen, name: event.target.value || 'Untitled Screen' }))
                    }
                  />
                </label>
                <label>
                  Background
                  <input
                    type="color"
                    value={selectedScreen.background}
                    onChange={(event) =>
                      updateScreen((screen) => ({ ...screen, background: event.target.value }))
                    }
                  />
                </label>
              </div>
            ) : null}
          </section>

          <div className="canvas-wrap">
            <div
              ref={canvasRef}
              className="device-canvas"
              style={{ background: selectedScreen?.background }}
            >
              {selectedScreen?.nodes.map((node) => {
                const asset = documentModel.assets.find((entry) => entry.id === node.assetId)

                return (
                  <button
                    type="button"
                    key={node.id}
                    className={node.id === selectedNode?.id ? 'canvas-node selected' : 'canvas-node'}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      borderRadius: node.radius,
                      background: node.type === 'text' ? 'transparent' : node.fill,
                      color: node.foreground,
                      fontSize: node.fontSize,
                      fontWeight: node.fontWeight,
                    }}
                    onPointerDown={(event) => {
                      setSelectedNodeId(node.id)
                      const bounds = event.currentTarget.getBoundingClientRect()
                      dragRef.current = {
                        nodeId: node.id,
                        offsetX: event.clientX - bounds.left,
                        offsetY: event.clientY - bounds.top,
                      }
                    }}
                  >
                    {node.type === 'image' ? (
                      asset ? (
                        <img src={getRenderableAssetSrc(asset)} alt={asset.name} />
                      ) : (
                        <span className="placeholder-label">Choose asset</span>
                      )
                    ) : node.type === 'shape' ? (
                      <span className="placeholder-label">{node.name}</span>
                    ) : (
                      node.text
                    )}
                    {node.action?.type === 'navigate' ? <span className="nav-badge">↗</span> : null}
                  </button>
                )
              })}
            </div>
            <div className="canvas-legend">
              <span>Drag layers directly on the canvas.</span>
              <span>
                {SCREEN_SIZE.width} × {SCREEN_SIZE.height}
              </span>
            </div>
          </div>

          <section>
            <div className="panel-title-row">
              <h2>Prototype map</h2>
              <span>{prototypeLinks.length} links</span>
            </div>
            <div className="flow-map">
              <svg viewBox={`0 0 ${Math.max(documentModel.screens.length, 1) * 220} 220`}>
                {prototypeLinks.map((link, index) => {
                  const startX = documentModel.screens.findIndex((screen) => screen.id === link.sourceScreenId) * 220 + 110
                  const endX = documentModel.screens.findIndex((screen) => screen.id === link.targetScreenId) * 220 + 110
                  return (
                    <g key={`${link.sourceScreenId}-${link.nodeName}-${index}`}>
                      <defs>
                        <marker id={`arrow-${index}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                          <path d="M0,0 L8,4 L0,8 Z" fill="#06b6d4" />
                        </marker>
                      </defs>
                      <path
                        d={`M ${startX} 96 C ${startX} 12, ${endX} 12, ${endX} 96`}
                        markerEnd={`url(#arrow-${index})`}
                      />
                      <text x={(startX + endX) / 2} y="26">
                        {link.nodeName}
                      </text>
                    </g>
                  )
                })}
              </svg>
              <div className="flow-screens">
                {documentModel.screens.map((screen) => (
                  <div key={screen.id} className="flow-screen-card">
                    <strong>{screen.name}</strong>
                    <small>{screen.nodes.length} nodes</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <aside className="panel stack-gap right-rail">
          <section>
            <div className="panel-title-row">
              <h2>Inspector</h2>
              <span>{selectedNode ? selectedNode.type : 'screen'}</span>
            </div>
            {selectedNode ? (
              <div className="form-grid">
                <label>
                  Name
                  <input value={selectedNode.name} onChange={(event) => updateNode((node) => ({ ...node, name: event.target.value }))} />
                </label>
                {selectedNode.type !== 'shape' ? (
                  <label>
                    Text
                    <textarea value={selectedNode.text} onChange={(event) => updateNode((node) => ({ ...node, text: event.target.value }))} />
                  </label>
                ) : null}
                <div className="grid-2">
                  <label>
                    X
                    <input type="number" value={selectedNode.x} onChange={(event) => updateNode((node) => ({ ...node, x: Number(event.target.value) }))} />
                  </label>
                  <label>
                    Y
                    <input type="number" value={selectedNode.y} onChange={(event) => updateNode((node) => ({ ...node, y: Number(event.target.value) }))} />
                  </label>
                  <label>
                    Width
                    <input type="number" value={selectedNode.width} onChange={(event) => updateNode((node) => ({ ...node, width: Number(event.target.value) }))} />
                  </label>
                  <label>
                    Height
                    <input type="number" value={selectedNode.height} onChange={(event) => updateNode((node) => ({ ...node, height: Number(event.target.value) }))} />
                  </label>
                </div>
                <div className="grid-2">
                  <label>
                    Fill
                    <input type="color" value={selectedNode.fill === 'transparent' ? '#ffffff' : selectedNode.fill} onChange={(event) => updateNode((node) => ({ ...node, fill: event.target.value }))} />
                  </label>
                  <label>
                    Foreground
                    <input type="color" value={selectedNode.foreground} onChange={(event) => updateNode((node) => ({ ...node, foreground: event.target.value }))} />
                  </label>
                  <label>
                    Font size
                    <input type="number" value={selectedNode.fontSize} onChange={(event) => updateNode((node) => ({ ...node, fontSize: Number(event.target.value) }))} />
                  </label>
                  <label>
                    Radius
                    <input type="number" value={selectedNode.radius} onChange={(event) => updateNode((node) => ({ ...node, radius: Number(event.target.value) }))} />
                  </label>
                </div>
                {selectedNode.type === 'image' ? (
                  <label>
                    Asset
                    <select
                      value={selectedNode.assetId ?? ''}
                      onChange={(event) => bindAssetToSelectedNode(event.target.value)}
                    >
                      <option value="">Choose asset</option>
                      {documentModel.assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {selectedNode.type === 'button' ? (
                  <>
                    <label>
                      Target screen
                      <select
                        value={selectedNode.action?.targetScreenId ?? ''}
                        onChange={(event) =>
                          updateNode((node) => ({
                            ...node,
                            action: event.target.value
                              ? {
                                  type: 'navigate',
                                  targetScreenId: event.target.value,
                                  transition: node.action?.transition ?? 'push',
                                }
                              : undefined,
                          }))
                        }
                      >
                        <option value="">No navigation</option>
                        {documentModel.screens.map((screen) => (
                          <option key={screen.id} value={screen.id}>
                            {screen.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Transition
                      <select
                        value={selectedNode.action?.transition ?? 'push'}
                        onChange={(event) =>
                          updateNode((node) => ({
                            ...node,
                            action: node.action
                              ? {
                                  ...node.action,
                                  transition: event.target.value as TransitionType,
                                }
                              : node.action,
                          }))
                        }
                      >
                        <option value="push">Push</option>
                        <option value="modal">Modal</option>
                        <option value="fade">Fade</option>
                      </select>
                    </label>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="empty-panel">
                <p>Select a layer to edit its content, styling, position, and prototype action.</p>
              </div>
            )}
          </section>

          <section>
            <div className="panel-title-row">
              <h2>Assets</h2>
              <span>{documentModel.assets.length}</span>
            </div>
            <div className="form-grid compact">
              <label>
                Asset URL
                <input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} placeholder="https://example.com/asset.png" />
              </label>
              <button onClick={addAssetByUrl}>Add URL asset</button>
              <label className="buttonlike secondary">
                Upload image
                <input
                  key={assetUploadVersion}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }

                    void addAssetFromFile(file).catch(() => setStatusMessage('Failed to upload asset'))
                  }}
                />
              </label>
            </div>
            <div className="asset-grid">
              {documentModel.assets.map((asset) => (
                <button
                  key={asset.id}
                  className={selectedNode?.assetId === asset.id ? 'asset-card active' : 'asset-card'}
                  onClick={() => bindAssetToSelectedNode(asset.id)}
                >
                  <img src={getRenderableAssetSrc(asset)} alt={asset.name} />
                  <strong>{asset.name}</strong>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="panel-title-row">
              <h2>Tokens</h2>
              <span>{documentModel.tokens.length}</span>
            </div>
            <div className="token-list">
              {documentModel.tokens.map((token) => (
                <label key={token.id} className="token-row">
                  <span>{token.name}</span>
                  <input
                    value={token.value}
                    onChange={(event) =>
                      updateDocument((current) => ({
                        ...current,
                        tokens: current.tokens.map((entry) =>
                          entry.id === token.id ? { ...entry, value: event.target.value } : entry,
                        ),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="bottom-grid">
        <section className="panel stack-gap">
          <div className="panel-title-row">
            <h2>Preview</h2>
            <div className="inline-actions">
              <button onClick={() => setPreviewScreenId(documentModel.screens[0]?.id ?? '')}>Reset flow</button>
              <span>{previewScreen?.name}</span>
            </div>
          </div>
          <div className="preview-frame" style={{ background: previewScreen?.background }}>
            {previewScreen?.nodes.map((node) => {
              const asset = documentModel.assets.find((entry) => entry.id === node.assetId)
              const style = {
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                borderRadius: node.radius,
                background: node.type === 'text' ? 'transparent' : node.fill,
                color: node.foreground,
                fontSize: node.fontSize,
                fontWeight: node.fontWeight,
              }

              if (node.type === 'text') {
                return (
                  <div key={node.id} className="preview-node" style={style}>
                    {node.text}
                  </div>
                )
              }

              if (node.type === 'image') {
                return (
                  <div key={node.id} className="preview-node preview-image" style={style}>
                    {asset ? <img src={getRenderableAssetSrc(asset)} alt={asset.name} /> : <span>No asset</span>}
                  </div>
                )
              }

              if (node.type === 'shape') {
                return <div key={node.id} className="preview-node" style={style} />
              }

              return (
                <button key={node.id} className="preview-node preview-button" style={style} onClick={() => goToPreviewTarget(node)}>
                  {node.text}
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel stack-gap exporter-panel">
          <div className="panel-title-row">
            <h2>Exporter</h2>
            <div className="inline-actions wrap">
              {exportTargets.map((target) => (
                <button
                  key={target}
                  className={exportTarget === target ? 'target-pill active' : 'target-pill'}
                  onClick={() => setExportTarget(target)}
                >
                  {target}
                </button>
              ))}
              <button className="secondary" onClick={() => downloadGeneratedFiles(visibleFiles)}>
                Download target files
              </button>
              <button className="secondary" onClick={() => downloadGeneratedFiles(generatedFiles)}>
                Download all
              </button>
            </div>
          </div>
          <div className="exporter-settings">
            <label>
              App name
              <input
                value={documentModel.exportSettings.appName}
                onChange={(event) =>
                  updateDocument((current) => ({
                    ...current,
                    exportSettings: { ...current.exportSettings, appName: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              Bundle ID
              <input
                value={documentModel.exportSettings.bundleId}
                onChange={(event) =>
                  updateDocument((current) => ({
                    ...current,
                    exportSettings: { ...current.exportSettings, bundleId: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              Android package
              <input
                value={documentModel.exportSettings.androidPackageName}
                onChange={(event) =>
                  updateDocument((current) => ({
                    ...current,
                    exportSettings: { ...current.exportSettings, androidPackageName: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <div className="generated-files">
            <div className="file-list">
              {visibleFiles.map((file) => (
                <button
                  key={file.path}
                  className={selectedGeneratedFile?.path === file.path ? 'file-row active' : 'file-row'}
                  onClick={() => setSelectedFilePath(file.path)}
                >
                  <strong>{file.path}</strong>
                  <small>{file.description}</small>
                </button>
              ))}
            </div>
            <div className="code-preview">
              <div className="panel-title-row">
                <span>{selectedGeneratedFile?.path ?? 'No file selected'}</span>
                {selectedGeneratedFile ? (
                  <button className="ghost" onClick={() => downloadTextFile(selectedGeneratedFile.path.split('/').pop() ?? selectedGeneratedFile.path, selectedGeneratedFile.content)}>
                    Download file
                  </button>
                ) : null}
              </div>
              <pre>{selectedGeneratedFile?.content ?? 'Select a generated file to inspect the output.'}</pre>
            </div>
          </div>
        </section>
      </div>

      <footer className="statusbar">
        <span>{statusMessage}</span>
        <span>Updated {new Date(documentModel.updatedAt).toLocaleString()}</span>
      </footer>
    </div>
  )
}

export default App
