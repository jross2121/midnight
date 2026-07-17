const test = require("node:test");
const assert = require("node:assert/strict");

const {
  diffDays,
  isValidDateKey,
  offsetDateKey,
} = require("../.test-dist/app/(tabs)/_utils/dateHelpers.js");
const {
  getCompletionPercent,
  getDailyScoringTarget,
  getDRChangeFromPercent,
} = require("../.test-dist/app/(tabs)/_utils/discipline.js");
const {
  buildMidnightEvaluation,
  shouldShowMidnightEvaluation,
} = require("../.test-dist/app/(tabs)/_utils/midnightEvaluation.js");
const {
  applyMidnightStateTransition,
} = require("../.test-dist/app/(tabs)/_utils/midnightStateTransition.js");
const {
  completeQuestInStoredState,
} = require("../.test-dist/app/(tabs)/_utils/questCompletion.js");
const {
  getScheduledQuestsForDate,
} = require("../.test-dist/app/(tabs)/_utils/recurrence.js");
const {
  defaultAchievements,
  defaultCategories,
} = require("../.test-dist/app/(tabs)/_utils/defaultData.js");

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
