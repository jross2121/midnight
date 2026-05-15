# Google Play Data Safety Draft

Use this as a starting point when filling out the Play Console Data Safety form. Recheck every answer before submission, especially after adding accounts, cloud sync, analytics, ads, payments, subscriptions, remote AI, or support/contact forms.

## Current App Behavior

- No account system.
- No app-owned backend or server sync.
- No ads SDK.
- No analytics SDK.
- Quest, stats, award, archive, theme, reminder, and backup data are stored locally on the device.
- Manual backup export/import happens inside Settings. The app generates or reads JSON locally; the user controls whether that JSON is copied or shared outside the app.
- Optional reminders use local notifications. The app does not request or send Expo push tokens.

## Proposed Data Safety Answers

- Data collected by the developer: No, for the current local-only build.
- Data shared with third parties by the app: No, for the current local-only build.
- Data encrypted in transit: Not applicable while no user data is transmitted by the app.
- Users can request data deletion: No account deletion flow is needed because the app does not create accounts. Users can delete app data by uninstalling the app or clearing app storage in device settings.
- App has a privacy policy: Yes, after publishing the final public privacy policy URL.

## Local Data Types To Mention In Privacy Policy

- App activity: quests, completion state, schedules, Focus Sprint completion, archive, and manual backup JSON.
- App info and performance: no analytics collection in the current build.
- Personal info: not intentionally collected by the developer, but users may type personal details into quest titles or targets.
- Notifications: optional local reminders for planning, contracts, and next moves.

## SDK And Permission Notes

- `expo-notifications` is included for local reminders. Android builds may include notification and boot-completed permissions so scheduled reminders can work.
- `@react-native-async-storage/async-storage` stores app data locally.
- Re-run this review after adding any SDK that can transmit telemetry, identifiers, crash logs, payment data, or support messages.
