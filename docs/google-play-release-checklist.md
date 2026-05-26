# Google Play Release Checklist

## App Identity

- App name: Midnight
- Android package: `com.jacob.midnight`
- Version: `1.0.0`
- Version code: `1`
- App category: Productivity or Lifestyle

Change the Android package before the first Play Store upload if you want a different permanent app ID. Google Play package names cannot be changed after the app is published.

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
- Phone screenshots for key screens: Home, Plan, Quest Queue, Rank, Awards, Insights, Settings.
- Short description.
- Full description.
- Use `docs/google-play-store-listing-draft.md` as starting copy.
- Support email.

## Release Checks

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run check`
- Confirm the submitted Android build targets Android 15 / API level 35 or higher.
- If the native Android folder is not present, run `npx expo prebuild --platform android` first.
- `cd android && .\gradlew.bat :app:processReleaseManifest :app:compileReleaseKotlin --console=plain --no-daemon`
- `eas build --platform android --profile preview`
- `eas build --platform android --profile production`
- Upload the internal/closed testing build first and review Play Console warnings before production.
- Test fresh install.
- Test backup export/import.
- Confirm backup export/import preserves reminder preferences.
- Test importing a backup into an install that already has local progress, and confirm the replacement warning is clear.
- Test archive restore/clear.
- Test reminder permission request, enable/disable, and each reminder slot.
- Test Focus Sprint start, pause, reset, duration change, and quest completion.
- Test completing the same type of quest from Home and Focus Sprint, including achievement unlocks.
- Test Awards filters, next unlocks, selected award details, and new trophy progress.
- Test midnight evaluation flow.
- Test missed-day handling after a 1-day gap and a 2+ day gap.
- Test recurring quests: once, daily, weekdays, and weekly.
- Verify first-run onboarding and Guide explain quests, contracts, DR, ranks, and awards without outside context.
- Test dark and light theme.
- Verify dev-only tools are hidden in release builds.

## Signing

- Configure production release signing before uploading to Google Play.
- The checked native Android release build still uses the generated debug keystore unless you replace it or build through a managed signing flow.
