# AppForge Studio

A browser-based app prototyping workspace. Compose screens on a canvas, attach image assets, connect navigation flows, preview interactions, and export starter source for SwiftUI, Swift, Metal, and Jetpack Compose.

## Run locally

Requires **Node.js 22.18 or later**.

```bash
npm ci --ignore-scripts
npm run dev
```

Open the local Vite URL. The starter document uses fictional example content.

## Features

- Multi-screen visual editor with draggable text, buttons, shapes, and image layers.
- Hero, call-to-action, and card patterns; inspector controls for text, geometry, colors, and navigation targets.
- Image previews from supported uploads (up to 5 MiB) and explicit HTTP(S) image URLs.
- A prototype map and interactive screen preview.
- Manual browser save, JSON import/export, and validation before an imported document replaces the workspace.
- Generated-file previews and a single ZIP download that preserves the export's directories.
- Distinct native identifiers for screens with duplicate, numeric, or non-Latin titles; escaped source text and tokens.

## Save and import

**Save workspace** stores the current document in this browser profile. This is a manual save, not continuous autosave. Browser storage can be unavailable or full; the status bar reports failure. Download JSON to keep a portable backup. JSON imports are limited to 10 MiB and must contain the complete documented model in `src/types.ts`; malformed fields and unresolved navigation or asset references are rejected.

Image URLs are loaded by the browser from the URL you choose. Uploaded images remain in the document as data URLs. Blob URLs are not accepted because they cannot survive a later import or browser restart.

## Verify

```bash
npm run verify
```

This runs regression tests for import validation, native-source escaping, identifier collisions, fractional Compose geometry, and ZIP packaging, followed by lint and the TypeScript/Vite production build. GitHub Actions runs the same checks.

## Export scope

The output is **starter source**, not a complete Xcode or Android Studio project. SwiftUI exports contain app entry, screen views, routing, token helpers, and an asset manifest. Add image resources to your Xcode asset catalogue using the generated names. Compose image layers are placeholders to replace with your Android image loading strategy. Navigation currently switches the active screen; the transition choices are recorded in the design and transition metadata, but full native push stacks and modal presentation need integration work. Metal files are starter shaders.

The app exports its 390 × 844 design coordinates; adapt the generated layout for your target devices. Native compilation in Xcode/Android Studio remains a required integration check. The JavaScript regression suite and web build do not substitute for it.
