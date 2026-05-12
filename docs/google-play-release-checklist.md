# Google Play Release Checklist

## App Identity

- App name: Midnight
- Android package: `com.jacob.midnight`
- Version: `1.0.0`
- Version code: `1`
- App category: Productivity or Lifestyle

Change the Android package before the first Play Store upload if you want a different permanent app ID. Google Play package names cannot be changed after the app is published.

## Privacy And Data Safety

- Publish a public privacy policy URL.
- Use `docs/privacy-policy-draft.md` as the starting copy.
- In Google Play Data Safety, current app behavior is local-first with no account, no analytics SDK, no ads SDK, and no server upload.
- Local notifications are optional reminders. Verify the Android notification permission prompt and disclose notification behavior in the store listing if needed.
- Update privacy answers before adding AI coaching, cloud sync, analytics, accounts, subscriptions, or support forms.

## Store Assets

- Final app icon and adaptive icon.
- Feature graphic.
- Phone screenshots for key screens: Home, Plan, Quest Queue, Rank, Awards, Insights, Settings.
- Short description.
- Full description.
- Support email.

## Release Checks

- `npx tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run check`
- If the native Android folder is not present, run `npx expo prebuild --platform android` first.
- `cd android && .\gradlew.bat :app:processReleaseManifest :app:compileReleaseKotlin --console=plain --no-daemon`
- Test fresh install.
- Test backup export/import.
- Test archive restore/clear.
- Test reminder permission request, enable/disable, and each reminder slot.
- Test midnight evaluation flow.
- Test dark and light theme.
- Verify dev-only tools are hidden in release builds.

## Signing

- Configure production release signing before uploading to Google Play.
- The checked native Android release build still uses the generated debug keystore unless you replace it or build through a managed signing flow.
