# Midnight

Midnight is a daily discipline tracker built with Expo and React Native.

The app turns everyday tasks into a focused daily run:

- complete quests before midnight
- protect up to three contract quests
- earn category XP
- build Discipline Rating and ranks
- unlock awards from lifetime progress and streaks
- archive quests instead of losing them
- schedule quests as once, daily, weekdays, or weekly
- review momentum through rank, weekly insights, and next-day plans
- get local coaching prompts based on quest load and recent patterns
- export or import a JSON backup from Settings

## Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run start
```

Run checks:

```bash
npm run typecheck
npm run lint
npm run check
```

## Android Release Notes

The Android package is currently `com.jacob.midnight` with version code `1`.
Change this package before the first Google Play upload if you want a different
permanent app ID.

Release planning docs:

- `docs/google-play-release-checklist.md`
- `docs/google-play-store-listing-draft.md`
- `docs/privacy-policy-draft.md`

Build profiles are defined in `eas.json`:

- `eas build --platform android --profile preview` creates an internal APK.
- `eas build --platform android --profile production` creates a Google Play AAB.
