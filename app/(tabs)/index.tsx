import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkouts, StoredWorkout } from "../../lib/storage";
import { Benchmark } from "../../lib/types";
import { colors } from "../../lib/theme";

export default function Dashboard() {
  const [recent, setRecent] = useState<StoredWorkout[]>([]);
  const [weekYards, setWeekYards] = useState(0);
  const [weekSwims, setWeekSwims] = useState(0);
  const [monthYards, setMonthYards] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [swimDays, setSwimDays] = useState<Set<number>>(new Set());
  const [benchmarkGroups, setBenchmarkGroups] = useState<Record<string, { date: string; bm: Benchmark }[]>>({});

  const [allWorkouts, setAllWorkouts] = useState<StoredWorkout[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await getWorkouts();
        setAllWorkouts(all);
        setRecent(all.slice(0, 5));
        const month = new Date();
        month.setDate(month.getDate() - 30);
        setMonthYards(
          all.filter((w) => new Date(w.date) >= month).reduce((s, w) => s + w.total_yards, 0)
        );

        // Collect benchmarks grouped by name
        const groups: Record<string, { date: string; bm: Benchmark }[]> = {};
        let bmTotal = 0;
        for (const w of all) {
          const bms = w.benchmarks || [];
          bmTotal += bms.length;
          for (const bm of bms) {
            // Use name if available, otherwise generate from type + distance + stroke
            let key = bm.name?.trim().toLowerCase();
            if (!key) {
              key = [
                bm.type,
                bm.reps ? `${bm.reps}x` : "",
                bm.distance || "",
                bm.stroke || "",
              ].filter(Boolean).join(" ").trim();
            }
            if (!key) continue;
            // Also set the display name if missing
            if (!bm.name?.trim()) {
              bm.name = key;
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push({ date: w.date, bm });
          }
        }
        console.log(`Benchmarks: ${bmTotal} total across ${all.length} workouts, ${Object.keys(groups).length} groups`);
        setBenchmarkGroups(groups);
      })();
    }, [])
  );

  // Recalculate week stats when offset changes
  useEffect(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    sunday.setHours(0, 0, 0, 0);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 7);

    const weekWorkouts = allWorkouts.filter((w) => {
      const d = new Date(w.date);
      return d >= sunday && d < saturday;
    });
    setWeekYards(weekWorkouts.reduce((s, w) => s + w.total_yards, 0));
    setWeekSwims(weekWorkouts.length);

    const days = new Set<number>();
    for (const w of weekWorkouts) {
      days.add(new Date(w.date).getDay());
    }
    setSwimDays(days);
  }, [weekOffset, allWorkouts]);

  const weekSunday = (() => {
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          <Text style={s.subtitle}>DASHBOARD</Text>
          <Text style={s.title}>Swimsy</Text>

          {/* Stats */}
          <View style={s.row}>
            <View style={[s.card, { marginRight: 6 }]}>
              <Text style={s.cardLabel}>THIS WEEK</Text>
              <Text style={s.cardValue}>{weekYards >= 1000 ? `${(weekYards / 1000).toFixed(1)}k` : weekYards}</Text>
              <Text style={s.cardUnit}>yards</Text>
            </View>
            <View style={[s.card, { marginHorizontal: 6 }]}>
              <Text style={s.cardLabel}>SWIMS</Text>
              <Text style={s.cardValue}>{weekSwims}</Text>
              <Text style={s.cardUnit}>this week</Text>
            </View>
            <View style={[s.card, { marginLeft: 6 }]}>
              <Text style={s.cardLabel}>30 DAYS</Text>
              <Text style={s.cardValue}>{monthYards >= 1000 ? `${(monthYards / 1000).toFixed(1)}k` : monthYards}</Text>
              <Text style={s.cardUnit}>yards</Text>
            </View>
          </View>

          {/* Week dots */}
          <View style={s.weekCard}>
            <View style={s.weekNav}>
              <Pressable onPress={() => setWeekOffset(weekOffset - 1)} hitSlop={12}>
                <FontAwesome name="chevron-left" size={14} color={colors.swim[400]} />
              </Pressable>
              <Text style={s.weekLabel}>
                {weekOffset === 0
                  ? "This Week"
                  : weekOffset === -1
                  ? "Last Week"
                  : (() => {
                      const sat = new Date(weekSunday);
                      sat.setDate(sat.getDate() + 6);
                      return `${weekSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sat.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                    })()}
              </Text>
              <Pressable
                onPress={() => setWeekOffset(weekOffset + 1)}
                disabled={weekOffset >= 0}
                hitSlop={12}
              >
                <FontAwesome name="chevron-right" size={14} color={weekOffset >= 0 ? colors.border : colors.swim[400]} />
              </Pressable>
            </View>
            <View style={s.weekDots}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                const todayDay = new Date().getDay();
                const swam = swimDays.has(i);
                const isCurrentWeek = weekOffset === 0;
                const future = isCurrentWeek && i > todayDay;
                const isToday = isCurrentWeek && i === todayDay;
                return (
                  <View key={day} style={s.weekDotCol}>
                    <View
                      style={[
                        s.weekDot,
                        swam && s.weekDotFilled,
                        !swam && !future && s.weekDotEmpty,
                        future && s.weekDotFuture,
                      ]}
                    />
                    <Text style={[s.weekDotLabel, isToday && s.weekDotLabelToday]}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>


          {/* Benchmarks */}
          {(() => {
            const fmtTime = (sec: number) => {
              const m = Math.floor(sec / 60);
              const ss = sec % 60;
              return `${m}:${ss.toString().padStart(2, "0")}`;
            };
            const getTime = (bm: Benchmark): string => {
              if (bm.total_time_seconds != null) return fmtTime(bm.total_time_seconds);
              if (bm.interval_seconds != null) return fmtTime(bm.interval_seconds);
              if (bm.avg_pace_per_100 != null) return `${fmtTime(bm.avg_pace_per_100)}/100`;
              if (bm.value != null) return `${bm.value}${bm.unit ? ` ${bm.unit}` : ""}`;
              return "—";
            };
            const getScheme = (bm: Benchmark): string => {
              if (bm.reps && bm.distance) return `${bm.reps}x${bm.distance}`;
              if (bm.distance) return `${bm.distance}`;
              return "";
            };

            // Collect all benchmark entries flat, sorted by date desc
            const allEntries: { date: string; bm: Benchmark }[] = [];
            for (const entries of Object.values(benchmarkGroups)) {
              allEntries.push(...entries);
            }
            allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const timeTrials = allEntries.filter((e) => e.bm.type === "time_trial");
            const testSets = allEntries.filter((e) => e.bm.type === "test_set");
            const custom = allEntries.filter((e) => e.bm.type === "custom");

            if (allEntries.length === 0) return null;

            return (
              <View style={{ marginBottom: 20 }}>
                {/* Time Trials */}
                {timeTrials.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionTitle}>Time Trials</Text>
                    <View style={s.bmTable}>
                      <View style={s.bmTableHeader}>
                        <Text style={[s.bmHeaderCell, { flex: 1 }]}>DATE</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1 }]}>DISTANCE</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1 }]}>STROKE</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1, textAlign: "right" }]}>TIME</Text>
                      </View>
                      {timeTrials.slice(0, 10).map((e, i) => (
                        <View key={i} style={s.bmTableRow}>
                          <Text style={[s.bmCell, { flex: 1 }]}>
                            {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </Text>
                          <Text style={[s.bmCell, { flex: 1 }]}>{getScheme(e.bm)}</Text>
                          <Text style={[s.bmCell, { flex: 1 }]}>{e.bm.stroke || "free"}</Text>
                          <Text style={[s.bmCellTime, { flex: 1, textAlign: "right" }]}>{getTime(e.bm)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Test Sets */}
                {testSets.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionTitle}>Test Sets</Text>
                    <View style={s.bmTable}>
                      <View style={s.bmTableHeader}>
                        <Text style={[s.bmHeaderCell, { flex: 1 }]}>DATE</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1.2 }]}>SET</Text>
                        <Text style={[s.bmHeaderCell, { flex: 0.8 }]}>STROKE</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1, textAlign: "right" }]}>PACE</Text>
                      </View>
                      {testSets.slice(0, 10).map((e, i) => (
                        <View key={i} style={s.bmTableRow}>
                          <Text style={[s.bmCell, { flex: 1 }]}>
                            {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </Text>
                          <Text style={[s.bmCell, { flex: 1.2 }]}>{getScheme(e.bm)}{e.bm.interval_seconds ? ` @ ${fmtTime(e.bm.interval_seconds)}` : ""}</Text>
                          <Text style={[s.bmCell, { flex: 0.8 }]}>{e.bm.stroke || "free"}</Text>
                          <Text style={[s.bmCellTime, { flex: 1, textAlign: "right" }]}>{e.bm.avg_pace_per_100 ? `${fmtTime(e.bm.avg_pace_per_100)}/100` : getTime(e.bm)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Custom */}
                {custom.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionTitle}>Custom</Text>
                    <View style={s.bmTable}>
                      <View style={s.bmTableHeader}>
                        <Text style={[s.bmHeaderCell, { flex: 1 }]}>DATE</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1.5 }]}>NAME</Text>
                        <Text style={[s.bmHeaderCell, { flex: 1, textAlign: "right" }]}>VALUE</Text>
                      </View>
                      {custom.slice(0, 10).map((e, i) => (
                        <View key={i} style={s.bmTableRow}>
                          <Text style={[s.bmCell, { flex: 1 }]}>
                            {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </Text>
                          <Text style={[s.bmCell, { flex: 1.5 }]}>{e.bm.name}</Text>
                          <Text style={[s.bmCellTime, { flex: 1, textAlign: "right" }]}>{getTime(e.bm)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Recent */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent</Text>
            {recent.length > 0 && (
              <Link href="/(tabs)/history">
                <Text style={s.seeAll}>See All</Text>
              </Link>
            )}
          </View>

          {recent.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>No swims yet. Jump in!</Text>
            </View>
          ) : (
            recent.map((w) => (
              <Link key={w.id} href={`/workout/${w.id}`} asChild>
                <Pressable style={s.workoutCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.workoutYards}>
                      {w.total_yards}
                      <Text style={s.workoutUnit}> {w.pool_unit}</Text>
                    </Text>
                    <Text style={s.workoutDate}>
                      {new Date(w.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {w.duration_minutes ? ` \u00B7 ${w.duration_minutes} min` : ""}
                    </Text>
                  </View>
                  {w.feeling_score != null && (
                    <View style={s.feelBadge}>
                      <Text style={s.feelNum}>{w.feeling_score}</Text>
                      <Text style={s.feelLabel}>FEEL</Text>
                    </View>
                  )}
                </Pressable>
              </Link>
            ))
          )}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  subtitle: { fontSize: 11, color: colors.muted, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: "800", color: colors.white, marginBottom: 20 },
  row: { flexDirection: "row", marginBottom: 16 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.5 },
  cardValue: { fontSize: 22, fontWeight: "800", color: colors.white, marginTop: 4 },
  cardUnit: { fontSize: 13, color: colors.swim[400], marginTop: 2 },
  weekCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  weekNav: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  weekLabel: { fontSize: 13, fontWeight: "700", color: colors.white },
  weekDots: {
    flexDirection: "row", justifyContent: "space-between",
  },
  weekDotCol: { alignItems: "center" },
  weekDot: {
    width: 12, height: 12, borderRadius: 6, marginBottom: 6,
  },
  weekDotFilled: { backgroundColor: colors.swim[500] },
  weekDotEmpty: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.muted },
  weekDotFuture: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  weekDotLabel: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  weekDotLabelToday: { color: colors.white, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.white, marginBottom: 10 },
  seeAll: { fontSize: 13, fontWeight: "600", color: colors.swim[400] },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.muted, fontSize: 15 },
  workoutCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutYards: { fontSize: 18, fontWeight: "700", color: colors.white },
  workoutUnit: { fontSize: 13, fontWeight: "400", color: colors.muted },
  workoutDate: { fontSize: 13, color: colors.muted, marginTop: 4 },
  bmTable: {
    backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border,
  },
  bmTableHeader: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bmHeaderCell: { fontSize: 9, color: colors.muted, fontWeight: "700", letterSpacing: 1 },
  bmTableRow: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bmCell: { fontSize: 13, color: colors.white },
  bmCellTime: { fontSize: 13, fontWeight: "700", color: colors.swim[400] },
  feelBadge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  feelNum: { fontSize: 20, fontWeight: "800", color: colors.white },
  feelLabel: { fontSize: 9, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
});
