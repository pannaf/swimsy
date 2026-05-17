import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useState, useCallback } from "react";
import { Link, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkouts, StoredWorkout } from "../../lib/storage";
import { colors } from "../../lib/theme";

export default function History() {
  const [workouts, setWorkouts] = useState<StoredWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setWorkouts(await getWorkouts());
        setLoading(false);
      })();
    }, [])
  );

  function renderWorkout({ item }: { item: StoredWorkout }) {
    const summary = item.sets
      .flatMap((s) => (s.groups || []).flatMap((g) =>
        g.lines.map((l) => `${(g.rounds || 1) > 1 ? g.rounds + "×(" : ""}${l.reps}x${l.distance}${(g.rounds || 1) > 1 ? ")" : ""}`)
      ))
      .join(" + ");

    return (
      <Link href={`/workout/${item.id}`} asChild>
        <Pressable style={s.card}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.yards}>
              {item.total_yards}
              <Text style={s.unit}> {item.pool_unit}</Text>
            </Text>
            <Text style={s.date}>
              {new Date(item.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {item.duration_minutes ? ` \u00B7 ${item.duration_minutes} min` : ""}
            </Text>
            {summary ? (
              <Text style={s.summary} numberOfLines={1}>
                {summary}
              </Text>
            ) : null}
          </View>
          {item.feeling_score != null && (
            <View style={s.badge}>
              <Text style={s.badgeNum}>{item.feeling_score}</Text>
              <Text style={s.badgeLabel}>FEEL</Text>
            </View>
          )}
        </Pressable>
      </Link>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.subtitle}>ALL SWIMS</Text>
        <Text style={s.title}>History</Text>
      </View>
      <FlatList
        data={workouts}
        renderItem={renderWorkout}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>{loading ? "Loading..." : "No workouts yet"}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, marginBottom: 4 },
  subtitle: { fontSize: 11, color: colors.muted, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: "800", color: colors.white },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  yards: { fontSize: 18, fontWeight: "700", color: colors.white },
  unit: { fontSize: 13, fontWeight: "400", color: colors.muted },
  date: { fontSize: 13, color: colors.muted, marginTop: 4 },
  summary: { fontSize: 12, color: colors.muted, marginTop: 6 },
  badge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  badgeNum: { fontSize: 20, fontWeight: "800", color: colors.white },
  badgeLabel: { fontSize: 9, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { color: colors.muted, fontSize: 15 },
});
