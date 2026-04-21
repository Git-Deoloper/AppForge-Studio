import type { DesignDocument, DesignNode, ExportTarget, GeneratedFile, Screen } from './types'

const indent = (level: number) => '  '.repeat(level)
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const slugify = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('') || 'Screen'

const swiftScreenName = (screen: Screen) => `${slugify(screen.name)}Screen`
const composeScreenName = (screen: Screen) => `${slugify(screen.name)}Screen`

const findRoute = (document: DesignDocument, targetScreenId: string) =>
  document.screens.find((screen) => screen.id === targetScreenId)

const renderSwiftNode = (document: DesignDocument, node: DesignNode) => {
  const position = `.frame(width: ${node.width}, height: ${node.height})\n${indent(3)}.position(x: ${Math.round(
    node.x + node.width / 2,
  )}, y: ${Math.round(node.y + node.height / 2)})`

  if (node.type === 'text') {
    return `${indent(2)}Text("${escapeText(node.text)}")\n${indent(3)}.font(.system(size: ${node.fontSize}, weight: .${
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

  const action =
    node.action?.type === 'navigate'
      ? `.onTapGesture { router.go(to: .${slugify(findRoute(document, node.action.targetScreenId)?.name ?? 'Home').replace(/^./, (c) => c.toLowerCase())}) }`
      : ''

  return `${indent(2)}Button {\n${indent(3)}${
    node.action?.type === 'navigate'
      ? `router.go(to: .${slugify(findRoute(document, node.action.targetScreenId)?.name ?? 'Home').replace(/^./, (c) => c.toLowerCase())})`
      : '// Action placeholder'
  }\n${indent(2)}} label: {\n${indent(3)}Text("${escapeText(node.text)}")\n${indent(4)}.font(.system(size: ${node.fontSize}, weight: .semibold))\n${indent(4)}.foregroundStyle(Color(hex: "${node.foreground}"))\n${indent(4)}.frame(maxWidth: .infinity, maxHeight: .infinity)\n${indent(2)}}\n${indent(3)}.buttonStyle(.plain)\n${indent(3)}.background(Color(hex: "${node.fill}"))\n${indent(3)}.clipShape(RoundedRectangle(cornerRadius: ${node.radius}))\n${indent(3)}${position}${action}`
}

const renderComposeNode = (document: DesignDocument, node: DesignNode) => {
  const modifier = `Modifier\n${indent(4)}.absoluteOffset(x = ${node.x}.dp, y = ${node.y}.dp)\n${indent(4)}.size(${node.width}.dp, ${node.height}.dp)`

  if (node.type === 'text') {
    return `${indent(2)}Text(\n${indent(3)}text = "${escapeText(node.text)}",\n${indent(3)}color = Color(0xFF${node.foreground.replace('#', '')}),\n${indent(3)}fontSize = ${node.fontSize}.sp,\n${indent(3)}fontWeight = FontWeight.${node.fontWeight >= 700 ? 'Bold' : 'Medium'},\n${indent(3)}modifier = ${modifier}\n${indent(2)})`
  }

  if (node.type === 'image') {
    return `${indent(2)}Box(\n${indent(3)}modifier = ${modifier}\n${indent(4)}.clip(RoundedCornerShape(${node.radius}.dp))\n${indent(4)}.background(Color(0xFF${node.fill.replace('#', '')}))\n${indent(2)}) {\n${indent(3)}Text("${escapeText(node.name)} asset", color = Color.White, modifier = Modifier.align(Alignment.Center))\n${indent(2)}}`
  }

  if (node.type === 'shape') {
    return `${indent(2)}Box(\n${indent(3)}modifier = ${modifier}\n${indent(4)}.clip(RoundedCornerShape(${node.radius}.dp))\n${indent(4)}.background(Color(0xFF${node.fill.replace('#', '')}))\n${indent(2)})`
  }

  const target = findRoute(document, node.action?.targetScreenId ?? '')

  return `${indent(2)}Button(\n${indent(3)}onClick = { ${target ? `onNavigate("${slugify(target.name)}")` : ''} },\n${indent(3)}modifier = ${modifier},\n${indent(3)}shape = RoundedCornerShape(${node.radius}.dp),\n${indent(3)}colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF${node.fill.replace('#', '')}))\n${indent(2)}) {\n${indent(3)}Text("${escapeText(node.text)}", color = Color(0xFF${node.foreground.replace('#', '')}))\n${indent(2)}}`
}

const screenToSwiftFile = (document: DesignDocument, screen: Screen) => `import SwiftUI

struct ${swiftScreenName(screen)}View: View {
  @EnvironmentObject private var router: AppRouter

  var body: some View {
    ZStack {
      Color(hex: "${screen.background}").ignoresSafeArea()
${screen.nodes.map((node) => renderSwiftNode(document, node)).join('\n\n')}
    }
    .navigationTitle("${escapeText(screen.name)}")
    .navigationBarTitleDisplayMode(.inline)
  }
}
`

const screenToComposeFile = (document: DesignDocument, screen: Screen) => `package ${document.exportSettings.androidPackageName}.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
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
fun ${composeScreenName(screen)}(
  onNavigate: (String) -> Unit,
) {
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color(0xFF${screen.background.replace('#', '')})),
  ) {
${screen.nodes.map((node) => renderComposeNode(document, node)).join('\n\n')}
  }
}
`

export const generateFiles = (document: DesignDocument): GeneratedFile[] => {
  const routeCases = document.screens
    .map((screen) => `    case ${slugify(screen.name).replace(/^./, (c) => c.toLowerCase())}`)
    .join('\n')

  const routeSwitch = document.screens
    .map(
      (screen) =>
        `      case .${slugify(screen.name).replace(/^./, (c) => c.toLowerCase())}:\n        ${swiftScreenName(screen)}View()`,
    )
    .join('\n')

  const swiftAppName = slugify(document.exportSettings.appName)
  const primaryRoute = slugify(document.screens[0]?.name ?? 'Home').replace(/^./, (c) => c.toLowerCase())

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
  .map((token) => `  static let ${slugify(token.name).replace(/^./, (c) => c.toLowerCase())} = "${token.value}"`)
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
    path: `${swiftAppName}/Screens/${swiftScreenName(screen)}View.swift`,
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

let generatedDesignJSON = """
${JSON.stringify(
  {
    name: document.name,
    description: document.description,
    screens: document.screens.map((screen) => ({
      name: screen.name,
      background: screen.background,
    })),
  },
  null,
  2,
)}
"""
`,
    },
    {
      platform: 'swift',
      path: `${swiftAppName}/Support/PrototypeTransitions.swift`,
      description: 'Action mapping generated from the prototype graph.',
      content: `import Foundation

enum PrototypeTransition: String {
${document.screens
  .flatMap((screen) =>
    screen.nodes
      .filter((node) => node.action?.type === 'navigate')
      .map(
        (node) =>
          `  case ${slugify(`${screen.name}-${node.name}`).replace(/^./, (c) => c.toLowerCase())} = "${screen.name} -> ${findRoute(document, node.action?.targetScreenId ?? '')?.name ?? 'Unknown'}"`,
      ),
  )
  .join('\n')}
}
`,
    },
  ]

  const composeFiles: GeneratedFile[] = [
    {
      platform: 'jetpack-compose',
      path: `android/${swiftAppName}/MainActivity.kt`,
      description: 'Jetpack Compose entry point and basic nav host.',
      content: `package ${document.exportSettings.androidPackageName}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import ${document.exportSettings.androidPackageName}.screens.*

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      val route = remember { mutableStateOf("${slugify(document.screens[0]?.name ?? 'Home')}") }
      when (route.value) {
${document.screens
  .map(
    (screen) => `        "${slugify(screen.name)}" -> ${composeScreenName(screen)} { route.value = it }`,
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
      path: `android/${swiftAppName}/screens/${composeScreenName(screen)}.kt`,
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
