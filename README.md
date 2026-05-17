# Swimsy

A mobile swim tracking app built with React Native + Expo. Log swim workouts with detailed set breakdowns, per-rep intervals, per-25 effort/stroke tracking, and pull in data from Apple Health, Whoop, and (coming soon) Google Fitbit.

## Features

- **Workout Logging** - Log sets with groups, rounds, lines, stroke, pace chips based on your base 100 time
- **Per-Rep Details** - Drill into each rep to set intervals, effort (easy/moderate/fast/sprint), and stroke per 25
- **Photo Parsing** - Snap a photo of a whiteboard workout and parse it with OCR + on-device LLM (iOS 26)
- **Voice/Text Input** - Describe your workout and let the LLM parse it into structured sets
- **Quick Log** - Just enter total yardage and duration when you don't need set details
- **Benchmarks** - Track test sets, time trials, and custom metrics across workouts
- **Apple Health** - Pull swim workouts, HR, HRV, VO2 max, sleep from Apple Watch
- **Whoop** - Pull recovery, strain, HR zones, sleep, workout data via OAuth
- **Dashboard** - Weekly yardage, swim frequency dots, benchmark tables with trends
- **Dark Theme** - Full dark UI with floating pill tab bar

## Prerequisites

- Node.js 18+
- Xcode 26+ (for iOS builds and HealthKit/FoundationModels)
- An Apple device running iOS 15+ (iOS 26 for on-device LLM features)
- Expo CLI: `npm install -g expo-cli` (optional, can use `npx expo`)

## Quick Start (Expo Go)

This gets you running fast but without HealthKit or photo parsing (those need a native build).

```bash
git clone <repo-url>
cd swimsy
npm install
cp .env.example .env  # fill in your keys (optional for local-only mode)
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Full Setup (Native Build)

Required for Apple Health, Whoop, photo parsing, and on-device LLM.

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in your keys:

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_WHOOP_CLIENT_ID` | For Whoop | From [developer.whoop.com](https://developer.whoop.com) |
| `EXPO_PUBLIC_WHOOP_CLIENT_SECRET` | For Whoop | From Whoop developer dashboard |
| `EXPO_PUBLIC_SUPABASE_URL` | For cloud sync | From [supabase.com](https://supabase.com) (not yet active) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | For cloud sync | From Supabase project settings |

### 3. Install pods and build

```bash
cd ios && pod install && cd ..
npx expo run:ios --device
```

This builds the native app with HealthKit entitlements and custom Swift modules, then installs it on your connected device.

### 4. Whoop Setup

1. Create an app at [developer.whoop.com](https://developer.whoop.com)
2. Set redirect URI to `swimsy://auth/whoop`
3. Enable scopes: `read:recovery`, `read:sleep`, `read:workout`, `read:body_measurement`, `read:profile`
4. Add your Client ID and Secret to `.env`
5. In the app: Settings > Whoop > Connect

### 5. Apple Health

After installing the native build, go to Settings > Apple Health > Connect. Grant access to the requested health categories. Swim data from Apple Watch will auto-populate on workout detail screens.

## Project Structure

```
swimsy/
├── app/                        # Expo Router screens
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab layout with PillTabBar
│   │   ├── index.tsx           # Dashboard
│   │   ├── log.tsx             # Log/edit workout
│   │   ├── history.tsx         # Workout history
│   │   └── settings.tsx        # Settings & integrations
│   ├── workout/[id].tsx        # Workout detail view
│   └── _layout.tsx             # Root stack layout
├── components/
│   ├── SetEntry.tsx             # Set card with groups, lines, rounds
│   ├── RepDetailModal.tsx       # Per-rep interval & effort editor
│   ├── FeelingSlider.tsx        # 1-10 feeling score
│   ├── BenchmarkEntry.tsx       # Benchmark input (test set, TT, custom)
│   ├── TimeInput.tsx            # m:ss time input
│   └── PillTabBar.tsx           # Floating pill tab bar + FAB
├── lib/
│   ├── storage.ts               # AsyncStorage CRUD + settings
│   ├── types.ts                 # TypeScript types
│   ├── theme.ts                 # Color palette
│   ├── healthkit.ts             # Apple HealthKit bridge (JS side)
│   ├── whoop.ts                 # Whoop API client + OAuth
│   ├── workoutParser.ts         # OCR + LLM parsing (JS side)
│   └── supabase.ts              # Supabase client (for future cloud sync)
├── modules/
│   ├── healthkit-bridge/ios/    # Native Swift HealthKit module
│   └── workout-parser/ios/     # Native Swift OCR + FoundationModels module
├── supabase/migrations/         # SQL schema (for future cloud sync)
└── ios/                         # Native iOS project
```

## Data Storage

All data is stored locally on-device via AsyncStorage. Key data:

- **Workouts** - Sets with groups (rounds + lines), per-rep details (intervals, per-25 effort/stroke), feeling score, notes, benchmarks
- **Settings** - Default pool, base 100 pace
- **Whoop tokens** - OAuth access/refresh tokens

Cloud sync via Supabase is scaffolded but not yet active.

## Key Concepts

### Set Structure

A workout has **sets**. Each set has **groups**. Each group has **rounds** (how many times through) and **lines** (individual swims).

```
Set 1:
  Group A (2x through):     ← rounds = 2
    1 x 25 free              ← line
    1 x 50 free              ← line
    1 x 75 free              ← line
  Group B (1x through):     ← rounds = 1
    1 x 100 free (easy)      ← line
```

This means: swim 25, 50, 75, 25, 50, 75, then 100 easy.

### Per-Rep Details

Each rep in a set can have:
- Custom interval (different from the set interval)
- Per-25 effort breakdown (easy/moderate/fast/sprint)
- Per-25 stroke selection

### Pace Chips

Base 100 pace is set in Settings. Pace chips show intervals relative to base: -10, -5, base, +5, +10, +15, +20. These scale proportionally to the distance.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test on a real device (many features require native builds)
5. Submit a PR

## License

MIT
