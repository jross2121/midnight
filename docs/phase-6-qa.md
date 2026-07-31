# Phase 6 Release QA

This is the current handoff for the full app journey. Automated checks cover the state rules; items below that depend on Android notifications, lifecycle timing, or visual inspection remain phone tests.

## Automated Baseline

- [x] TypeScript compilation passes.
- [x] Expo lint passes.
- [x] Logic tests cover 21 daily-lifecycle and safety scenarios.
- [x] Expo Doctor passes all 18 current project checks.
- [x] Metro and Hermes complete an Android production export (1,609 modules; 4.67 MB bytecode bundle in this validation run).
- [x] Dependency advisories have been reviewed. Current npm results are concentrated in the Expo/React Native tooling tree; clearing the full chain requires a controlled Expo SDK upgrade, not an unreviewed `npm audit fix --force`.
- [x] Future-dated reset metadata is normalized so a restored profile cannot stall rollover.
- [x] Unsupported notification routes are rejected, and valid reminder taps cannot bypass onboarding.
- [x] Quest completion is idempotent; same-day undo reverses its receipt-based rewards.
- [x] One-time scheduling, midnight rollover, missed days, Recovery Days, reflections, reminders, and contract consequences have regression coverage.
- [x] Backup export reads normalized evaluation history instead of failing on a damaged history entry.
- [x] Backup restore reports profile success separately from reminder scheduling failure.

## Fresh Start And Recovery

- [ ] A fresh install opens the two-step introduction and creates only the selected starter quests.
- [ ] Force-close and reopen after onboarding; the app opens Today without replaying setup.
- [ ] Reset Profile after exporting a backup; onboarding and the Today/Plan tutorials appear for the new profile.
- [ ] Reset Profile, then tap a previously scheduled notification; onboarding opens instead of Today or Plan.
- [ ] Deny or interrupt storage during onboarding if the test device permits it; setup stays on screen with a retry message.

## Daily Journey

- [ ] Add, edit, pin, duplicate, archive, restore, and complete a quest.
- [ ] Completion immediately changes XP, shows a receipt, and announces an Award when one unlocks.
- [ ] Undo from the receipt and reopen from the quest card; same-day XP and lifetime credit reverse once.
- [ ] Use **Do Tomorrow**; the copy is absent today, appears tomorrow, and remains a one-time quest.
- [ ] Save, edit, and remove a daily reflection; leave Today and return to confirm persistence.
- [ ] Complete a quest in Focus Sprint and undo it; Today shows the same result without double credit.
- [ ] Background and resume a running Focus Sprint; the remaining time is accurate.

## Plan, Midnight, And Progress

- [ ] Plan enforces ten active quests per day and three active contracts.
- [ ] Once, daily, weekdays, and weekly schedules appear on the correct seven-day plan dates.
- [ ] Arm and cancel a Recovery Day before midnight; the card and cooldown copy update.
- [ ] On an armed Recovery Day, quest XP counts while DR, both streaks, rank, and Awards remain frozen.
- [ ] Cross midnight with the app open; Midnight Evaluation appears once and starts a clean new board.
- [ ] Relaunch after a one-day gap and after a two-or-more-day gap; each date is scored exactly once.
- [ ] Progress shows the day-one baseline, then unlocks advanced patterns at the stated threshold.
- [ ] Player Card keeps rank identity and equipped Awards; Awards keeps collection progress and filters.

## Backups And Reminders

- [ ] Generate a backup, copy it outside the app, change the profile, then import it and verify quests, XP, DR, Awards, archive, reflections, Recovery Days, and history.
- [ ] Verify Copy backup, Share backup, raw backup preview, and Restore on a physical phone.
- [ ] Import malformed JSON and an unsupported backup version; existing data remains unchanged.
- [ ] Import a full backup with notifications denied; profile data restores and reminders clearly remain paused.
- [ ] Enable and disable each reminder slot and change every time across midnight and noon boundaries.
- [ ] Send a test reminder while the app is foregrounded, backgrounded, and closed.
- [ ] Tap Morning Plan and confirm Plan opens. Tap Contract Check or Next Move and confirm Today opens.
- [ ] Block notifications in Android settings; **Send Test Reminder** offers the system settings recovery path.

## Accessibility And Release Build

- [ ] With TalkBack, screen headings, tabs, quest checkboxes, expanded actions, switches, and completion announcements are understandable.
- [ ] Enable Android Reduce Motion; rank, DR, quest, and edit-sheet transitions stop animating.
- [ ] Check light and dark themes at default and large font sizes for clipping and contrast.
- [ ] Install the EAS preview APK as a clean install and as an upgrade over a profile with data.
- [ ] Confirm developer-only controls are absent in the preview and production builds.
- [ ] Build the production AAB and resolve every Play Console pre-launch warning before rollout.

## Environment Note

Automated validation does not replace the Samsung S24 phone pass. Notification delivery, tap routing, TalkBack, app backgrounding, tutorial geometry, native sharing, and true wall-clock midnight behavior require the physical-device checks above.
