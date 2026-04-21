import type { AssetItem, DesignDocument, DesignNode, DesignNodeType, Screen } from './types'

const SCREEN_WIDTH = 390
const SCREEN_HEIGHT = 844

const svgCard = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" fill="none">
    <defs>
      <linearGradient id="hero" x1="0" y1="0" x2="640" y2="360" gradientUnits="userSpaceOnUse">
        <stop stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#06B6D4"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="32" fill="url(#hero)"/>
    <circle cx="510" cy="110" r="78" fill="rgba(255,255,255,.18)"/>
    <circle cx="138" cy="270" r="96" fill="rgba(255,255,255,.12)"/>
    <text x="48" y="132" fill="white" font-family="Arial, sans-serif" font-size="54" font-weight="700">Launch faster</text>
    <text x="48" y="188" fill="white" font-family="Arial, sans-serif" font-size="24">Prototype the entire app, flows, and exports in one place.</text>
  </svg>
`)

export const placeholderAsset: AssetItem = {
  id: 'asset-hero',
  name: 'Hero Artwork',
  kind: 'image',
  src: `data:image/svg+xml;charset=utf-8,${svgCard}`,
  mimeType: 'image/svg+xml',
}

export const createNode = (
  type: DesignNodeType,
  partial: Partial<DesignNode> = {},
): DesignNode => ({
  id: partial.id ?? crypto.randomUUID(),
  name:
    partial.name ??
    ({
      text: 'Text',
      button: 'Button',
      image: 'Image',
      shape: 'Shape',
    })[type],
  type,
  x: partial.x ?? 24,
  y: partial.y ?? 24,
  width: partial.width ?? (type === 'text' ? 240 : type === 'button' ? 180 : 160),
  height: partial.height ?? (type === 'text' ? 40 : type === 'button' ? 56 : 120),
  text:
    partial.text ??
    ({
      text: 'Headline',
      button: 'Continue',
      image: '',
      shape: '',
    })[type],
  fill:
    partial.fill ??
    ({
      text: 'transparent',
      button: '#7C3AED',
      image: '#E2E8F0',
      shape: '#0F172A',
    })[type],
  foreground:
    partial.foreground ??
    ({
      text: '#F8FAFC',
      button: '#FFFFFF',
      image: '#0F172A',
      shape: '#FFFFFF',
    })[type],
  fontSize: partial.fontSize ?? (type === 'text' ? 30 : 16),
  fontWeight: partial.fontWeight ?? (type === 'text' ? 700 : 600),
  radius: partial.radius ?? (type === 'button' ? 18 : type === 'shape' ? 24 : 20),
  assetId: partial.assetId,
  action: partial.action,
})

export const createScreen = (name = 'New Screen'): Screen => ({
  id: crypto.randomUUID(),
  name,
  background: '#020617',
  nodes: [],
})

export const createComponentPreset = (preset: 'hero' | 'cta' | 'card'): DesignNode[] => {
  if (preset === 'hero') {
    return [
      createNode('text', {
        name: 'Hero Title',
        text: 'Design your whole app in one canvas',
        x: 28,
        y: 48,
        width: 320,
        height: 80,
        fontSize: 32,
      }),
      createNode('text', {
        name: 'Hero Subtitle',
        text: 'Create screens, assets, flows, and export starter code for Apple and Android stacks.',
        x: 28,
        y: 136,
        width: 320,
        height: 72,
        fontSize: 17,
        fontWeight: 500,
        foreground: '#CBD5E1',
      }),
      createNode('button', {
        name: 'Primary CTA',
        text: 'Build Prototype',
        x: 28,
        y: 236,
        width: 186,
      }),
    ]
  }

  if (preset === 'cta') {
    return [
      createNode('shape', {
        name: 'CTA Card',
        x: 24,
        y: 340,
        width: 342,
        height: 164,
        fill: '#111827',
        radius: 28,
      }),
      createNode('text', {
        name: 'CTA Heading',
        text: 'Ship design + code together',
        x: 48,
        y: 372,
        width: 270,
        height: 40,
        fontSize: 24,
      }),
      createNode('text', {
        name: 'CTA Copy',
        text: 'Preview interactions, tune tokens, then export the generated project files.',
        x: 48,
        y: 422,
        width: 270,
        height: 54,
        fontSize: 15,
        fontWeight: 500,
        foreground: '#CBD5E1',
      }),
      createNode('button', {
        name: 'CTA Action',
        text: 'Open Exporter',
        x: 48,
        y: 486,
        width: 156,
        fill: '#06B6D4',
      }),
    ]
  }

  return [
    createNode('shape', {
      name: 'Card Background',
      x: 28,
      y: 550,
      width: 334,
      height: 160,
      fill: '#172554',
      radius: 26,
    }),
    createNode('text', {
      name: 'Card Title',
      text: 'Pattern library',
      x: 48,
      y: 576,
      width: 240,
      height: 34,
      fontSize: 22,
    }),
    createNode('text', {
      name: 'Card Copy',
      text: 'Reuse component-style blocks to speed up concepting and exports.',
      x: 48,
      y: 620,
      width: 240,
      height: 48,
      fontSize: 15,
      fontWeight: 500,
      foreground: '#BFDBFE',
    }),
  ]
}

export const createSampleDocument = (): DesignDocument => {
  const home = createScreen('Home')
  const details = createScreen('Details')

  home.background = '#020617'
  details.background = '#0F172A'

  home.nodes = [
    createNode('image', {
      name: 'Hero Artwork',
      x: 24,
      y: 48,
      width: 342,
      height: 192,
      assetId: placeholderAsset.id,
      radius: 28,
    }),
    createNode('text', {
      name: 'Headline',
      text: 'Prototype, connect, and export your app',
      x: 24,
      y: 280,
      width: 300,
      height: 78,
      fontSize: 34,
    }),
    createNode('text', {
      name: 'Body',
      text: 'Use the editor like Figma: place assets, wire arrows between screens, preview flows, and generate starter code.',
      x: 24,
      y: 372,
      width: 320,
      height: 88,
      fontSize: 16,
      fontWeight: 500,
      foreground: '#CBD5E1',
    }),
    createNode('button', {
      name: 'Next Screen Button',
      text: 'Open details',
      x: 24,
      y: 490,
      width: 176,
      action: {
        type: 'navigate',
        targetScreenId: details.id,
        transition: 'push',
      },
    }),
    createNode('button', {
      name: 'Export Button',
      text: 'Review export',
      x: 214,
      y: 490,
      width: 152,
      fill: '#06B6D4',
      action: {
        type: 'navigate',
        targetScreenId: details.id,
        transition: 'fade',
      },
    }),
  ]

  details.nodes = [
    createNode('text', {
      name: 'Details Title',
      text: 'Generated app project',
      x: 24,
      y: 96,
      width: 280,
      height: 40,
      fontSize: 32,
    }),
    createNode('text', {
      name: 'Details Copy',
      text: 'Each export creates SwiftUI, Swift, Metal, and Jetpack Compose starter files from the same canonical model.',
      x: 24,
      y: 154,
      width: 312,
      height: 80,
      fontSize: 16,
      fontWeight: 500,
      foreground: '#CBD5E1',
    }),
    createNode('shape', {
      name: 'Status Card',
      x: 24,
      y: 266,
      width: 342,
      height: 220,
      fill: '#1E293B',
      radius: 26,
    }),
    createNode('text', {
      name: 'Status Title',
      text: 'Included in export',
      x: 48,
      y: 296,
      width: 220,
      height: 32,
      fontSize: 22,
    }),
    createNode('text', {
      name: 'Status Bullet 1',
      text: '• App entry and navigation router',
      x: 48,
      y: 346,
      width: 250,
      height: 26,
      fontSize: 15,
      fontWeight: 500,
      foreground: '#E2E8F0',
    }),
    createNode('text', {
      name: 'Status Bullet 2',
      text: '• Screen and component source files',
      x: 48,
      y: 378,
      width: 250,
      height: 26,
      fontSize: 15,
      fontWeight: 500,
      foreground: '#E2E8F0',
    }),
    createNode('text', {
      name: 'Status Bullet 3',
      text: '• Theme tokens and asset manifest',
      x: 48,
      y: 410,
      width: 250,
      height: 26,
      fontSize: 15,
      fontWeight: 500,
      foreground: '#E2E8F0',
    }),
    createNode('button', {
      name: 'Back Home',
      text: 'Back home',
      x: 24,
      y: 534,
      width: 144,
      fill: '#334155',
      action: {
        type: 'navigate',
        targetScreenId: home.id,
        transition: 'modal',
      },
    }),
  ]

  return {
    id: crypto.randomUUID(),
    name: 'AppForge Studio',
    description:
      'Visual app builder for designing screens, assets, flows, and export-ready starter code.',
    updatedAt: new Date().toISOString(),
    screens: [home, details],
    assets: [placeholderAsset],
    tokens: [
      { id: crypto.randomUUID(), name: 'Primary', value: '#7C3AED', category: 'color' },
      { id: crypto.randomUUID(), name: 'Accent', value: '#06B6D4', category: 'color' },
      { id: crypto.randomUUID(), name: 'Surface', value: '#0F172A', category: 'color' },
      { id: crypto.randomUUID(), name: 'Radius LG', value: '24', category: 'radius' },
      { id: crypto.randomUUID(), name: 'Space MD', value: '24', category: 'spacing' },
    ],
    exportSettings: {
      appName: 'AppForgeStudio',
      bundleId: 'com.gitdeveloper.appforge',
      swiftModuleName: 'AppForgeStudio',
      androidPackageName: 'com.gitdeveloper.appforge',
      primaryTarget: 'swiftui',
    },
  }
}

export const SCREEN_SIZE = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
}
