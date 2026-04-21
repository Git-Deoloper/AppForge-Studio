export type DesignNodeType = 'text' | 'button' | 'image' | 'shape'
export type TransitionType = 'push' | 'modal' | 'fade'
export type ExportTarget = 'swiftui' | 'swift' | 'metal' | 'jetpack-compose'

export interface StyleToken {
  id: string
  name: string
  value: string
  category: 'color' | 'spacing' | 'radius'
}

export interface AssetItem {
  id: string
  name: string
  kind: 'image'
  src: string
  mimeType: string
}

export interface NodeAction {
  type: 'navigate'
  targetScreenId: string
  transition: TransitionType
}

export interface DesignNode {
  id: string
  name: string
  type: DesignNodeType
  x: number
  y: number
  width: number
  height: number
  text: string
  fill: string
  foreground: string
  fontSize: number
  fontWeight: number
  radius: number
  assetId?: string
  action?: NodeAction
}

export interface Screen {
  id: string
  name: string
  background: string
  nodes: DesignNode[]
}

export interface ExportSettings {
  appName: string
  bundleId: string
  swiftModuleName: string
  androidPackageName: string
  primaryTarget: ExportTarget
}

export interface DesignDocument {
  id: string
  name: string
  description: string
  updatedAt: string
  screens: Screen[]
  assets: AssetItem[]
  tokens: StyleToken[]
  exportSettings: ExportSettings
}

export interface GeneratedFile {
  path: string
  platform: ExportTarget
  content: string
  description: string
}
