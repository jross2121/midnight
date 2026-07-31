# Google Play Release Checklist

## App Identity

- App name: Midnight
- Android package: `com.jacobross.midnight`
- Version: `1.0.3`
- Version code: `4`
- App category: Productivity or Lifestyle
- Release source of truth: managed Expo/EAS using `app.json` and `eas.json`

Change the Android package before the first Play Store upload if you want a different permanent app ID. Google Play package names cannot be changed after the app is published.

The local `android/` folder is generated/native output and is ignored by git. Use EAS managed builds for release unless you intentionally switch to a committed native Android workflow.

## Privacy And Data Safety

- Publish a public privacy policy URL before creating the production listing.
- Use `docs/privacy-policy-draft.md` as the starting copy.
- Use `docs/google-play-data-safety-draft.md` as the starting Data Safety answer sheet.
- The privacy policy must be publicly accessible, non-editable, not a PDF, and include the developer/contact entity used on the store listing.
- Add the same privacy policy URL to Play Console and make sure the app has either an in-app privacy policy link or in-app privacy policy text.
- In Google Play Data Safety, current app behavior is local-first with no account, no analytics SDK, no ads SDK, and no server upload.
- Data Safety should still disclose local device storage, optional local notifications, manual backup export/import, and included SDK behavior.
- Local notifications are optional reminders. Verify the Android notification permission prompt and disclose notification behavior in the store listing.
- Update privacy answers before adding AI coaching, cloud sync, analytics, accounts, subscriptions, or support forms.

## Store Assets

- Final app icon and adaptive icon.
- Feature graphic.
- Phone screenshots for key screens: Today, Plan, Progress, Player Card, Awards, and Settings.
- Short description.
- Full description.
- Use `docs/google-play-store-listing-draft.md` as starting copy.
- Support email.

## Release Checks

- `npm.cmd run check`
- `npx.cmd expo-doctor`
- Complete the current phone pass in `docs/phase-6-qa.md`.
- Confirm the submitted Android build targets Android 16 / API level 36 or higher. Expo SDK 54 currently targets API 36.
- For the managed EAS release path, do not rely on the ignored local `android/` folder as the release source.
- If switching to a committed native workflow later, regenerate/commit `android/`, configure production signing, then run `cd android && .\gradlew.bat :app:processReleaseManifest :app:compileReleaseKotlin --console=plain --no-daemon`.
- `eas build --platform android --profile preview`
- `eas build --platform android --profile production`
- Upload the internal/closed testing build first and review Play Console warnings before production.
- Test fresh install.
- Test an upgrade over a profile with existing data.
- Test backup export/import.
- Test Copy backup, Share backup, the raw backup preview, and Restore on a physical phone.
- Confirm backup export/import preserves reminder preferences.
- Test importing a backup into an install that already has local progress, and confirm the replacement warning is clear.
- Test archive restore/clear.
- Test reminder permission request, enable/disable, and each reminder slot.
- Test Focus Sprint start, pause, reset, duration change, and quest completion.
- Test completing the same type of quest from Today and Focus Sprint, including Award unlocks and same-day undo.
- Test Awards filters, next unlocks, selected Award details, equip flow, and collection progress.
- Test midnight evaluation flow.
- Test missed-day handling after a 1-day gap and a 2+ day gap.
- Test recurring quests: once, daily, weekdays, and weekly.
- Test Recovery Day arm, cancel, cooldown, midnight freeze, and XP behavior.
- Test daily reflection save, edit, removal, rollover, export, and import.
- Verify reminder taps open Plan or Today as described and cannot bypass onboarding after a profile reset.
- Verify first-run onboarding and Guide explain quests, contracts, DR, ranks, and Awards without outside context.
- Test with TalkBack, Android Reduce Motion, and a large system font size.
- Test dark and light theme.
- Verify dev-only tools are hidden in release builds.

## Signing

- Configure production release signing before uploading to Google Play.
- The checked native Android release build still uses the generated debug keystore unless you replace it or build through a managed signing flow.
