# Phase 2 QA Tracker

Use this file as the working QA record before any preview or production build.

## Workspace Baseline

- [x] `npm run check` passes.
- [x] Android package source of truth is `com.jacobross.midnight` in `app.json`.
- [x] Managed EAS release path is documented in README and release checklist.
- [x] No tracked references to `com.jacob.midnight` remain.
- [x] No visible StatLife/react-template text references found in app files.
- [x] Dev reset controls found only behind `__DEV__`.
- [x] Pure logic tests cover date validation, DST boundaries, recurrence, DR thresholds, quest completion idempotency, contracts, missed days, and one-time quest archival.
- [x] Main profile writes use one serialized storage boundary; midnight profile/history/marker writes use one batch.

## Phone QA

- [ ] Fresh install shows onboarding.
- [ ] Completing onboarding routes to Home tabs.
- [ ] Closing and reopening the app skips onboarding after completion.
- [ ] Fresh profile starts with no demo quests, XP, DR history, or unlocked awards.
- [ ] Existing saved data loads without reset.
- [ ] Home can add a quest.
- [ ] Home can edit title, category, target, difficulty, and recurrence.
- [ ] Home can complete a quest and update XP/achievements.
- [ ] Home enforces the 3-contract limit.
- [ ] Home archives a deleted quest.
- [ ] Plan shows the next 7 days.
- [ ] Plan recurrence works for once, daily, weekdays, and weekly quests.
- [ ] Plan pause/resume respects the 10-active-quests-per-day limit.
- [ ] Archive restore respects the 10-active-quests-per-day limit.
- [ ] Focus Sprint can start, pause, reset, change duration, and complete a quest.
- [ ] Focus Sprint keeps accurate time after backgrounding and resuming the app.
- [ ] Completing the same quest type from Home and Focus Sprint does not double-award incorrectly.
- [ ] Rank screen persists DR, rank, and equipped badges.
- [ ] Awards filters, selected award detail, and equip flow work.
- [ ] Insights empty/locked state is understandable before enough history.
- [ ] Settings theme toggle works and persists.
- [ ] Settings export generates valid JSON.
- [ ] Import warns before replacing data.
- [ ] Import restores quests, stats, archive, history, badges, and reminders.
- [ ] Import rejects an unsupported backup version and normalizes invalid dates without crashing.
- [ ] Reminders permission request works.
- [ ] Reminder enable/disable works.
- [ ] Morning, contract, and next-move reminder slots save times.
- [ ] Midnight Evaluation appears after a 1-day gap.
- [ ] Missed-day handling works after a 2+ day gap.
- [ ] Dark theme has no text overlap or low-contrast critical controls.
- [ ] Light theme has no text overlap or low-contrast critical controls.
- [ ] Dev tools are hidden in a release/preview build.

## Notes

- Use the currently running phone Expo server for behavior QA if it is loading the app.
- Restart Expo before preview/release builds so app config changes are loaded fresh.
- Notification delivery and date-change behavior must be checked on a real Android device.
- Android Metro bundling completed locally, but Hermes bytecode generation could not be validated because this environment blocked the Hermes executable.
