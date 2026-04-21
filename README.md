# AppForge Studio

AppForge Studio is a browser-based starter for a Figma-like app design tool. It lets you compose screens on a canvas, attach assets, wire navigation flows with arrows, preview the interaction model, and generate starter files for SwiftUI, Swift, Metal, and Jetpack Compose.

## Features

- multi-screen visual editor with draggable layers
- component-pattern insertion for hero, CTA, and card blocks
- asset library with URL and file uploads
- inspector for styling, copy, geometry, and navigation targets
- prototype flow map with arrow links between screens
- live preview frame that follows button navigation
- canonical JSON document model with save, import, and export
- generated file previews plus one-click downloads for SwiftUI, Swift, Metal, and Jetpack Compose outputs

## Getting started

```bash
npm install
npm run dev
```

Open the local Vite URL in your browser.

## Build and lint

```bash
npm run build
npm run lint
```

## Export notes

The generated files are starter outputs based on the current design document. The SwiftUI export includes app entry, navigation, screen views, design tokens, and an asset manifest that can be dropped into an Xcode project and extended from there. Jetpack Compose, Swift, and Metal outputs are also generated from the same model.
