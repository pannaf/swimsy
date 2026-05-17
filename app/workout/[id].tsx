import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { getWorkout, getWorkouts, deleteWorkout, StoredWorkout } from "../../lib/storage";
import { Effort } from "../../lib/types";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<StoredWorkout | null>(null);
  const [healthData, setHealthData] = useState<HealthSwimData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopDayData | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(false);
  const [allIds, setAllIds] = useState<string[]>([]);

  useEffect(() => {
    getWorkouts().then((all) => setAllIds(all.map((w) => w.id)));
    getWorkout(id).then((w) => {
      if (w) {
        setWorkout(w);
        setHealthData(null);
        setWhoopData(null);
        fetchHealthData(w.date);
        fetchWhoopData(w.date);
      }
    });
  }, [id]);

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
      }}
    />
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.container}>
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.yards}>{workout.total_yards}</Text>
          <Pressable onPress={() => router.push(`/(tabs)/log?editId=${id}`)} style={s.editBtn}>
            <FontAwesome name="pencil" size={14} color={colors.swim[500]} />
            <Text style={s.editBtnText}>Edit</Text>
          </Pressable>
        </View>
        <Text style={s.meta}>
          {workout.pool_unit} {"\u00B7"}{" "}
          {new Date(workout.date).toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })}
        </Text>

        {/* Navigation */}
        {allIds.length > 1 && (() => {
          const idx = allIds.indexOf(id);
          const prevId = idx < allIds.length - 1 ? allIds[idx + 1] : null;
          const nextId = idx > 0 ? allIds[idx - 1] : null;
          return (
            <View style={s.navRow}>
              <Pressable
                style={[s.navBtn, !prevId && s.navBtnDisabled]}
                disabled={!prevId}
                onPress={() => prevId && router.replace(`/workout/${prevId}`)}
              >
                <FontAwesome name="chevron-left" size={14} color={prevId ? colors.swim[400] : colors.border} />
                <Text style={[s.navBtnText, !prevId && s.navBtnTextDisabled]}>Older</Text>
              </Pressable>
              <Text style={s.navCount}>{allIds.length - idx} of {allIds.length}</Text>
              <Pressable
                style={[s.navBtn, !nextId && s.navBtnDisabled]}
                disabled={!nextId}
                onPress={() => nextId && router.replace(`/workout/${nextId}`)}
              >
                <Text style={[s.navBtnText, !nextId && s.navBtnTextDisabled]}>Newer</Text>
                <FontAwesome name="chevron-right" size={14} color={nextId ? colors.swim[400] : colors.border} />
              </Pressable>
            </View>
          );
        })()}

        {/* Stats */}
        <View style={s.statsRow}>
          {workout.duration_minutes != null && (
            <View style={[s.statCard, { marginRight: 8 }]}>
              <Text style={s.statLabel}>DURATION</Text>
              <Text style={s.statValue}>{workout.duration_minutes}</Text>
              <Text style={s.statUnit}>min</Text>
            </View>
          )}
          {workout.feeling_score != null && (
            <View style={[s.statCard, { marginRight: 8 }]}>
              <Text style={[s.statLabel, { color: colors.swim[400] }]}>FEELING</Text>
              <Text style={s.statValue}>{workout.feeling_score}</Text>
              <Text style={s.statUnit}>out of 10</Text>
            </View>
          )}
          <View style={s.statCard}>
            <Text style={s.statLabel}>POOL</Text>
            <Text style={s.statValue}>{workout.pool_length}</Text>
            <Text style={s.statUnit}>{workout.pool_unit === "yards" ? "yd" : "m"}</Text>
          </View>
        </View>

        {/* Apple Health Data */}
        {isAvailable() && (
          <View style={{ marginBottom: 20 }}>
            <Text style={s.setsHeader}>APPLE HEALTH</Text>
            {healthLoading ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>Loading health data...</Text>
            ) : healthData ? (
              <>
                <View style={s.statsRow}>
                  {healthData.avgHeartRate != null && (
                    <View style={[s.statCard, { marginRight: 8 }]}>
                      <Text style={[s.statLabel, { color: colors.accent.red }]}>AVG HR</Text>
                      <Text style={s.statValue}>{healthData.avgHeartRate}</Text>
                      <Text style={s.statUnit}>bpm</Text>
                    </View>
                  )}
                  {healthData.maxHeartRate != null && (
                    <View style={[s.statCard, { marginRight: 8 }]}>
                      <Text style={s.statLabel}>MAX HR</Text>
                      <Text style={s.statValue}>{healthData.maxHeartRate}</Text>
                      <Text style={s.statUnit}>bpm</Text>
                    </View>
                  )}
                  {healthData.calories > 0 && (
                    <View style={s.statCard}>
                      <Text style={s.statLabel}>CALORIES</Text>
                      <Text style={s.statValue}>{Math.round(healthData.calories)}</Text>
                      <Text style={s.statUnit}>kcal</Text>
                    </View>
                  )}
                </View>
                <View style={[s.statsRow, { marginTop: 8 }]}>
                  {healthData.restingHeartRate != null && (
                    <View style={[s.statCard, { marginRight: 8 }]}>
                      <Text style={s.statLabel}>RESTING HR</Text>
                      <Text style={s.statValue}>{healthData.restingHeartRate}</Text>
                      <Text style={s.statUnit}>bpm</Text>
                    </View>
                  )}
                  {healthData.hrv != null && (
                    <View style={[s.statCard, { marginRight: 8 }]}>
                      <Text style={s.statLabel}>HRV</Text>
                      <Text style={s.statValue}>{Math.round(healthData.hrv)}</Text>
                      <Text style={s.statUnit}>ms</Text>
                    </View>
                  )}
                  {healthData.sleepHours != null && (
                    <View style={[s.statCard, { marginRight: 8 }]}>
                      <Text style={s.statLabel}>SLEEP</Text>
                      <Text style={s.statValue}>{healthData.sleepHours}</Text>
                      <Text style={s.statUnit}>hrs</Text>
                    </View>
                  )}
                  {healthData.vo2Max != null && (
                    <View style={s.statCard}>
                      <Text style={[s.statLabel, { color: colors.accent.green }]}>VO2 MAX</Text>
                      <Text style={s.statValue}>{Math.round(healthData.vo2Max)}</Text>
                      <Text style={s.statUnit}>ml/kg/min</Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 13 }}>No Apple Watch swim data found for this day</Text>
            )}
          </View>
        )}

        {/* Whoop Data */}
        {whoopLoading ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 20 }}>Loading Whoop data...</Text>
        ) : whoopData && (whoopData.recovery_score != null || whoopData.strain_score != null) ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={s.setsHeader}>WHOOP</Text>
            <View style={s.statsRow}>
              {whoopData.recovery_score != null && (
                <View style={[s.statCard, { marginRight: 8, borderLeftWidth: 3, borderLeftColor: whoopData.recovery_score >= 67 ? colors.accent.green : whoopData.recovery_score >= 34 ? colors.accent.yellow : colors.accent.red }]}>
                  <Text style={s.statLabel}>RECOVERY</Text>
                  <Text style={s.statValue}>{Math.round(whoopData.recovery_score)}%</Text>
                </View>
              )}
              {whoopData.strain_score != null && (
                <View style={[s.statCard, { marginRight: 8 }]}>
                  <Text style={s.statLabel}>STRAIN</Text>
                  <Text style={s.statValue}>{whoopData.strain_score.toFixed(1)}</Text>
                </View>
              )}
              {whoopData.hrv != null && (
                <View style={[s.statCard, { marginRight: 8 }]}>
                  <Text style={s.statLabel}>HRV</Text>
                  <Text style={s.statValue}>{Math.round(whoopData.hrv)}</Text>
                  <Text style={s.statUnit}>ms</Text>
                </View>
              )}
              {whoopData.resting_hr != null && (
                <View style={s.statCard}>
                  <Text style={s.statLabel}>RESTING HR</Text>
                  <Text style={s.statValue}>{whoopData.resting_hr}</Text>
                  <Text style={s.statUnit}>bpm</Text>
                </View>
              )}
            </View>
            <View style={[s.statsRow, { marginTop: 8 }]}>
              {whoopData.sleep_total_milli != null && (
                <View style={[s.statCard, { marginRight: 8 }]}>
                  <Text style={s.statLabel}>SLEEP</Text>
                  <Text style={s.statValue}>
                    {Math.floor(whoopData.sleep_total_milli / 3600000)}:{Math.floor((whoopData.sleep_total_milli % 3600000) / 60000).toString().padStart(2, "0")}
                  </Text>
                  {whoopData.sleep_restorative_milli != null && (
                    <Text style={s.statUnitSm}>
                      {Math.floor(whoopData.sleep_restorative_milli / 3600000)}:{Math.floor((whoopData.sleep_restorative_milli % 3600000) / 60000).toString().padStart(2, "0")} restorative
                    </Text>
                  )}
                </View>
              )}
              {whoopData.workout_duration_milli != null && (() => {
                const totalMin = Math.floor(whoopData.workout_duration_milli / 60000);
                // Find swim start/end from the workout data
                const startTime = whoopData.workout_start;
                const endTime = whoopData.workout_end;
                const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                return (
                  <View style={[s.statCard, { marginRight: 8 }]}>
                    <Text style={s.statLabel}>DURATION</Text>
                    <Text style={s.statValue}>
                      {totalMin} <Text style={s.statUnit}>min</Text>
                    </Text>
                    {startTime && endTime && (
                      <Text style={s.statUnitSm}>{fmtClock(startTime)} – {fmtClock(endTime)}</Text>
                    )}
                  </View>
                );
              })()}
              {whoopData.workout_strain != null && (
                <View style={s.statCard}>
                  <Text style={s.statLabel}>SWIM STRAIN</Text>
                  <Text style={s.statValue}>{whoopData.workout_strain.toFixed(1)}</Text>
                </View>
              )}
            </View>
            {(whoopData.workout_avg_hr != null || whoopData.workout_calories != null) && (
              <View style={[s.statsRow, { marginTop: 8 }]}>
                {whoopData.workout_avg_hr != null && (
                  <View style={[s.statCard, { marginRight: 8 }]}>
                    <Text style={[s.statLabel, { color: colors.accent.red }]}>AVG HR</Text>
                    <Text style={s.statValue}>{whoopData.workout_avg_hr}</Text>
                    <Text style={s.statUnit}>bpm</Text>
                  </View>
                )}
                {whoopData.workout_max_hr != null && (
                  <View style={[s.statCard, { marginRight: 8 }]}>
                    <Text style={s.statLabel}>MAX HR</Text>
                    <Text style={s.statValue}>{whoopData.workout_max_hr}</Text>
                    <Text style={s.statUnit}>bpm</Text>
                  </View>
                )}
                {whoopData.workout_calories != null && (
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>CALORIES</Text>
                    <Text style={s.statValue}>{whoopData.workout_calories}</Text>
                    <Text style={s.statUnit}>kcal</Text>
                  </View>
                )}
              </View>
            )}
            {/* HR Zones */}
            {whoopData.zone_durations && (() => {
              const zd = whoopData.zone_durations!;
              const bands = whoopData.zone_bands;
              const zones = [
                { num: 5, label: "ZONE 5", key: "zone_five_milli", color: colors.accent.red,
                  bpm: bands ? `${bands.zone4Max + 1}+` : "90%+" },
                { num: 4, label: "ZONE 4", key: "zone_four_milli", color: "#f97316",
                  bpm: bands ? `${bands.zone3Max + 1}-${bands.zone4Max}` : "80-90%" },
                { num: 3, label: "ZONE 3", key: "zone_three_milli", color: colors.accent.green,
                  bpm: bands ? `${bands.zone2Max + 1}-${bands.zone3Max}` : "70-80%" },
                { num: 2, label: "ZONE 2", key: "zone_two_milli", color: "#3b82f6",
                  bpm: bands ? `${bands.zone1Max + 1}-${bands.zone2Max}` : "60-70%" },
                { num: 1, label: "ZONE 1", key: "zone_one_milli", color: "#9ca3af",
                  bpm: bands ? `${bands.zone0Max + 1}-${bands.zone1Max}` : "50-60%" },
                { num: 0, label: "ZONE 0", key: "zone_zero_milli", color: "#6b7280",
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
                <View style={{ marginTop: 12 }}>
                  <Text style={s.zoneTitle}>HR ZONES</Text>
                  {zones.map((z) => {
                    const ms = (zd as any)[z.key] || 0;
                    const pct = Math.round((ms / total) * 100);
                    return (
                      <View key={z.key} style={s.zoneCard}>
                        <View style={s.zoneCardHeader}>
                          <Text style={s.zoneNum}>{z.label}</Text>
                          <Text style={s.zoneBpm}>{z.bpm} BPM</Text>
                          <Text style={[s.zonePctText, { color: z.color }]}>{pct}%</Text>
                          <Text style={s.zoneDur}>{fmtDur(ms)}</Text>
                        </View>
                        <View style={s.zoneBarBg}>
                          <View style={[s.zoneBarFill, { width: `${pct}%` as any, backgroundColor: z.color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        ) : null}

        {/* Notes */}
        {workout.notes ? (
          <View style={s.notesCard}>
            <Text style={s.notesLabel}>NOTES</Text>
            <Text style={s.notesText}>{workout.notes}</Text>
          </View>
        ) : null}

        {/* Sets */}
        <Text style={s.setsHeader}>SETS ({workout.sets.length})</Text>
        {workout.sets.map((set) => {
          const hasRepDetails = set.rep_details && set.rep_details.length > 0;
          let repOffset = 0;

          return (
            <View key={set.id} style={s.setCard}>
              {(set.groups || []).map((group, gi) => (
                <View key={group.id} style={gi > 0 ? s.groupDivider : undefined}>
                  {(group.rounds || 1) > 1 && (
                    <Text style={s.roundsBadge}>{group.rounds}× through</Text>
                  )}
                  <View style={(group.rounds || 1) > 1 ? s.bracketWrap : undefined}>
                    {(group.rounds || 1) > 1 && <View style={s.bracketBar} />}
                    <View style={{ flex: 1 }}>
              {group.lines.map((line, li) => {
                const rounds = group.rounds || 1;
                const lineStart = repOffset;
                repOffset += line.reps * rounds;
                return (
                  <View key={line.id} style={li > 0 ? s.lineDivider : undefined}>
                    <View style={s.setRow}>
                      <Text style={s.setText}>
                        {line.reps > 1 ? `${line.reps} x ` : ""}{line.distance}
                        <Text style={s.setStroke}> {line.stroke}</Text>
                      </Text>
                      <View style={s.lineRight}>
                        {(() => {
                          const poolLen = workout.pool_length || 25;
                          const dotCount = Math.max(1, Math.floor(line.distance / poolLen));
                          const segs = hasRepDetails ? set.rep_details[lineStart]?.segments : null;
                          return (
                            <View style={s.effortDots}>
                              {Array.from({ length: dotCount }, (_, di) => {
                                const seg = segs?.[di];
                                const color = seg ? (EFFORT_COLORS[seg.effort] || colors.muted) : colors.muted;
                                return <View key={di} style={[s.effortDot, { backgroundColor: color }]} />;
                              })}
                            </View>
                          );
                        })()}
                        {line.interval_seconds != null && (
                          <Text style={s.setInterval}>@ {fmtTime(line.interval_seconds)}</Text>
                        )}
                      </View>
                    </View>

                    {hasRepDetails && line.reps > 1 &&
                      set.rep_details.slice(lineStart, lineStart + line.reps).map((rep, localRi) => {
                        if (!rep) return null;
                        const hasCustomInterval =
                          rep.interval != null && rep.interval !== line.interval_seconds;
                        // Segments are interesting only if they have mixed efforts or strokes different from the line
                        const hasSegments =
                          rep.segments &&
                          rep.segments.length > 1 &&
                          !(rep.segments.every((seg) => seg.stroke === line.stroke) &&
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

              {set.description ? <Text style={s.setDesc}>{set.description}</Text> : null}
            </View>
          );
        })}

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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  yards: { fontSize: 40, fontWeight: "800", color: colors.white },
  editBtn: { flexDirection: "row", alignItems: "center", padding: 8 },
  editBtnText: { color: colors.swim[500], fontSize: 14, fontWeight: "600", marginLeft: 6 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: "row", marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.2 },
  statValue: { fontSize: 26, fontWeight: "800", color: colors.white, marginTop: 4 },
  statUnit: { fontSize: 11, color: colors.muted },
  statUnitSm: { fontSize: 10, color: colors.muted, marginTop: 2 },
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
  zoneTitle: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  zoneCard: {
    backgroundColor: colors.surfaceLight, borderRadius: 12, padding: 12, marginBottom: 6,
  },
  zoneCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  zoneNum: { fontSize: 11, fontWeight: "800", color: colors.white, marginRight: 8 },
  zoneBpm: { fontSize: 11, color: colors.muted, flex: 1 },
  zonePctText: { fontSize: 12, fontWeight: "700", marginRight: 10 },
  zoneDur: { fontSize: 14, fontWeight: "700", color: colors.white },
  zoneBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  zoneBarFill: { height: 6, borderRadius: 3 },
  navRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 24, marginBottom: 8,
  },
  navBtn: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 13, fontWeight: "600", color: colors.swim[400], marginHorizontal: 6 },
  navBtnTextDisabled: { color: colors.muted },
  navCount: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: colors.border, marginTop: 24,
  },
  deleteBtnText: { color: colors.accent.red, fontSize: 15, fontWeight: "600", marginLeft: 8 },
});
