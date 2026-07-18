const test = require("node:test");
const assert = require("node:assert/strict");

const {
  diffDays,
  isValidDateKey,
  normalizeResetDateKey,
  offsetDateKey,
} = require("../.test-dist/src/utils/dateHelpers.js");
const {
  getCompletionPercent,
  getDailyScoringTarget,
  getDRChangeFromPercent,
} = require("../.test-dist/src/utils/discipline.js");
const {
  buildMidnightEvaluation,
  shouldShowMidnightEvaluation,
} = require("../.test-dist/src/utils/midnightEvaluation.js");
const {
  applyMidnightStateTransition,
} = require("../.test-dist/src/utils/midnightStateTransition.js");
const {
  completeQuestInStoredState,
  uncompleteQuestInStoredState,
} = require("../.test-dist/src/utils/questCompletion.js");
const {
  getScheduledQuestsForDate,
  rollQuestsForNewDay,
} = require("../.test-dist/src/utils/recurrence.js");
const {
  defaultAchievements,
  defaultCategories,
} = require("../.test-dist/src/utils/defaultData.js");
const {
  buildOnboardingStarterQuests,
} = require("../.test-dist/src/utils/onboarding.js");
const {
  getContractConfirmationCopy,
} = require("../.test-dist/src/utils/contracts.js");
const {
  createQuestDuplicate,
} = require("../.test-dist/src/utils/questActions.js");
const {
  getLatestReflectionBefore,
  upsertDailyReflection,
} = require("../.test-dist/src/utils/reflections.js");
const {
  getRecoveryDayStatus,
  normalizeRecoveryDays,
  setRecoveryDayArmed,
} = require("../.test-dist/src/utils/recoveryDays.js");
const {
  buildStreakSummary,
} = require("../.test-dist/src/utils/planning.js");
const {
  getEnabledReminderCount,
  getReminderDestinationFromData,
  getReminderRouteFromData,
} = require("../.test-dist/src/utils/reminderLogic.js");

function quest(overrides = {}) {
  return {
    id: "quest-1",
    title: "Test quest",
    categoryId: "health",
    xp: 10,
    difficulty: "easy",
    repeat: "daily",
    done: false,
    pinned: false,
    contract: false,
    paused: false,
    ...overrides,
  };
}

function storedState(overrides = {}) {
  return {
    categories: defaultCategories.map((category) => ({ ...category })),
    quests: [],
    disciplineRating: 40,
    lastDrDelta: 0,
    lastCompletionPct: 0,
    lastDrUpdateDate: "",
    drHistory: [],
    lastResetDate: "2026-03-07",
    achievements: defaultAchievements.map((achievement) => ({ ...achievement })),
    lifetimeCompletedQuestCount: 0,
    archivedQuests: [],
    ...overrides,
  };
}

test("date keys reject rollover dates and remain stable across DST boundaries", () => {
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2025-02-29"), false);
  assert.equal(isValidDateKey("2026-13-01"), false);
  assert.equal(diffDays("2026-03-07", "2026-03-09"), 2);
  assert.equal(offsetDateKey("2026-03-07", 2), "2026-03-09");
  assert.equal(diffDays("invalid", "2026-03-09"), 0);
  assert.equal(normalizeResetDateKey("2026-03-08", "2026-03-09"), "2026-03-08");
  assert.equal(normalizeResetDateKey("2026-03-10", "2026-03-09"), "2026-03-09");
  assert.equal(normalizeResetDateKey("invalid", "2026-03-09"), "2026-03-09");
});

test("DR scoring uses the seven-quest standard without exceeding 100 percent", () => {
  assert.equal(getDailyScoringTarget(10), 7);
  assert.equal(getCompletionPercent(8, 7), 100);
  assert.equal(getDRChangeFromPercent(100, 10), 10);
  assert.equal(getDRChangeFromPercent(86, 7), 7);
  assert.equal(getDRChangeFromPercent(0, 0), -8);
});

test("recurrence includes the right quests and excludes paused quests", () => {
  const quests = [
    quest({ id: "daily" }),
    quest({ id: "weekday", repeat: "weekdays" }),
    quest({ id: "weekly", repeat: "weekly", scheduledWeekday: 1 }),
    quest({ id: "paused", paused: true }),
  ];

  assert.deepEqual(
    getScheduledQuestsForDate(quests, "2026-03-09").map((item) => item.id),
    ["daily", "weekday", "weekly"]
  );
  assert.deepEqual(
    getScheduledQuestsForDate(quests, "2026-03-08").map((item) => item.id),
    ["daily"]
  );
});

test("date-scheduled one-time quests appear only on their chosen day", () => {
  const scheduled = quest({ repeat: "once", scheduledDate: "2026-03-10" });

  assert.deepEqual(getScheduledQuestsForDate([scheduled], "2026-03-09"), []);
  assert.deepEqual(
    getScheduledQuestsForDate([scheduled], "2026-03-10").map((item) => item.id),
    ["quest-1"]
  );
  assert.deepEqual(getScheduledQuestsForDate([scheduled], "2026-03-11"), []);
});

test("quest completion awards XP and lifetime progress only once", () => {
  const initial = storedState({ quests: [quest()] });
  const first = completeQuestInStoredState(initial, "quest-1", "2026-03-07");
  const second = completeQuestInStoredState(first.state, "quest-1", "2026-03-07");

  assert.equal(first.completed, true);
  assert.equal(first.state.quests[0].done, true);
  assert.equal(first.state.categories[0].xp, 10);
  assert.equal(first.state.lifetimeCompletedQuestCount, 1);
  assert.ok(first.state.achievements.find((item) => item.id === "first_quest").unlockedAt);
  assert.equal(second.completed, false);
  assert.deepEqual(second.state, first.state);
});

test("same-day uncompletion reverses XP, lifetime progress, and new awards", () => {
  const initial = storedState({ quests: [quest()] });
  const completed = completeQuestInStoredState(initial, "quest-1", "2026-03-07");
  const reopened = uncompleteQuestInStoredState(completed.state, "quest-1", "2026-03-07");

  assert.equal(reopened.uncompleted, true);
  assert.equal(reopened.rewardsReversed, true);
  assert.equal(reopened.state.quests[0].done, false);
  assert.equal(reopened.state.quests[0].completionReceipt, undefined);
  assert.equal(reopened.state.categories[0].xp, 0);
  assert.equal(reopened.state.categories[0].level, 1);
  assert.equal(reopened.state.lifetimeCompletedQuestCount, 0);
  assert.equal(
    reopened.state.achievements.find((item) => item.id === "first_quest").unlockedAt,
    null
  );
});

test("uncompletion preserves later same-category progress and transfers award ownership", () => {
  const startingCategories = defaultCategories.map((category, index) =>
    index === 0 ? { ...category, xp: 85 } : { ...category }
  );
  const initial = storedState({
    categories: startingCategories,
    quests: [quest({ id: "first" }), quest({ id: "second" })],
  });
  const first = completeQuestInStoredState(initial, "first", "2026-03-07");
  const second = completeQuestInStoredState(first.state, "second", "2026-03-07");
  const reopenFirst = uncompleteQuestInStoredState(second.state, "first", "2026-03-07");

  assert.equal(reopenFirst.state.categories[0].level, 2);
  assert.equal(reopenFirst.state.categories[0].xp, 5);
  assert.equal(reopenFirst.state.lifetimeCompletedQuestCount, 1);
  assert.ok(
    reopenFirst.state.achievements.find((item) => item.id === "first_quest").unlockedAt
  );

  const reopenSecond = uncompleteQuestInStoredState(
    reopenFirst.state,
    "second",
    "2026-03-07"
  );
  assert.equal(reopenSecond.state.categories[0].level, 1);
  assert.equal(reopenSecond.state.categories[0].xp, 85);
  assert.equal(reopenSecond.state.lifetimeCompletedQuestCount, 0);
  assert.equal(
    reopenSecond.state.achievements.find((item) => item.id === "first_quest").unlockedAt,
    null
  );
});

test("legacy completions reopen without corrupting historical rewards", () => {
  const legacy = storedState({
    categories: defaultCategories.map((category, index) =>
      index === 0 ? { ...category, xp: 10 } : { ...category }
    ),
    quests: [quest({ done: true })],
    lifetimeCompletedQuestCount: 1,
  });
  const reopened = uncompleteQuestInStoredState(legacy, "quest-1", "2026-03-07");

  assert.equal(reopened.uncompleted, true);
  assert.equal(reopened.rewardsReversed, false);
  assert.equal(reopened.state.quests[0].done, false);
  assert.equal(reopened.state.categories[0].xp, 10);
  assert.equal(reopened.state.lifetimeCompletedQuestCount, 1);
});

test("onboarding creates no more than three safe one-time starter quests", () => {
  const starters = buildOnboardingStarterQuests(
    ["walk_20", "walk_20", "reset_room", "inbox_zero_10", "budget_check", "unknown"],
    12345
  );

  assert.deepEqual(starters.map((item) => item.id), [
    "onboarding-12345-0-walk_20",
    "onboarding-12345-1-reset_room",
    "onboarding-12345-2-inbox_zero_10",
  ]);
  assert.ok(starters.every((item) => item.repeat === "once"));
  assert.ok(starters.every((item) => item.contract === false && item.done === false));
});

test("contract preview explains the streak consequence without claiming a DR penalty", () => {
  const copy = getContractConfirmationCopy("Ship proposal");

  assert.match(copy, /Ship proposal/);
  assert.match(copy, /contract streak resets/);
  assert.match(copy, /Discipline Rating scoring does not change/);
});

test("tomorrow duplicates are clean one-time quests without inherited pressure", () => {
  const source = quest({
    done: true,
    pinned: true,
    contract: true,
    repeat: "daily",
    completionReceipt: { test: true },
  });
  const duplicate = createQuestDuplicate(source, "tomorrow-copy", "2026-03-08");

  assert.equal(duplicate.id, "tomorrow-copy");
  assert.equal(duplicate.repeat, "once");
  assert.equal(duplicate.scheduledDate, "2026-03-08");
  assert.equal(duplicate.done, false);
  assert.equal(duplicate.pinned, false);
  assert.equal(duplicate.contract, false);
  assert.equal(duplicate.completionReceipt, undefined);
});

test("daily reflections trim notes, replace the current day, and surface the latest prior note", () => {
  const first = upsertDailyReflection([], "2026-03-07", "  Keep the board small.  ", "a");
  const second = upsertDailyReflection(first, "2026-03-08", "Start with the walk.", "b");
  const replaced = upsertDailyReflection(second, "2026-03-08", "Walk before email.", "c");

  assert.equal(first[0].note, "Keep the board small.");
  assert.equal(replaced.length, 2);
  assert.equal(replaced[1].note, "Walk before email.");
  assert.equal(getLatestReflectionBefore(replaced, "2026-03-09").date, "2026-03-08");
  assert.deepEqual(upsertDailyReflection(replaced, "2026-03-08", ""), [first[0]]);
});

test("Recovery Days are limited to once every seven calendar days", () => {
  const armed = setRecoveryDayArmed([], "2026-03-07", true);
  const duplicateAndInvalid = normalizeRecoveryDays([
    ...armed,
    "2026-03-07",
    "not-a-date",
  ]);

  assert.deepEqual(duplicateAndInvalid, ["2026-03-07"]);
  assert.equal(getRecoveryDayStatus(armed, "2026-03-13").available, false);
  assert.equal(
    getRecoveryDayStatus(armed, "2026-03-13").nextAvailableDate,
    "2026-03-14"
  );
  assert.equal(getRecoveryDayStatus(armed, "2026-03-14").available, true);
  assert.deepEqual(setRecoveryDayArmed(armed, "2026-03-07", false), []);
});

test("a Recovery Day freezes DR and streaks without unlocking Awards", () => {
  const history = [
    { date: "2026-03-05", dr: 34, delta: 4, pct: 80, contractCompletedCount: 1, contractTotalCount: 1 },
    { date: "2026-03-06", dr: 40, delta: 6, pct: 90, contractCompletedCount: 1, contractTotalCount: 1 },
  ];
  const quests = [quest({ done: true, contract: true })];
  const evaluation = buildMidnightEvaluation("2026-03-07", quests, 90, true);
  const initial = storedState({ quests, drHistory: history, recoveryDays: ["2026-03-07"] });
  const result = applyMidnightStateTransition(
    initial,
    evaluation,
    "2026-03-08",
    "2026-03-08T12:00:00.000Z"
  );

  assert.equal(evaluation.recoveryDay, true);
  assert.equal(evaluation.runTitle, "Recovery Day");
  assert.equal(evaluation.drDelta, 0);
  assert.equal(result.state.disciplineRating, 40);
  assert.equal(result.state.drHistory.at(-1).recoveryDay, true);
  assert.deepEqual(buildStreakSummary(result.state.drHistory), {
    solidDayStreak: 2,
    contractStreak: 2,
    bestSolidDayStreak: 2,
  });
  assert.deepEqual(result.state.achievements, initial.achievements);
});

test("quest XP counts on a Recovery Day while milestone Awards wait", () => {
  const initial = storedState({
    quests: [quest()],
    recoveryDays: ["2026-03-07"],
  });
  const result = completeQuestInStoredState(initial, "quest-1", "2026-03-07");

  assert.equal(result.completed, true);
  assert.equal(result.state.categories[0].xp, 10);
  assert.equal(result.state.lifetimeCompletedQuestCount, 1);
  assert.equal(
    result.state.achievements.find((item) => item.id === "first_quest").unlockedAt,
    null
  );
  assert.deepEqual(result.state.quests[0].completionReceipt.unlockedAchievementIds, []);
});

test("reminder actions accept only safe app routes and count enabled slots", () => {
  assert.equal(getReminderRouteFromData({ route: "/(tabs)" }), "/(tabs)");
  assert.equal(getReminderRouteFromData({ route: "/(tabs)/plan" }), "/(tabs)/plan");
  assert.equal(getReminderRouteFromData({ route: "/(tabs)/settings" }), null);
  assert.equal(getReminderRouteFromData("/(tabs)"), null);
  assert.equal(
    getReminderDestinationFromData({ route: "/(tabs)/plan" }, false),
    "/onboarding"
  );
  assert.equal(
    getReminderDestinationFromData({ route: "/(tabs)/plan" }, true),
    "/(tabs)/plan"
  );
  assert.equal(getReminderDestinationFromData({ route: "/outside" }, false), null);
  assert.equal(
    getEnabledReminderCount({
      morningEnabled: true,
      contractEnabled: false,
      nextMoveEnabled: true,
    }),
    2
  );
});

test("a complete daily lifecycle preserves rewards and rolls the next board cleanly", () => {
  const daily = quest({ id: "daily" });
  const tomorrow = quest({
    id: "tomorrow",
    repeat: "once",
    scheduledDate: "2026-03-08",
  });
  const firstCompletion = completeQuestInStoredState(
    storedState({ quests: [daily, tomorrow] }),
    "daily",
    "2026-03-07"
  );
  const evaluation = buildMidnightEvaluation(
    "2026-03-07",
    firstCompletion.state.quests
  );
  const nextDay = applyMidnightStateTransition(
    firstCompletion.state,
    evaluation,
    "2026-03-08",
    "2026-03-08T00:00:01.000Z"
  );

  assert.equal(firstCompletion.state.categories[0].xp, 10);
  assert.equal(nextDay.state.categories[0].xp, 10);
  assert.equal(nextDay.state.lifetimeCompletedQuestCount, 1);
  assert.equal(nextDay.state.quests.find((item) => item.id === "daily").done, false);
  assert.equal(
    nextDay.state.quests.find((item) => item.id === "daily").completionReceipt,
    undefined
  );
  assert.deepEqual(
    getScheduledQuestsForDate(nextDay.state.quests, "2026-03-08").map((item) => item.id),
    ["daily", "tomorrow"]
  );
  assert.deepEqual(
    rollQuestsForNewDay(firstCompletion.state.quests).map((item) => item.done),
    [false, false]
  );
});

test("midnight evaluation records contracts and applies missed days exactly once", () => {
  const quests = [
    quest({ id: "contract", done: true, contract: true }),
    quest({ id: "open", done: false }),
    quest({ id: "one-time", repeat: "once", done: true }),
  ];
  const evaluation = buildMidnightEvaluation("2026-03-07", quests);
  const initial = storedState({ quests });

  assert.equal(evaluation.contractCompletedCount, 1);
  assert.equal(evaluation.contractTotalCount, 1);
  assert.equal(shouldShowMidnightEvaluation("2026-03-07", "2026-03-10", null), true);

  const first = applyMidnightStateTransition(
    initial,
    evaluation,
    "2026-03-10",
    "2026-03-10T12:00:00.000Z"
  );
  const second = applyMidnightStateTransition(
    first.state,
    evaluation,
    "2026-03-10",
    "2026-03-10T12:00:01.000Z"
  );

  assert.equal(first.applied, true);
  assert.deepEqual(first.state.drHistory.map((entry) => entry.date), [
    "2026-03-07",
    "2026-03-08",
    "2026-03-09",
  ]);
  assert.deepEqual(first.state.drHistory.map((entry) => entry.delta), [4, -8, -8]);
  assert.equal(first.state.disciplineRating, 28);
  assert.equal(first.state.lastResetDate, "2026-03-10");
  assert.equal(first.state.archivedQuests[0].id, "one-time");
  assert.equal(first.state.quests.some((item) => item.id === "one-time"), false);
  assert.equal(first.state.quests.find((item) => item.id === "contract").done, false);
  assert.equal(second.applied, false);
  assert.deepEqual(second.state, first.state);
});
