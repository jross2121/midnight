import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Category = {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
};

type Quest = {
  id: string;
  title: string;
  categoryId: string;
  xp: number;
  done: boolean;
};

const STORAGE_KEY = "lifeRpg:v1";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function levelUp(cat: Category) {
  let { level, xp, xpToNext } = cat;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(xpToNext * 1.15 + 25);
  }
  return { ...cat, level, xp, xpToNext };
}

const defaultCategories: Category[] = [
  { id: "health", name: "Health", level: 3, xp: 40, xpToNext: 120 },
  { id: "money", name: "Money", level: 2, xp: 75, xpToNext: 110 },
  { id: "career", name: "Career", level: 4, xp: 10, xpToNext: 140 },
  { id: "social", name: "Social", level: 1, xp: 25, xpToNext: 90 },
  { id: "home", name: "Home", level: 2, xp: 15, xpToNext: 110 },
  { id: "fun", name: "Fun", level: 5, xp: 60, xpToNext: 160 },
];

const defaultQuests: Quest[] = [
  { id: "q1", title: "Workout (20 min)", categoryId: "health", xp: 25, done: false },
  { id: "q2", title: "Drink water (8 cups)", categoryId: "health", xp: 10, done: false },
  { id: "q3", title: "No impulse buys today", categoryId: "money", xp: 20, done: false },
  { id: "q4", title: "Apply to 1 job", categoryId: "career", xp: 30, done: false },
  { id: "q5", title: "Clean for 10 minutes", categoryId: "home", xp: 15, done: false },
  { id: "q6", title: "Text/call someone you care about", categoryId: "social", xp: 15, done: false },
  { id: "q7", title: "Relax guilt-free (30 min)", categoryId: "fun", xp: 10, done: false },
];

export default function HomeScreen() {
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [hydrated, setHydrated] = useState(false);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newXP, setNewXP] = useState("10");

  // Load saved state
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { categories: Category[]; quests: Quest[] };
          if (parsed?.categories?.length) setCategories(parsed.categories);
          if (parsed?.quests?.length) setQuests(parsed.quests);
        }
      } catch (e) {
        console.log("Failed to load storage:", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Save on changes
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, quests }));
      } catch (e) {
        console.log("Failed to save storage:", e);
      }
    })();
  }, [categories, quests, hydrated]);

  const overall = useMemo(() => {
    const totalLevel = categories.reduce((sum, c) => sum + c.level, 0);
    const avg = categories.length ? totalLevel / categories.length : 0;
    return Math.round(avg * 10) / 10;
  }, [categories]);

  const todayXP = useMemo(() => quests.filter(q => q.done).reduce((s, q) => s + q.xp, 0), [quests]);
  const doneCount = useMemo(() => quests.filter(q => q.done).length, [quests]);

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Category";

  const completeQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.done) return;

    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, done: true } : q))
    );

    setCategories((prev) =>
      prev.map((c) => (c.id === quest.categoryId ? levelUp({ ...c, xp: c.xp + quest.xp }) : c))
    );
  };

  const deleteQuest = (questId: string) => {
    setQuests((prev) => prev.filter((q) => q.id !== questId));
  };

  const resetToday = () => {
    setQuests((prev) => prev.map((q) => ({ ...q, done: false })));
  };

  const resetDemo = async () => {
    setCategories((prev) =>
      prev.map((c) => ({ ...c, level: 1, xp: 0, xpToNext: 90 }))
    );
    setQuests(defaultQuests);
    setShowAdd(false);
    setNewTitle("");
    setNewCategory("health");
    setNewXP("10");
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const addQuest = () => {
    const title = newTitle.trim();
    if (!title) return;

    const xpNum = Number(newXP);
    const safeXP = Number.isFinite(xpNum) && xpNum > 0 ? Math.floor(xpNum) : 10;

    setQuests((prev) => [
      ...prev,
      { id: "q" + Date.now(), title, categoryId: newCategory, xp: safeXP, done: false },
    ]);

    setNewTitle("");
    setNewXP("10");
    setShowAdd(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Life RPG</Text>

        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Overall</Text>
            <Text style={styles.pillValue}>Lv {overall}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Today</Text>
            <Text style={styles.pillValue}>
              {doneCount}/{quests.length} • +{todayXP} XP
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={resetToday}>
            <Text style={styles.btnText}>Reset Today</Text>
          </Pressable>
          <Pressable style={styles.btnDanger} onPress={resetDemo}>
            <Text style={styles.btnText}>Reset Demo</Text>
          </Pressable>
        </View>

        {/* TODAY'S QUESTS HEADER */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Today’s Quests</Text>
          <Pressable onPress={() => setShowAdd((s) => !s)}>
            <Text style={styles.link}>{showAdd ? "Cancel" : "+ Add"}</Text>
          </Pressable>
        </View>

        {/* ADD QUEST FORM */}
        {showAdd && (
          <View style={styles.addBox}>
            <TextInput
              placeholder="Quest title (e.g., Clean 10 minutes)"
              placeholderTextColor="#8c96a6"
              value={newTitle}
              onChangeText={setNewTitle}
              style={styles.input}
            />

            <Text style={styles.smallLabel}>Category</Text>
            <View style={styles.pickerRow}>
              {categories.map((c) => {
                const active = newCategory === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setNewCategory(c.id)}
                    style={[styles.pillPick, active && styles.pillPickActive]}
                  >
                    <Text style={[styles.pillPickText, active && styles.pillPickTextActive]}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              placeholder="XP (e.g., 15)"
              placeholderTextColor="#8c96a6"
              keyboardType="numeric"
              value={newXP}
              onChangeText={setNewXP}
              style={styles.input}
            />

            <Pressable onPress={addQuest} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Add Quest</Text>
            </Pressable>
          </View>
        )}

        {/* QUEST LIST */}
        <View style={styles.list}>
          {[...quests]
            .sort((a, b) => Number(a.done) - Number(b.done))
            .map((q) => (
              <View key={q.id} style={[styles.questCard, q.done && styles.questDone]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.questTitle, q.done && styles.questTitleDone]}>
                    {q.title}
                  </Text>
                  <Text style={styles.questMeta}>
                    {categoryName(q.categoryId)} • +{q.xp} XP
                  </Text>
                </View>

                <View style={styles.rightStack}>
                  {q.done ? (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneText}>✔ COMPLETED</Text>
                    </View>
                  ) : (
                    <Pressable style={styles.completeBtn} onPress={() => completeQuest(q.id)}>
                      <Text style={styles.completeText}>Complete</Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.deleteBtn} onPress={() => deleteQuest(q.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </View>

        {/* CATEGORIES */}
        <Text style={styles.section}>Your Stats</Text>

        <View style={styles.grid}>
          {categories.map((c) => {
            const pct = clamp(c.xp / c.xpToNext, 0, 1);
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{c.name}</Text>
                  <Text style={styles.level}>Lv {c.level}</Text>
                </View>

                <Text style={styles.xpText}>
                  XP: {c.xp} / {c.xpToNext}
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.hint}>
          Tip: If the browser says “site can’t be reached,” restart the dev server:
          {" "}
          <Text style={styles.mono}>npx expo start --web</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f14" },
  container: { padding: 16, paddingBottom: 40 },

  title: { fontSize: 32, fontWeight: "800", color: "white", marginBottom: 10 },

  topRow: { flexDirection: "row", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  pill: {
    backgroundColor: "#121a24",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1e2a3a",
  },
  pillLabel: { color: "#8c96a6", fontSize: 12, fontWeight: "700" },
  pillValue: { color: "white", fontSize: 14, fontWeight: "800", marginTop: 2 },

  row: { flexDirection: "row", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  btn: {
    backgroundColor: "#1b2533",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e2a3a",
  },
  btnDanger: {
    backgroundColor: "#2a0f16",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4a1a26",
  },
  btnText: { color: "white", fontWeight: "800" },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  section: { fontSize: 18, fontWeight: "800", color: "white" },
  link: { color: "#2a7fff", fontWeight: "900" },

  addBox: {
    backgroundColor: "#121a24",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e2a3a",
    marginBottom: 14,
    gap: 10,
  },
  input: {
    backgroundColor: "#0b0f14",
    color: "white",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e2a3a",
  },
  smallLabel: { color: "#b9c0cc", fontWeight: "800" },

  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pillPick: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1e2a3a",
    backgroundColor: "#0b0f14",
  },
  pillPickActive: { backgroundColor: "#2a7fff", borderColor: "#2a7fff" },
  pillPickText: { color: "white", fontWeight: "800", fontSize: 12 },
  pillPickTextActive: { color: "white" },

  addBtn: {
    backgroundColor: "#2a7fff",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  addBtnText: { color: "white", fontWeight: "900" },

  list: { gap: 10, marginBottom: 18 },
  questCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#121a24",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e2a3a",
  },
  questDone: {
    opacity: 0.6,
    backgroundColor: "#0b0f14",
  },
  questTitle: { color: "white", fontSize: 15, fontWeight: "900" },
  questTitleDone: { textDecorationLine: "line-through", opacity: 0.7 },
  questMeta: { color: "#b9c0cc", marginTop: 4 },

  rightStack: { gap: 8, alignItems: "flex-end" },

  completeBtn: {
    backgroundColor: "#2a7fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  completeText: { color: "white", fontWeight: "900" },

  doneBadge: {
    backgroundColor: "#0f2a18",
    borderWidth: 1,
    borderColor: "#2ecc71",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  doneText: { color: "#2ecc71", fontWeight: "900" },

  deleteBtn: {
    backgroundColor: "#0b0f14",
    borderWidth: 1,
    borderColor: "#4a1a26",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  deleteText: { color: "white", fontWeight: "900" },

  grid: { gap: 12 },
  card: {
    backgroundColor: "#121a24",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e2a3a",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "white" },
  level: { fontSize: 14, fontWeight: "700", color: "#b9c0cc" },
  xpText: { color: "#b9c0cc", marginBottom: 8 },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#0b0f14",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e2a3a",
  },
  barFill: { height: "100%", backgroundColor: "#2a7fff" },

  hint: { marginTop: 16, color: "#8c96a6", lineHeight: 18 },
  mono: { fontFamily: "monospace" },
});
