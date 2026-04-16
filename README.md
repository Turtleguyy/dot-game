# Dot Game

A modern, touch-friendly version of Dots and Boxes built with Expo + React Native.

## Features

- Fast, pass-and-play local multiplayer
- Live player settings (name and color updates)
- Game settings section with restart-required options
- Optional solid perimeter start mode
- Drag preview and animated line placement
- Winner modal flow and restart controls
- Web export support (Netlify-ready)

## Tech Stack

- Expo (SDK 54)
- React Native
- TypeScript

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Run in development

```bash
npm run start
```

Then open in Expo Go (iOS/Android) or run:

```bash
npm run ios
npm run android
npm run web
```

## Scripts

- `npm run start` - Start Expo dev server
- `npm run ios` - Launch iOS target
- `npm run android` - Launch Android target
- `npm run web` - Run web dev server
- `npm run typecheck` - Run TypeScript checks
- `npm test` - Run engine tests

## Build and Deploy

### Web (Netlify)

This repo includes:

- `netlify.toml` (build + publish config)
- `public/_redirects` (SPA fallback)

Build command:

```bash
npx expo export -p web
```

Output directory: `dist`

### App Stores (iOS/Android)

Use EAS Build + EAS Submit:

```bash
eas build -p ios --profile production
eas build -p android --profile production
```

## License

MIT - see `LICENSE`.
