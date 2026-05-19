import { View, Text, ScrollView, Image, Pressable, Alert, StyleSheet, Dimensions } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { getWorkout, getWorkouts, deleteWorkout, getSettings, StoredWorkout } from "../../lib/storage";
import { Effort, WorkLine, SetLine, SwimSet } from "../../lib/types";
import { colors } from "../../lib/theme";
import { isAvailable, requestPermissions, getSwimDataForDate, HealthSwimData } from "../../lib/healthkit";
import { isConnected as isWhoopConnected, getDataForDate as getWhoopData, WhoopDayData, ZoneDurations } from "../../lib/whoop";

const EFFORT_COLORS: Record<Effort, string> = {
  easy: colors.accent.green,
  moderate: colors.accent.yellow,
  fast: "#f97316",
  sprint: colors.accent.red,
};

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WorkoutDetail() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const [currentId, setCurrentId] = useState(routeId);
  const [workout, setWorkout] = useState<StoredWorkout | null>(null);
  const [healthData, setHealthData] = useState<HealthSwimData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopDayData | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(false);
  const [allIds, setAllIds] = useState<string[]>([]);
  const [baseTime100, setBaseTime100] = useState(90);
  const [breakdownPage, setBreakdownPage] = useState(0);

  // Sync if navigated to from outside
  useEffect(() => { setCurrentId(routeId); }, [routeId]);

  useEffect(() => {
    getSettings().then((s) => setBaseTime100(s.baseTime100));
    getWorkouts().then((all) => setAllIds(all.map((w) => w.id)));
    getWorkout(currentId).then((w) => {
      if (w) {
        setWorkout(w);
        setHealthData(null);
        setWhoopData(null);
        fetchHealthData(w.date);
        fetchWhoopData(w.date);
      }
    });
  }, [currentId]);

  async function fetchHealthData(date: string) {
    if (!isAvailable()) return;
    setHealthLoading(true);
    const granted = await requestPermissions();
    if (granted) {
      const data = await getSwimDataForDate(date);
      setHealthData(data);
    }
    setHealthLoading(false);
  }

  async function fetchWhoopData(date: string) {
    const connected = await isWhoopConnected();
    if (!connected) return;
    setWhoopLoading(true);
    const data = await getWhoopData(date);
    setWhoopData(data);
    setWhoopLoading(false);
  }

  function handleDelete() {
    Alert.alert("Delete Workout", "Are you sure? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteWorkout(id);
          router.replace("/(tabs)");
        },
      },
    ]);
  }

  if (!workout) {
    return (
      <View style={s.loading}>
        <Text style={{ color: colors.muted }}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
    <Stack.Screen
      options={{
        headerLeft: () => (
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
            <Text style={{ color: colors.swim[500], fontSize: 17 }}>{"\u276E"} Back</Text>
          </Pressable>
        ),
        headerRight: () => (
          <Pressable onPress={() => router.push(`/(tabs)/log?editId=${currentId}`)} style={{ flexDirection: "row", alignItems: "center" }}>
            <FontAwesome name="pencil" size={14} color={colors.swim[500]} />
            <Text style={{ color: colors.swim[500], fontSize: 15, fontWeight: "600", marginLeft: 6 }}>Edit</Text>
          </Pressable>
        ),
      }}
    />
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.container}>
        {/* Date nav */}
        {(() => {
          const idx = allIds.indexOf(currentId);
          const prevId = allIds.length > 1 && idx < allIds.length - 1 ? allIds[idx + 1] : null;
          const nextId = allIds.length > 1 && idx > 0 ? allIds[idx - 1] : null;
          return (
            <View style={s.dateNav}>
              <Pressable disabled={!prevId} onPress={() => prevId && setCurrentId(prevId)} hitSlop={16}>
                <FontAwesome name="chevron-left" size={12} color={prevId ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"} />
              </Pressable>
              <Text style={s.dateText}>
                {new Date(workout.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </Text>
              <Pressable disabled={!nextId} onPress={() => nextId && setCurrentId(nextId)} hitSlop={16}>
                <FontAwesome name="chevron-right" size={12} color={nextId ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"} />
              </Pressable>
            </View>
          );
        })()}

        {/* Hero number */}
        <Text style={s.heroNum}>{workout.total_yards}</Text>
        <Text style={s.heroUnit}>{workout.pool_unit}</Text>

        {/* Stats row */}
        <View style={s.statsGrid}>
          {workout.duration_minutes != null && (
            <View style={s.statItem}>
              <Text style={s.statNum}>{workout.duration_minutes}</Text>
              <Text style={s.statLbl}>min</Text>
            </View>
          )}
          {workout.base_time_100 != null && (
            <View style={s.statItem}>
              <Text style={s.statNum}>{fmtTime(workout.base_time_100)}</Text>
              <Text style={s.statLbl}>base</Text>
            </View>
          )}
          {workout.feeling_score != null && (
            <View style={s.statItem}>
              <Text style={[s.statNum, {
                color: workout.feeling_score >= 7 ? colors.accent.green : workout.feeling_score >= 4 ? colors.accent.yellow : colors.accent.red,
              }]}>{workout.feeling_score}<Text style={s.statDenom}>/10</Text></Text>
              <Text style={s.statLbl}>feeling</Text>
            </View>
          )}
          {workout.lane != null && (
            <View style={s.statItem}>
              <Text style={s.statNum}>{workout.lane}</Text>
              <Text style={s.statLbl}>lane</Text>
            </View>
          )}
          {workout.coach != null && (
            <View style={s.statItem}>
              <Text style={s.statNum}>{workout.coach}</Text>
              <Text style={s.statLbl}>coach</Text>
            </View>
          )}
        </View>
        <View style={s.divider} />

        {/* Workout Breakdown */}
        {workout.sets && workout.sets.length > 0 && (() => {
          // Collect all work lines with their yardage
          type LineWithYards = { yards: number; effort?: Effort; interval: number | null; distance: number };
          const allWorkLines: LineWithYards[] = [];
          for (const set of workout.sets) {
            const repDetails = set.rep_details || [];
            let rdIdx = 0;
            for (const group of set.groups || []) {
              const rounds = group.rounds || 1;
              for (const line of group.lines) {
                if (line.kind === "rest") continue;
                const wl = line as WorkLine;
                const totalReps = wl.reps * rounds;
                const lineRdStart = rdIdx;
                rdIdx += totalReps;

                // Expand rep_pattern cycle into per-rep efforts
                let cycleEfforts: (Effort | undefined)[] | null = null;
                if (wl.rep_pattern?.cycle && wl.rep_pattern.cycle.length > 0) {
                  const expanded: (Effort | undefined)[] = [];
                  for (const entry of wl.rep_pattern.cycle) {
                    const count = entry.count || 1;
                    for (let c = 0; c < count; c++) expanded.push(entry.effort);
                  }
                  cycleEfforts = expanded;
                }

                for (let r = 0; r < totalReps; r++) {
                  // Priority: rep_details segments > rep_pattern cycle > line effort
                  const rd = repDetails[lineRdStart + r];
                  let repEffort: Effort | undefined;
                  if (rd?.segments?.length > 0) {
                    // Use dominant effort from segments (most common, or first)
                    const segEfforts = rd.segments.map((seg) => seg.effort);
                    repEffort = segEfforts[0];
                  } else if (cycleEfforts) {
                    repEffort = cycleEfforts[r % cycleEfforts.length];
                  } else {
                    repEffort = wl.effort as Effort | undefined;
                  }
                  allWorkLines.push({
                    yards: wl.distance,
                    effort: repEffort,
                    interval: wl.interval_seconds,
                    distance: wl.distance,
                  });
                }
              }
            }
          }

          // Base interval for a given distance
          const workoutBase = workout.base_time_100 || baseTime100;
          const baseFor = (dist: number) => Math.ceil((dist / 100) * workoutBase / 5) * 5;

          // Effort breakdown
          const effortYards: Record<string, number> = {};
          for (const l of allWorkLines) {
            const key = l.effort || "untagged";
            effortYards[key] = (effortYards[key] || 0) + l.yards;
          }

          // Interval breakdown + consecutive streaks
          type IntervalBucket = { label: string; yards: number; maxConsec: number };
          const buckets: Record<string, IntervalBucket> = {
            "base-10": { label: "Base -10", yards: 0, maxConsec: 0 },
            "base-5": { label: "Base -5", yards: 0, maxConsec: 0 },
            "base": { label: "On Base", yards: 0, maxConsec: 0 },
            "base+5": { label: "Base +5", yards: 0, maxConsec: 0 },
            "base+10": { label: "Base +10", yards: 0, maxConsec: 0 },
          };

          function bucketKey(interval: number | null, distance: number): string | null {
            if (interval == null || interval <= 0) return null;
            const base = baseFor(distance);
            const diff = interval - base;
            if (diff === -10) return "base-10";
            if (diff === -5) return "base-5";
            if (diff === 0) return "base";
            if (diff === 5) return "base+5";
            if (diff === 10) return "base+10";
            return null;
          }

          // Compute per-set consecutive streaks
          for (const set of workout.sets) {
            const setLines: LineWithYards[] = [];
            const rdForSet = set.rep_details || [];
            let rdIdx2 = 0;
            for (const group of set.groups || []) {
              const rounds = group.rounds || 1;
              for (const line of group.lines) {
                if (line.kind === "rest") continue;
                const wl = line as WorkLine;
                const totalReps = wl.reps * rounds;
                const lineRdStart = rdIdx2;
                rdIdx2 += totalReps;
                let cycleEfforts: (Effort | undefined)[] | null = null;
                if (wl.rep_pattern?.cycle && wl.rep_pattern.cycle.length > 0) {
                  const expanded: (Effort | undefined)[] = [];
                  for (const entry of wl.rep_pattern.cycle) {
                    const count = entry.count || 1;
                    for (let c = 0; c < count; c++) expanded.push(entry.effort);
                  }
                  cycleEfforts = expanded;
                }
                for (let r = 0; r < totalReps; r++) {
                  const rd = rdForSet[lineRdStart + r];
                  let repEffort: Effort | undefined;
                  if (rd?.segments?.length > 0) {
                    repEffort = rd.segments[0].effort;
                  } else if (cycleEfforts) {
                    repEffort = cycleEfforts[r % cycleEfforts.length];
                  } else {
                    repEffort = wl.effort as Effort | undefined;
                  }
                  setLines.push({ yards: wl.distance, effort: repEffort, interval: wl.interval_seconds, distance: wl.distance });
                }
              }
            }

            // Track streaks per bucket within this set
            const streaks: Record<string, number> = {};
            for (const l of setLines) {
              const key = bucketKey(l.interval, l.distance);
              if (key) {
                buckets[key].yards += l.yards;
                streaks[key] = (streaks[key] || 0) + l.yards;
                buckets[key].maxConsec = Math.max(buckets[key].maxConsec, streaks[key]);
              }
              // Reset streaks for other buckets
              for (const bk of Object.keys(buckets)) {
                if (bk !== key) streaks[bk] = 0;
              }
            }
          }

          const activeBuckets = Object.values(buckets).filter((b) => b.yards > 0);
          // Order: easy, moderate, fast, sprint, then any untagged
          const EFFORT_ORDER: string[] = ["easy", "moderate", "fast", "sprint", "untagged"];
          const activeEfforts = EFFORT_ORDER
            .filter((e) => (effortYards[e] || 0) > 0)
            .map((e) => [e, effortYards[e]] as [string, number]);

          if (activeBuckets.length === 0 && activeEfforts.length === 0) return null;

          const totalWorkoutYards = workout.total_yards || 1;
          const cards: { key: string; node: React.ReactNode }[] = [];

          if (activeEfforts.length > 0) {
            cards.push({ key: "effort", node: (
              <View>
                <Text style={s.bdTitle}>EFFORT</Text>
                {activeEfforts.map(([effort, yards]) => {
                  const pct = (yards / totalWorkoutYards) * 100;
                  const barColor = EFFORT_COLORS[effort as Effort] || colors.muted;
                  return (
                    <View key={effort} style={s.bdRow}>
                      <View style={s.bdBarWrap}>
                        <View style={s.bdBarTrack}>
                          <View style={[s.bdBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                        </View>
                      </View>
                      <View style={s.bdMeta}>
                        <Text style={s.bdLabel}>{effort}</Text>
                        <View style={s.bdNums}>
                          <Text style={s.bdYards}>{yards}</Text>
                          <Text style={s.bdPct}>{Math.round(pct)}%</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )});
          }

          if (activeBuckets.length > 0) {
            cards.push({ key: "interval", node: (
              <View>
                <Text style={s.bdTitle}>INTERVAL</Text>
                {activeBuckets.map((b) => {
                  const totalPct = (b.yards / totalWorkoutYards) * 100;
                  const consecPct = (b.maxConsec / totalWorkoutYards) * 100;
                  const hasConsec = b.maxConsec > 0;
                  return (
                    <View key={b.label} style={s.bdRow}>
                      <View style={s.bdBarWrap}>
                        <View style={s.bdBarTrack}>
                          <View style={[s.bdBarFill, { width: `${totalPct}%` as any, backgroundColor: "rgba(56,189,248,0.35)" }]} />
                          {b.maxConsec > 0 && (
                            <View style={[s.bdBarFill, {
                              width: `${consecPct}%` as any,
                              backgroundColor: colors.swim[500],
                              position: "absolute", top: 0, left: 0,
                            }]} />
                          )}
                        </View>
                      </View>
                      <View style={s.bdMeta}>
                        <Text style={s.bdLabel}>{b.label}</Text>
                        <View style={s.bdNums}>
                          <Text style={s.bdYards}>{b.yards}</Text>
                          <Text style={s.bdPct}>{Math.round(totalPct)}%</Text>
                        </View>
                        {hasConsec && (
                          <Text style={s.bdConsecNum}>{b.maxConsec} <Text style={s.bdConsecWord}>consecutive</Text></Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )});
          }

          if (cards.length === 0) return null;

          return (
            <View style={{ marginBottom: 24 }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={s.breakdownPager}
                onMomentumScrollEnd={(e) => {
                  const page = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get("window").width);
                  setBreakdownPage(page);
                }}
              >
                {cards.map((c) => (
                  <View key={c.key} style={s.breakdownPage}>{c.node}</View>
                ))}
              </ScrollView>
              {cards.length > 1 && (
                <View style={s.pageDots}>
                  {cards.map((c, i) => (
                    <View key={c.key} style={[s.pageDot, i === breakdownPage && s.pageDotActive]} />
                  ))}
                </View>
              )}
            </View>
          );
        })()}

        {/* Apple Health Data */}
        {isAvailable() && !healthLoading && healthData && (() => {
          const avgPace = healthData.distance > 0 && healthData.duration
            ? Math.round((healthData.duration / healthData.distance) * 100)
            : null;
          const strokesPerLap = healthData.totalStrokes != null && healthData.lapCount
            ? Math.round(healthData.totalStrokes / healthData.lapCount)
            : null;
          return (
            <>
              <Text style={s.bdTitle}>APPLE WATCH</Text>
              <View style={s.wearableGrid}>
                {healthData.distance > 0 && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{Math.round(healthData.distance).toLocaleString()}</Text>
                    <Text style={s.wearableLbl}>yards</Text>
                  </View>
                )}
                {avgPace != null && (
                  <View style={s.wearableItem}>
                    <Text style={[s.wearableNum, { color: colors.swim[400] }]}>{fmtTime(avgPace)}</Text>
                    <Text style={s.wearableLbl}>pace /100</Text>
                  </View>
                )}
                {healthData.calories > 0 && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{Math.round(healthData.calories)}</Text>
                    <Text style={s.wearableLbl}>cal</Text>
                  </View>
                )}
                {healthData.lapCount != null && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{healthData.lapCount}</Text>
                    <Text style={s.wearableLbl}>laps</Text>
                  </View>
                )}
                {healthData.totalStrokes != null && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{healthData.totalStrokes.toLocaleString()}</Text>
                    <Text style={s.wearableLbl}>strokes</Text>
                  </View>
                )}
                {strokesPerLap != null && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{strokesPerLap}</Text>
                    <Text style={s.wearableLbl}>strokes/lap</Text>
                  </View>
                )}
                {healthData.swolf != null && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{healthData.swolf}</Text>
                    <Text style={s.wearableLbl}>swolf</Text>
                  </View>
                )}
                {healthData.hrv != null && (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{Math.round(healthData.hrv)}</Text>
                    <Text style={s.wearableLbl}>hrv</Text>
                  </View>
                )}
                {healthData.vo2Max != null && (
                  <View style={s.wearableItem}>
                    <Text style={[s.wearableNum, { color: colors.accent.green }]}>{Math.round(healthData.vo2Max)}</Text>
                    <Text style={s.wearableLbl}>vo2 max</Text>
                  </View>
                )}
              </View>

              {(healthData.avgHeartRate != null || healthData.maxHeartRate != null || healthData.restingHeartRate != null) && (
                <View style={s.hrLine}>
                  {healthData.avgHeartRate != null && (
                    <>
                      <Text style={[s.hrNum, { color: colors.accent.red }]}>{healthData.avgHeartRate}</Text>
                      <Text style={s.hrLabel}>avg</Text>
                    </>
                  )}
                  {healthData.maxHeartRate != null && (
                    <>
                      <Text style={s.hrNum}>{healthData.maxHeartRate}</Text>
                      <Text style={s.hrLabel}>max</Text>
                    </>
                  )}
                  {healthData.restingHeartRate != null && (
                    <>
                      <Text style={s.hrNum}>{healthData.restingHeartRate}</Text>
                      <Text style={s.hrLabel}>rest</Text>
                    </>
                  )}
                  <Text style={s.hrLabel}>bpm</Text>
                </View>
              )}

              {/* Stroke breakdown */}
              {healthData.strokeBreakdown && Object.keys(healthData.strokeBreakdown).length > 0 && (
                <View style={{ marginTop: 8, marginBottom: 8 }}>
                  {Object.entries(healthData.strokeBreakdown)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([stroke, yards]) => (
                      <View key={stroke} style={s.strokeBreakdownRow}>
                        <Text style={s.strokeBreakdownName}>{stroke}</Text>
                        <Text style={s.strokeBreakdownYards}>{Math.round(yards as number)}</Text>
                      </View>
                    ))}
                </View>
              )}
              <View style={s.divider} />
            </>
          );
        })()}

        {/* Whoop Data */}
        {!whoopLoading && whoopData && (whoopData.recovery_score != null || whoopData.strain_score != null) && (
          <>
            <Text style={s.bdTitle}>WHOOP</Text>
            {/* Hero: Recovery + Swim Strain */}
            <View style={s.whoopHeroRow}>
              {whoopData.recovery_score != null && (
                <View style={s.whoopHeroItem}>
                  <Text style={[s.whoopHeroNum, {
                    color: whoopData.recovery_score >= 67 ? colors.accent.green : whoopData.recovery_score >= 34 ? colors.accent.yellow : colors.accent.red,
                  }]}>{Math.round(whoopData.recovery_score)}%</Text>
                  <Text style={s.whoopHeroLbl}>recovery</Text>
                </View>
              )}
              {whoopData.workout_strain != null && (
                <View style={s.whoopHeroItem}>
                  <Text style={s.whoopHeroNum}>{whoopData.workout_strain.toFixed(1)}</Text>
                  <Text style={s.whoopHeroLbl}>swim strain</Text>
                </View>
              )}
            </View>

            {/* Sleep + HRV row */}
            <View style={s.wearableGrid}>
              {whoopData.sleep_performance != null && (
                <View style={s.wearableItem}>
                  <Text style={s.wearableNum}>{Math.round(whoopData.sleep_performance)}%</Text>
                  <Text style={s.wearableLbl}>sleep score</Text>
                </View>
              )}
              {whoopData.hrv != null && (
                <View style={s.wearableItem}>
                  <Text style={s.wearableNum}>{Math.round(whoopData.hrv)}</Text>
                  <Text style={s.wearableLbl}>hrv</Text>
                </View>
              )}
              {whoopData.sleep_total_milli != null && (
                <View style={s.wearableItem}>
                  <Text style={s.wearableNum}>
                    {Math.floor(whoopData.sleep_total_milli / 3600000)}:{Math.floor((whoopData.sleep_total_milli % 3600000) / 60000).toString().padStart(2, "0")}
                  </Text>
                  <Text style={s.wearableLbl}>sleep</Text>
                </View>
              )}
              {whoopData.strain_score != null && (
                <View style={s.wearableItem}>
                  <Text style={s.wearableNum}>{whoopData.strain_score.toFixed(1)}</Text>
                  <Text style={s.wearableLbl}>day strain</Text>
                </View>
              )}
              {whoopData.workout_duration_milli != null && (() => {
                const totalMin = Math.floor(whoopData.workout_duration_milli / 60000);
                return (
                  <View style={s.wearableItem}>
                    <Text style={s.wearableNum}>{totalMin}</Text>
                    <Text style={s.wearableLbl}>swim min</Text>
                  </View>
                );
              })()}
              {whoopData.zone_durations && (() => {
                const zd = whoopData.zone_durations!;
                const zoneColors: Record<string, string> = {
                  zone_five_milli: colors.accent.red,
                  zone_four_milli: "#f97316",
                  zone_three_milli: colors.accent.green,
                  zone_two_milli: "#3b82f6",
                  zone_one_milli: "#9ca3af",
                  zone_zero_milli: "#6b7280",
                };
                const zoneNames: Record<string, string> = {
                  zone_five_milli: "zone 5",
                  zone_four_milli: "zone 4",
                  zone_three_milli: "zone 3",
                  zone_two_milli: "zone 2",
                  zone_one_milli: "zone 1",
                  zone_zero_milli: "zone 0",
                };
                let maxKey = "";
                let maxMs = 0;
                for (const [key, val] of Object.entries(zoneColors)) {
                  const ms = (zd as any)[key] || 0;
                  if (ms > maxMs) { maxMs = ms; maxKey = key; }
                }
                if (maxMs === 0) return null;
                const min = Math.floor(maxMs / 60000);
                const sec = Math.floor((maxMs % 60000) / 1000);
                return (
                  <View style={s.wearableItem}>
                    <Text style={[s.wearableNum, { color: zoneColors[maxKey] }]}>
                      {min}:{sec.toString().padStart(2, "0")}
                    </Text>
                    <Text style={s.wearableLbl}>{zoneNames[maxKey]}</Text>
                  </View>
                );
              })()}
              {whoopData.workout_calories != null && (
                <View style={s.wearableItem}>
                  <Text style={s.wearableNum}>{whoopData.workout_calories}</Text>
                  <Text style={s.wearableLbl}>cal</Text>
                </View>
              )}
            </View>

            {/* HR line */}
            {(whoopData.workout_avg_hr != null || whoopData.workout_max_hr != null || whoopData.resting_hr != null) && (
              <View style={s.hrLine}>
                {whoopData.workout_avg_hr != null && (
                  <>
                    <Text style={[s.hrNum, { color: colors.accent.red }]}>{whoopData.workout_avg_hr}</Text>
                    <Text style={s.hrLabel}>avg</Text>
                  </>
                )}
                {whoopData.workout_max_hr != null && (
                  <>
                    <Text style={s.hrNum}>{whoopData.workout_max_hr}</Text>
                    <Text style={s.hrLabel}>max</Text>
                  </>
                )}
                {whoopData.resting_hr != null && (
                  <>
                    <Text style={s.hrNum}>{whoopData.resting_hr}</Text>
                    <Text style={s.hrLabel}>rest</Text>
                  </>
                )}
                <Text style={s.hrLabel}>bpm</Text>
              </View>
            )}

            {/* HR Zones */}
            {whoopData.zone_durations && (() => {
              const zd = whoopData.zone_durations!;
              const bands = whoopData.zone_bands;
              const zones = [
                { label: "5", key: "zone_five_milli", color: colors.accent.red,
                  bpm: bands ? `${bands.zone4Max + 1}+` : "90%+" },
                { label: "4", key: "zone_four_milli", color: "#f97316",
                  bpm: bands ? `${bands.zone3Max + 1}-${bands.zone4Max}` : "80-90%" },
                { label: "3", key: "zone_three_milli", color: colors.accent.green,
                  bpm: bands ? `${bands.zone2Max + 1}-${bands.zone3Max}` : "70-80%" },
                { label: "2", key: "zone_two_milli", color: "#3b82f6",
                  bpm: bands ? `${bands.zone1Max + 1}-${bands.zone2Max}` : "60-70%" },
                { label: "1", key: "zone_one_milli", color: "#9ca3af",
                  bpm: bands ? `${bands.zone0Max + 1}-${bands.zone1Max}` : "50-60%" },
                { label: "0", key: "zone_zero_milli", color: "#6b7280",
                  bpm: bands ? `<${bands.zone0Max}` : "<50%" },
              ];
              const total = zones.reduce((sum, z) => sum + ((zd as any)[z.key] || 0), 0);
              if (total === 0) return null;
              const fmtDur = (ms: number) => {
                const min = Math.floor(ms / 60000);
                const sec = Math.floor((ms % 60000) / 1000);
                return `${min}:${sec.toString().padStart(2, "0")}`;
              };
              return (
                <View style={{ marginTop: 16 }}>
                  <Text style={[s.bdTitle, { marginBottom: 12 }]}>HR ZONES</Text>
                  {zones.map((z) => {
                    const ms = (zd as any)[z.key] || 0;
                    const pct = Math.round((ms / total) * 100);
                    return (
                      <View key={z.key} style={s.zoneRow}>
                        <Text style={[s.zoneLbl, { color: z.color }]}>{z.label}</Text>
                        <View style={s.zoneBarWrap}>
                          <View style={s.bdBarTrack}>
                            <View style={[s.bdBarFill, { width: `${pct}%` as any, backgroundColor: z.color }]} />
                          </View>
                        </View>
                        <Text style={s.zonePct}>{pct}%</Text>
                        <Text style={s.zoneDurText}>{fmtDur(ms)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
            <View style={s.divider} />
          </>
        )}

        {/* Notes */}
        {workout.notes ? (
          <View style={s.notesCard}>
            <Text style={s.notesLabel}>NOTES</Text>
            <Text style={s.notesText}>{workout.notes}</Text>
          </View>
        ) : null}

        {/* Sets */}
        {/* Workout Photos */}
        {workout.photos && workout.photos.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.setsHeader}>WORKOUT BOARD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {workout.photos.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={s.workoutPhoto}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={s.setsHeader}>SETS ({workout.sets.length})</Text>
        {(() => { let cumYards = 0; return workout.sets.map((set, setIdx) => {
          const hasRepDetails = set.rep_details && set.rep_details.length > 0;
          let repOffset = 0;
          const setYards = (set.groups || []).reduce((sum, g) => {
            const rounds = g.rounds || 1;
            return sum + g.lines.reduce((ls, l) => {
              if (l.kind === "rest") return ls;
              const wl = l as WorkLine;
              return ls + wl.reps * wl.distance;
            }, 0) * rounds;
          }, 0);
          const yardsBefore = cumYards;
          cumYards += setYards;

          return (
            <View key={set.id} style={s.setCard}>
              <View style={s.setCardHeader}>
                <View>
                  <Text style={s.setCardNum}>SET {setIdx + 1}{set.description ? ` — ${set.description}` : ""}</Text>
                  {yardsBefore > 0 && (
                    <Text style={s.setCardCum}>{yardsBefore} in</Text>
                  )}
                </View>
                {setYards > 0 && <Text style={s.setCardYards}>{setYards}</Text>}
              </View>
              {(set.groups || []).map((group, gi) => (
                <View key={group.id} style={gi > 0 ? s.groupDivider : undefined}>
                  {(group.rounds || 1) > 1 && (
                    <Text style={s.roundsBadge}>{group.rounds}× through</Text>
                  )}
                  <View style={(group.rounds || 1) > 1 ? s.bracketWrap : undefined}>
                    {(group.rounds || 1) > 1 && <View style={s.bracketBar} />}
                    <View style={{ flex: 1 }}>
              {group.lines.map((line, li) => {
                if (line.kind === "rest") {
                  return (
                    <View key={line.id} style={[li > 0 ? s.lineDivider : undefined, s.restLine]}>
                      <Text style={s.restLineText}>
                        {line.rest_seconds >= 60
                          ? `${Math.floor(line.rest_seconds / 60)}:${(line.rest_seconds % 60).toString().padStart(2, "0")}`
                          : `:${line.rest_seconds}`} rest
                      </Text>
                    </View>
                  );
                }
                const wl = line as WorkLine;
                const rounds = group.rounds || 1;
                const lineStart = repOffset;
                repOffset += wl.reps * rounds;

                // Build tags string
                const tags: string[] = [];
                if (wl.mode && wl.mode !== "swim") tags.push(wl.mode);
                if (wl.effort) tags.push(wl.effort);
                if (wl.modifiers) tags.push(...wl.modifiers.map((m) => m.replace("_", " ")));
                if (wl.equipment) tags.push(...wl.equipment);
                if (wl.breathing) {
                  if (wl.breathing.type === "none") tags.push("no breath");
                  else if (wl.breathing.type === "every_n") tags.push(`breathe every ${wl.breathing.value}`);
                  else if (wl.breathing.type === "limited") tags.push(`${wl.breathing.value} breath/25`);
                }

                return (
                  <View key={wl.id} style={li > 0 ? s.lineDivider : undefined}>
                    <View style={s.setRow}>
                      <Text style={s.setText}>
                        {wl.reps > 1 ? `${wl.reps} x ` : ""}{wl.distance}
                        <Text style={s.setStroke}> {wl.stroke}</Text>
                      </Text>
                      <View style={s.lineRight}>
                        {(() => {
                          const poolLen = workout.pool_length || 25;
                          const totalReps = wl.reps * rounds;
                          const segsPerRep = Math.max(1, Math.floor(wl.distance / poolLen));
                          const defaultColor = wl.effort ? (EFFORT_COLORS[wl.effort] || colors.muted) : colors.muted;

                          // If rep_pattern exists, show one dot per rep colored by cycle
                          if (wl.rep_pattern?.cycle && wl.rep_pattern.cycle.length > 0) {
                            const cycle = wl.rep_pattern.cycle;
                            // Expand cycle with counts into flat effort array
                            const expanded: (Effort | undefined)[] = [];
                            for (const entry of cycle) {
                              const count = entry.count || 1;
                              for (let c = 0; c < count; c++) expanded.push(entry.effort);
                            }
                            return (
                              <View style={s.effortDots}>
                                {Array.from({ length: totalReps }, (_, ri) => {
                                  const cycleEffort = expanded[ri % expanded.length];
                                  const color = cycleEffort ? (EFFORT_COLORS[cycleEffort] || colors.muted) : defaultColor;
                                  return <View key={ri} style={[s.effortDot, { backgroundColor: color }]} />;
                                })}
                              </View>
                            );
                          }

                          // If multiple reps and has rep details, show one dot per rep
                          if (totalReps > 1 && hasRepDetails) {
                            return (
                              <View style={s.effortDots}>
                                {Array.from({ length: totalReps }, (_, ri) => {
                                  const rep = set.rep_details[lineStart + ri];
                                  // Use the dominant effort from segments
                                  const repEffort = rep?.segments?.[0]?.effort;
                                  const color = repEffort ? (EFFORT_COLORS[repEffort] || colors.muted) : defaultColor;
                                  return <View key={ri} style={[s.effortDot, { backgroundColor: color }]} />;
                                })}
                              </View>
                            );
                          }

                          // Default: show per-25 dots for single rep
                          const segs = hasRepDetails ? set.rep_details[lineStart]?.segments : null;
                          return (
                            <View style={s.effortDots}>
                              {Array.from({ length: segsPerRep }, (_, di) => {
                                const seg = segs?.[di];
                                const color = seg ? (EFFORT_COLORS[seg.effort] || colors.muted) : defaultColor;
                                return <View key={di} style={[s.effortDot, { backgroundColor: color }]} />;
                              })}
                            </View>
                          );
                        })()}
                        {wl.interval_seconds != null && (
                          <Text style={s.setInterval}>@ {fmtTime(wl.interval_seconds)}</Text>
                        )}
                      </View>
                    </View>
                    {tags.length > 0 && (
                      <View style={s.tagRow}>
                        {tags.map((tag, ti) => (
                          <View key={ti} style={s.tagBadge}>
                            <Text style={s.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {wl.targets && (
                      <View style={s.tagRow}>
                        {wl.targets.stroke_count != null && (
                          <View style={s.tagBadge}><Text style={s.tagText}>{wl.targets.stroke_count} strokes</Text></View>
                        )}
                        {wl.targets.dps != null && (
                          <View style={s.tagBadge}><Text style={s.tagText}>DPS {wl.targets.dps}</Text></View>
                        )}
                        {wl.targets.tempo_seconds != null && (
                          <View style={s.tagBadge}><Text style={s.tagText}>tempo {wl.targets.tempo_seconds}s</Text></View>
                        )}
                      </View>
                    )}

                    {wl.actuals && wl.actuals.length > 0 && (
                      <View style={s.actualsRow}>
                        {wl.actuals.map((a, ai) => (
                          <View key={ai} style={s.actualBadge}>
                            <Text style={s.actualText}>{fmtTime(a.time_seconds)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {hasRepDetails && wl.reps > 1 &&
                      set.rep_details.slice(lineStart, lineStart + wl.reps).map((rep, localRi) => {
                        if (!rep) return null;
                        const hasCustomInterval =
                          rep.interval != null && rep.interval !== wl.interval_seconds;
                        const hasSegments =
                          rep.segments &&
                          rep.segments.length > 1 &&
                          !(rep.segments.every((seg) => seg.stroke === wl.stroke) &&
                            rep.segments.every((seg) => seg.effort === rep.segments[0].effort));
                        if (!hasCustomInterval && !hasSegments) return null;
                        return (
                          <View key={localRi} style={s.repDetail}>
                            <Text style={s.repLabel}>#{localRi + 1}</Text>
                            {hasCustomInterval && (
                              <Text style={s.repInterval}>@ {fmtTime(rep.interval!)}</Text>
                            )}
                            {hasSegments && (
                              <View style={s.segmentRow}>
                                {rep.segments.map((seg, si) => (
                                  <View
                                    key={si}
                                    style={[s.segBadge, { borderLeftColor: EFFORT_COLORS[seg.effort] || colors.muted }]}
                                  >
                                    <Text style={s.segText}>
                                      {seg.distance} {seg.stroke} {seg.effort}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                  </View>
                );
              })}
                    </View>
                  </View>
                </View>
              ))}

            </View>
          );
        }); })()}

        {/* Benchmarks */}
        {workout.benchmarks && workout.benchmarks.length > 0 && (
          <View>
            <Text style={s.setsHeader}>BENCHMARKS</Text>
            {workout.benchmarks.map((bm) => (
              <View key={bm.id} style={s.benchmarkCard}>
                <View style={s.setRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.benchmarkName}>{bm.name}</Text>
                    <Text style={s.benchmarkType}>
                      {bm.type === "test_set" ? "Test Set" : bm.type === "time_trial" ? "Time Trial" : "Custom"}
                      {bm.stroke ? ` · ${bm.stroke}` : ""}
                    </Text>
                  </View>
                  <View style={s.benchmarkStats}>
                    {bm.reps != null && bm.distance != null && (
                      <Text style={s.benchmarkStat}>{bm.reps}x{bm.distance}</Text>
                    )}
                    {bm.distance != null && !bm.reps && (
                      <Text style={s.benchmarkStat}>{bm.distance}</Text>
                    )}
                    {bm.interval_seconds != null && (
                      <Text style={s.benchmarkPace}>@ {fmtTime(bm.interval_seconds)}</Text>
                    )}
                    {bm.avg_pace_per_100 != null && (
                      <Text style={s.benchmarkPace}>{fmtTime(bm.avg_pace_per_100)}/100</Text>
                    )}
                    {bm.total_time_seconds != null && (
                      <Text style={s.benchmarkPace}>{fmtTime(bm.total_time_seconds)}</Text>
                    )}
                    {bm.value != null && (
                      <Text style={s.benchmarkStat}>{bm.value}{bm.unit ? ` ${bm.unit}` : ""}</Text>
                    )}
                  </View>
                </View>
                {bm.notes && <Text style={s.setDesc}>{bm.notes}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Delete */}
        <Pressable style={s.deleteBtn} onPress={handleDelete}>
          <FontAwesome name="trash-o" size={16} color={colors.accent.red} />
          <Text style={s.deleteBtnText}>Delete Workout</Text>
        </Pressable>
      </View>
    </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16,
    marginBottom: 8,
  },
  dateText: { fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, width: 200, textAlign: "center" },
  heroNum: {
    fontSize: 64, fontWeight: "800", color: colors.white, textAlign: "center",
    letterSpacing: -2, lineHeight: 68,
  },
  heroUnit: {
    fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.45)",
    textAlign: "center", textTransform: "uppercase", letterSpacing: 3,
    marginTop: 2, marginBottom: 24,
  },
  statsGrid: {
    flexDirection: "row", justifyContent: "center", gap: 32,
    marginBottom: 20,
  },
  statItem: { alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "700", color: colors.white },
  statDenom: { fontSize: 14, fontWeight: "400", color: "rgba(255,255,255,0.45)" },
  statLbl: {
    fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2,
  },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 24 },
  wearableGrid: {
    flexDirection: "row", flexWrap: "wrap", marginBottom: 8,
  },
  wearableItem: {
    width: "33.33%", alignItems: "center", paddingVertical: 12,
  },
  wearableNum: { fontSize: 22, fontWeight: "700", color: colors.white },
  wearableLbl: {
    fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase", letterSpacing: 1, marginTop: 2,
  },
  hrLine: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "center",
    marginBottom: 16, gap: 4,
  },
  hrNum: { fontSize: 22, fontWeight: "700", color: colors.white },
  hrLabel: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.35)", marginRight: 12 },
  strokeBreakdownRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  strokeBreakdownName: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)", textTransform: "capitalize" },
  strokeBreakdownYards: { fontSize: 14, fontWeight: "700", color: colors.white },
  whoopHeroRow: {
    flexDirection: "row", justifyContent: "center", gap: 40, marginBottom: 16,
  },
  whoopHeroItem: { alignItems: "center" },
  whoopHeroNum: { fontSize: 36, fontWeight: "800", color: colors.white, letterSpacing: -1 },
  whoopHeroLbl: {
    fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase", letterSpacing: 2, marginTop: 2,
  },
  zoneRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 8,
  },
  zoneLbl: { fontSize: 13, fontWeight: "800", width: 20 },
  zoneBarWrap: { flex: 1, marginHorizontal: 10 },
  zonePct: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.5)", width: 36, textAlign: "right" },
  zoneDurText: { fontSize: 13, fontWeight: "600", color: colors.white, width: 44, textAlign: "right" },
  notesCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  notesLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  notesText: { fontSize: 15, color: colors.white, lineHeight: 22 },
  setsHeader: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 },
  setCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  setCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  setCardNum: { fontSize: 11, color: colors.swim[400], fontWeight: "700", letterSpacing: 0.5 },
  setCardCum: { fontSize: 10, color: colors.muted, fontWeight: "600", marginTop: 2 },
  setCardYards: { fontSize: 15, color: colors.white, fontWeight: "800" },
  setRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  setText: { fontSize: 17, fontWeight: "700", color: colors.white },
  setStroke: { fontSize: 14, fontWeight: "600", color: colors.swim[400] },
  lineRight: { flexDirection: "row", alignItems: "center" },
  effortDots: { flexDirection: "row", marginRight: 8 },
  effortDot: { width: 7, height: 7, borderRadius: 4, marginRight: 3 },
  setInterval: { fontSize: 13, color: colors.muted },
  groupDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
  roundsBadge: { fontSize: 12, fontWeight: "700", color: colors.swim[400], marginBottom: 6 },
  bracketWrap: { flexDirection: "row" },
  bracketBar: { width: 3, backgroundColor: colors.swim[600], borderRadius: 2, marginRight: 10, marginVertical: 2 },
  lineDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
  restLine: { paddingVertical: 6, alignItems: "center" },
  restLineText: { fontSize: 13, fontWeight: "600", color: colors.muted, fontStyle: "italic" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  tagBadge: {
    backgroundColor: colors.surfaceLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    marginRight: 4, marginBottom: 2,
  },
  tagText: { fontSize: 10, fontWeight: "600", color: colors.swim[400] },
  actualsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  actualBadge: {
    backgroundColor: colors.surfaceLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    marginRight: 4, marginBottom: 2, borderLeftWidth: 2, borderLeftColor: colors.swim[500],
  },
  actualText: { fontSize: 12, fontWeight: "700", color: colors.white },
  breakdownPager: { marginHorizontal: -20 },
  breakdownPage: { width: Dimensions.get("window").width, paddingHorizontal: 20 },
  pageDots: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 3 },
  pageDotActive: { backgroundColor: colors.swim[500] },
  bdTitle: {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.4)",
    letterSpacing: 2, textTransform: "uppercase", marginBottom: 20,
  },
  bdRow: { marginBottom: 20 },
  bdBarWrap: { marginBottom: 8 },
  bdBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  bdBarFill: { height: 6, borderRadius: 3 },
  bdMeta: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  bdLabel: {
    fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.4)", textTransform: "capitalize", marginRight: 12,
  },
  bdNums: { flexDirection: "row", alignItems: "baseline", gap: 8, marginLeft: "auto" },
  bdYards: { fontSize: 17, fontWeight: "700", color: colors.white },
  bdPct: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  bdConsecNum: {
    fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.6)",
    marginLeft: "auto",
  },
  bdConsecWord: {
    fontWeight: "500", color: "rgba(255,255,255,0.25)",
  },
  setDesc: { fontSize: 13, color: colors.muted, marginTop: 6 },
  repDetail: {
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8,
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
  },
  repLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, marginRight: 8 },
  repInterval: { fontSize: 11, color: colors.swim[400], marginRight: 8 },
  segmentRow: { flexDirection: "row", flexWrap: "wrap" },
  segBadge: {
    backgroundColor: colors.surfaceLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    marginRight: 4, marginBottom: 4, borderLeftWidth: 3,
  },
  segText: { fontSize: 10, fontWeight: "600", color: colors.white },
  benchmarkCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.accent.yellow, borderLeftWidth: 3,
  },
  benchmarkName: { fontSize: 16, fontWeight: "700", color: colors.white },
  benchmarkType: { fontSize: 11, color: colors.accent.yellow, fontWeight: "600", marginTop: 2 },
  benchmarkStats: { alignItems: "flex-end" },
  benchmarkStat: { fontSize: 14, fontWeight: "700", color: colors.white },
  benchmarkPace: { fontSize: 13, fontWeight: "600", color: colors.swim[400], marginTop: 2 },
  workoutPhoto: {
    width: Dimensions.get("window").width - 56,
    height: 200,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: colors.surfaceLight,
  },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: colors.border, marginTop: 24,
  },
  deleteBtnText: { color: colors.accent.red, fontSize: 15, fontWeight: "600", marginLeft: 8 },
});
