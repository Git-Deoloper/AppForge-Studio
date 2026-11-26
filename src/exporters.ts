import type { DesignDocument, DesignNode, ExportTarget, GeneratedFile, Screen } from './types'

const indent = (level: number) => '  '.repeat(level)
// eslint-disable-next-line no-control-regex -- Source literals must escape control characters.
const escapeSwift = (value: string) => value.replace(/[\\"\u0000-\u001f\u007f]/g, character =>
  character === '\\' ? '\\\\' : character === '"' ? '\\"' : `\\u{${character.charCodeAt(0).toString(16)}}`,
)
// eslint-disable-next-line no-control-regex -- Source literals must escape control characters.
const escapeKotlin = (value: string) => value.replace(/[\\"$\u0000-\u001f\u007f]/g, character =>
  character === '\\' ? '\\\\' : character === '"' ? '\\"' : character === '$' ? '\\$' : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
)
const kotlinNumber = (value: number) => `${value}f`
const kotlinColor = (value: string) => value === 'transparent' ? 'Color.Transparent' : `Color(0xFF${value.replace('#', '')})`
const androidPackage = (value: string) => value.split('.').map(part => {
  const cleaned = part.replace(/[^a-zA-Z0-9_]/g, '_') || 'app'
  return /^[a-zA-Z_]/.test(cleaned) && !['class', 'package', 'fun', 'object', 'val', 'var', 'when', 'in', 'is', 'as', 'if', 'else', 'for', 'while', 'do', 'try', 'catch', 'throw', 'return', 'break', 'continue', 'interface', 'this', 'super', 'typealias', 'typeof', 'null', 'true', 'false'].includes(cleaned) ? cleaned : `pkg_${cleaned}`
}).join('.')
const slugify = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('').replace(/^(?=[0-9])/, 'Item') || 'Screen'

const screenIdentifier = (document: DesignDocument, screen: Screen) => `Screen${document.screens.indexOf(screen) + 1}${slugify(screen.name)}`
const swiftScreenName = screenIdentifier
const composeScreenName = screenIdentifier

const findRoute = (document: DesignDocument, targetScreenId: string) =>
  document.screens.find((screen) => screen.id === targetScreenId)

const routeName = (document: DesignDocument, targetScreenId: string) => {
  const screen = findRoute(document, targetScreenId) ?? document.screens[0]
  return screenIdentifier(document, screen).replace(/^./, character => character.toLowerCase())
}

const renderSwiftNode = (document: DesignDocument, node: DesignNode) => {
  const position = `.frame(width: ${node.width}, height: ${node.height})\n${indent(3)}.position(x: ${Math.round(
    node.x + node.width / 2,
  )}, y: ${Math.round(node.y + node.height / 2)})`

  if (node.type === 'text') {
    return `${indent(2)}Text("${escapeSwift(node.text)}")\n${indent(3)}.font(.system(size: ${node.fontSize}, weight: .${
      node.fontWeight >= 700 ? 'bold' : 'medium'
    }))\n${indent(3)}.foregroundStyle(Color(hex: "${node.foreground}"))\n${indent(3)}${position}`
  }

  if (node.type === 'image') {
    const assetName = document.assets.find((asset) => asset.id === node.assetId)?.name ?? node.name

    return `${indent(2)}RoundedRectangle(cornerRadius: ${node.radius})\n${indent(3)}.fill(Color(hex: "${node.fill}"))\n${indent(3)}.overlay(alignment: .center) {\n${indent(4)}Image("${slugify(assetName)}")\n${indent(5)}.resizable()\n${indent(5)}.scaledToFit()\n${indent(5)}.padding(18)\n${indent(3)}}\n${indent(3)}${position}`
  }

  if (node.type === 'shape') {
    return `${indent(2)}RoundedRectangle(cornerRadius: ${node.radius})\n${indent(3)}.fill(Color(hex: "${node.fill}"))\n${indent(3)}${position}`
  }

  return `${indent(2)}Button {
${indent(3)}${
    node.action?.type === 'navigate'
      ? `router.go(to: .${routeName(document, node.action.targetScreenId)})`
      : '// Action placeholder'
  }
${indent(2)}} label: {
${indent(3)}Text("${escapeSwift(node.text)}")
${indent(4)}.font(.system(size: ${node.fontSize}, weight: .semibold))
${indent(4)}.foregroundStyle(Color(hex: "${node.foreground}"))
${indent(4)}.frame(maxWidth: .infinity, maxHeight: .infinity)
${indent(2)}}
${indent(3)}.buttonStyle(.plain)
${indent(3)}.background(Color(hex: "${node.fill}"))
${indent(3)}.clipShape(RoundedRectangle(cornerRadius: ${node.radius}))
${indent(3)}${position}`
}

const renderComposeNode = (document: DesignDocument, node: DesignNode) => {
  const modifier = `Modifier\n${indent(4)}.absoluteOffset(x = ${kotlinNumber(node.x)}.dp, y = ${kotlinNumber(node.y)}.dp)\n${indent(4)}.size(${kotlinNumber(node.width)}.dp, ${kotlinNumber(node.height)}.dp)`

  if (node.type === 'text') {
    return `${indent(2)}Text(\n${indent(3)}text = "${escapeKotlin(node.text)}",\n${indent(3)}color = ${kotlinColor(node.foreground)},\n${indent(3)}fontSize = ${kotlinNumber(node.fontSize)}.sp,\n${indent(3)}fontWeight = FontWeight.${node.fontWeight >= 700 ? 'Bold' : 'Medium'},\n${indent(3)}modifier = ${modifier}\n${indent(2)})`
  }

  if (node.type === 'image') {
    return `${indent(2)}Box(\n${indent(3)}modifier = ${modifier}\n${indent(4)}.clip(RoundedCornerShape(${kotlinNumber(node.radius)}.dp))\n${indent(4)}.background(${kotlinColor(node.fill)})\n${indent(2)}) {\n${indent(3)}Text("${escapeKotlin(node.name)} asset", color = Color.White, modifier = Modifier.align(Alignment.Center))\n${indent(2)}}`
  }

  if (node.type === 'shape') {
    return `${indent(2)}Box(\n${indent(3)}modifier = ${modifier}\n${indent(4)}.clip(RoundedCornerShape(${kotlinNumber(node.radius)}.dp))\n${indent(4)}.background(${kotlinColor(node.fill)})\n${indent(2)})`
  }

  const target = findRoute(document, node.action?.targetScreenId ?? '')

  return `${indent(2)}Button(\n${indent(3)}onClick = { ${target ? `onNavigate("${screenIdentifier(document, target)}")` : ''} },\n${indent(3)}modifier = ${modifier},\n${indent(3)}shape = RoundedCornerShape(${kotlinNumber(node.radius)}.dp),\n${indent(3)}colors = ButtonDefaults.buttonColors(containerColor = ${kotlinColor(node.fill)})\n${indent(2)}) {\n${indent(3)}Text("${escapeKotlin(node.text)}", color = ${kotlinColor(node.foreground)})\n${indent(2)}}`
}

const screenToSwiftFile = (document: DesignDocument, screen: Screen) => `import SwiftUI

struct ${swiftScreenName(document, screen)}View: View {
  @EnvironmentObject private var router: AppRouter

  var body: some View {
    ZStack {
      Color(hex: "${screen.background}").ignoresSafeArea()
${screen.nodes.map((node) => renderSwiftNode(document, node)).join('\n\n')}
    }
    .navigationTitle("${escapeSwift(screen.name)}")
    .navigationBarTitleDisplayMode(.inline)
  }
}
`

const screenToComposeFile = (document: DesignDocument, screen: Screen) => `package ${androidPackage(document.exportSettings.androidPackageName)}.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ${composeScreenName(document, screen)}(
  onNavigate: (String) -> Unit,
) {
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(${kotlinColor(screen.background)}),
  ) {
${screen.nodes.map((node) => renderComposeNode(document, node)).join('\n\n')}
  }
}
`

export const generateFiles = (document: DesignDocument): GeneratedFile[] => {
  const routeCases = document.screens
    .map((screen) => `    case ${routeName(document, screen.id)}`)
    .join('\n')

  const routeSwitch = document.screens
    .map(
      (screen) =>
        `      case .${routeName(document, screen.id)}:\n        ${swiftScreenName(document, screen)}View()`,
    )
    .join('\n')

  const swiftAppName = slugify(document.exportSettings.appName)
  const primaryRoute = routeName(document, document.screens[0].id)

  const swiftUiFiles: GeneratedFile[] = [
    {
      platform: 'swiftui',
      path: `${swiftAppName}/${swiftAppName}App.swift`,
      description: 'App entry point for a drop-in SwiftUI target.',
      content: `import SwiftUI

@main
struct ${swiftAppName}App: App {
  @StateObject private var router = AppRouter(initial: .${primaryRoute})

  var body: some Scene {
    WindowGroup {
      NavigationStack {
        router.destination
      }
      .environmentObject(router)
    }
  }
}
`,
    },
    {
      platform: 'swiftui',
      path: `${swiftAppName}/Navigation/AppRouter.swift`,
      description: 'Navigation router generated from prototype links.',
      content: `import SwiftUI
import Combine

enum AppRoute {
${routeCases}
}

final class AppRouter: ObservableObject {
  @Published private(set) var current: AppRoute

  init(initial: AppRoute) {
    self.current = initial
  }

  func go(to route: AppRoute) {
    current = route
  }

  @ViewBuilder
  var destination: some View {
    switch current {
${routeSwitch}
    }
  }
}
`,
    },
    {
      platform: 'swiftui',
      path: `${swiftAppName}/Theme/Color+Hex.swift`,
      description: 'Color token helpers for generated SwiftUI code.',
      content: `import SwiftUI

extension Color {
  init(hex: String) {
    if hex == "transparent" { self = .clear; return }
    let cleaned = hex.replacingOccurrences(of: "#", with: "")
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)

    let red = Double((value >> 16) & 0xFF) / 255.0
    let green = Double((value >> 8) & 0xFF) / 255.0
    let blue = Double(value & 0xFF) / 255.0

    self.init(red: red, green: green, blue: blue)
  }
}
`,
    },
    {
      platform: 'swiftui',
      path: `${swiftAppName}/Theme/DesignTokens.swift`,
      description: 'Exported design tokens.',
      content: `import SwiftUI

enum DesignTokens {
${document.tokens
  .map((token, index) => `  static let token${index + 1}${slugify(token.name)} = "${escapeSwift(token.value)}"`)
  .join('\n')}
}
`,
    },
    {
      platform: 'swiftui',
      path: `${swiftAppName}/Assets/AssetsManifest.md`,
      description: 'Asset manifest for importing into Xcode asset catalogs.',
      content: document.assets
        .map((asset) => `- ${asset.name} (${asset.mimeType})`)
        .join('\n'),
    },
  ]

  const screenSwiftFiles = document.screens.map<GeneratedFile>((screen) => ({
    platform: 'swiftui',
    path: `${swiftAppName}/Screens/${swiftScreenName(document, screen)}View.swift`,
    description: `SwiftUI screen for ${screen.name}.`,
    content: screenToSwiftFile(document, screen),
  }))

  const swiftFiles: GeneratedFile[] = [
    {
      platform: 'swift',
      path: `${swiftAppName}/Support/GeneratedDesign.swift`,
      description: 'Platform-agnostic Swift data model for the design document.',
      content: `import Foundation

struct GeneratedDesignDocument: Decodable {
  let name: String
  let description: String
  let screens: [GeneratedScreen]
}

struct GeneratedScreen: Decodable {
  let name: String
  let background: String
}

let generatedDesignJSON = "${escapeSwift(JSON.stringify({
  name: document.name,
  description: document.description,
  screens: document.screens.map(screen => ({ name: screen.name, background: screen.background })),
}, null, 2))}"

`,
    },
    {
      platform: 'swift',
      path: `${swiftAppName}/Support/PrototypeTransitions.swift`,
      description: 'Action mapping generated from the prototype graph.',
      content: `import Foundation

struct PrototypeTransition {
  let source: String
  let node: String
  let target: String
  let style: String

  static let all: [PrototypeTransition] = [
${document.screens.flatMap(screen => screen.nodes.filter(node => node.action?.type === 'navigate').map(node =>
  `    PrototypeTransition(source: "${escapeSwift(screen.name)}", node: "${escapeSwift(node.name)}", target: "${escapeSwift(findRoute(document, node.action?.targetScreenId ?? '')?.name ?? 'Unknown')}", style: "${escapeSwift(node.action?.transition ?? 'push')}"),`,
)).join('\n')}
  ]
}

`,
    },
  ]

  const composeFiles: GeneratedFile[] = [
    {
      platform: 'jetpack-compose',
      path: `android/${swiftAppName}/MainActivity.kt`,
      description: 'Jetpack Compose entry point and basic nav host.',
      content: `package ${androidPackage(document.exportSettings.androidPackageName)}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import ${androidPackage(document.exportSettings.androidPackageName)}.screens.*

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      val route = remember { mutableStateOf("${screenIdentifier(document, document.screens[0])}") }
      when (route.value) {
${document.screens
  .map(
    (screen) => `        "${screenIdentifier(document, screen)}" -> ${composeScreenName(document, screen)} { route.value = it }`,
  )
  .join('\n')}
      }
    }
  }
}
`,
    },
    ...document.screens.map<GeneratedFile>((screen) => ({
      platform: 'jetpack-compose',
      path: `android/${swiftAppName}/screens/${composeScreenName(document, screen)}.kt`,
      description: `Jetpack Compose screen for ${screen.name}.`,
      content: screenToComposeFile(document, screen),
    })),
  ]

  const metalFiles: GeneratedFile[] = [
    {
      platform: 'metal',
      path: `${swiftAppName}/Rendering/PrototypeTransitions.metal`,
      description: 'Starter Metal shaders for advanced prototype transitions.',
      content: `#include <metal_stdlib>
using namespace metal;

struct VertexIn {
  float2 position [[attribute(0)]];
  float2 uv [[attribute(1)]];
};

struct VertexOut {
  float4 position [[position]];
  float2 uv;
};

vertex VertexOut prototypeVertex(VertexIn in [[stage_in]]) {
  VertexOut out;
  out.position = float4(in.position, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

fragment float4 prototypeFragment(VertexOut in [[stage_in]]) {
  return float4(in.uv.x, in.uv.y, 1.0 - in.uv.x, 1.0);
}
`,
    },
    {
      platform: 'metal',
      path: `${swiftAppName}/Rendering/RendererNotes.md`,
      description: 'Guide for wiring Metal-backed transitions into the generated SwiftUI app.',
      content: document.screens
        .flatMap((screen) =>
          screen.nodes
            .filter((node) => node.action?.type === 'navigate')
            .map(
              (node) =>
                `- ${screen.name}: ${node.name} uses ${node.action?.transition ?? 'push'} to ${findRoute(document, node.action?.targetScreenId ?? '')?.name ?? 'Unknown'}`,
            ),
        )
        .join('\n'),
    },
  ]

  const sharedFiles: GeneratedFile[] = [
    {
      platform: document.exportSettings.primaryTarget,
      path: 'design-document.json',
      description: 'Canonical design document used by all exporters.',
      content: JSON.stringify(document, null, 2),
    },
  ]

  return [...sharedFiles, ...swiftUiFiles, ...screenSwiftFiles, ...swiftFiles, ...composeFiles, ...metalFiles]
}

export const filterFilesByTarget = (files: GeneratedFile[], target: ExportTarget) =>
  files.filter((file) => file.platform === target || file.path === 'design-document.json')
