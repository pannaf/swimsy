import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState, useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { getWorkouts, StoredWorkout } from "../../lib/storage";
import { Benchmark } from "../../lib/types";
import { colors } from "../../lib/theme";
import { isConnected as isWhoopConnected, getSwimWorkoutsInRange, WhoopSwimSummary } from "../../lib/whoop";

export default function Dashboard() {
  const dashboardRef = useRef<ViewShot>(null);
  const [recent, setRecent] = useState<StoredWorkout[]>([]);
  const [weekYards, setWeekYards] = useState(0);
  const [weekSwims, setWeekSwims] = useState(0);
  const [monthYards, setMonthYards] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [swimDays, setSwimDays] = useState<Set<number>>(new Set());
  const [benchmarkGroups, setBenchmarkGroups] = useState<Record<string, { date: string; bm: Benchmark }[]>>({});

  const [allWorkouts, setAllWorkouts] = useState<StoredWorkout[]>([]);

  interface QuarterStats {
    label: string;
    swims: number;
    days: number;
    avgStrain: number;
    avgDurationMin: number;
    swimsPerWeek: number;
    dayOfWeekCounts: number[];       // index 0=Sun, 6=Sat
    dayOfWeekAvgStrain: number[];    // avg strain per day of week
  }
  const [currentQ, setCurrentQ] = useState<QuarterStats | null>(null);
  const [prevQ, setPrevQ] = useState<QuarterStats | null>(null);
  const [lastYearQ, setLastYearQ] = useState<QuarterStats | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(false);
  const [weeklyStrain, setWeeklyStrain] = useState<{
    thisWeekAvg: number | null;
    thisWeekTotal: number;
    thisWeekSwims: number;
    lastWeekAvg: number | null;
    lastWeekTotal: number;
    lastWeekSwims: number;
  } | null>(null);

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

        // Fetch Whoop quarterly data
        const whoopConnected = await isWhoopConnected();
        if (whoopConnected) {
          setWhoopLoading(true);

          const now = new Date();

          // Weekly strain from Whoop
          const wkSunday = new Date(now);
          wkSunday.setDate(now.getDate() - now.getDay());
          wkSunday.setHours(0, 0, 0, 0);
          const lastWkSunday = new Date(wkSunday.getTime() - 7 * 86400000);
          const lastWkSameDay = new Date(lastWkSunday.getTime() + now.getDay() * 86400000);
          lastWkSameDay.setHours(23, 59, 59, 999);

          try {
            console.log(`[Whoop Weekly] this wk: ${wkSunday.toISOString()} to ${now.toISOString()}`);
            console.log(`[Whoop Weekly] last wk: ${lastWkSunday.toISOString()} to ${lastWkSameDay.toISOString()}`);
            const [thisWkSwims, lastWkSwims] = await Promise.all([
              getSwimWorkoutsInRange(wkSunday, now),
              getSwimWorkoutsInRange(lastWkSunday, lastWkSameDay),
            ]);
            console.log(`[Whoop Weekly] this wk: ${thisWkSwims.length} swims, strains: ${thisWkSwims.map(s => s.strain)}`);
            console.log(`[Whoop Weekly] last wk: ${lastWkSwims.length} swims, strains: ${lastWkSwims.map(s => s.strain)}`);
            const twTotal = thisWkSwims.reduce((s, w) => s + w.strain, 0);
            const lwTotal = lastWkSwims.reduce((s, w) => s + w.strain, 0);
            setWeeklyStrain({
              thisWeekAvg: thisWkSwims.length > 0 ? Math.round(twTotal / thisWkSwims.length * 10) / 10 : null,
              thisWeekTotal: Math.round(twTotal * 10) / 10,
              thisWeekSwims: thisWkSwims.length,
              lastWeekAvg: lastWkSwims.length > 0 ? Math.round(lwTotal / lastWkSwims.length * 10) / 10 : null,
              lastWeekTotal: Math.round(lwTotal * 10) / 10,
              lastWeekSwims: lastWkSwims.length,
            });
          } catch (e) {
            console.log("Whoop weekly strain fetch error:", e);
          }

          const year = now.getFullYear();
          const quarter = Math.floor(now.getMonth() / 3); // 0-3

          function quarterRange(y: number, q: number): [Date, Date] {
            const start = new Date(y, q * 3, 1);
            const end = new Date(y, q * 3 + 3, 1);
            return [start, end];
          }

          /**
           * Build stats from swims, but only count swims within the first
           * `capDays` days from rangeStart (so comparisons are apples-to-apples).
           */
          function buildStats(
            label: string,
            allSwims: WhoopSwimSummary[],
            rangeStart: Date,
            capDays: number
          ): QuarterStats {
            const capEnd = new Date(rangeStart);
            capEnd.setDate(capEnd.getDate() + capDays);
            const swims = allSwims.filter((sw) => {
              const d = new Date(sw.date + "T12:00:00");
              return d >= rangeStart && d < capEnd;
            });
            const weeks = capDays / 7;
            const totalStrain = swims.reduce((s, w) => s + w.strain, 0);
            const totalDur = swims.reduce((s, w) => s + w.durationMinutes, 0);
            const dayCounts = [0, 0, 0, 0, 0, 0, 0];
            const dayStrainTotals = [0, 0, 0, 0, 0, 0, 0];
            for (const sw of swims) {
              if (sw.date) {
                const dow = new Date(sw.date + "T12:00:00").getDay();
                dayCounts[dow]++;
                dayStrainTotals[dow] += sw.strain;
              }
            }
            const dayAvgStrain = dayCounts.map((c, i) =>
              c > 0 ? Math.round(dayStrainTotals[i] / c * 10) / 10 : 0
            );
            return {
              label,
              swims: swims.length,
              days: capDays,
              avgStrain: swims.length > 0 ? Math.round(totalStrain / swims.length * 10) / 10 : 0,
              avgDurationMin: swims.length > 0 ? Math.round(totalDur / swims.length) : 0,
              swimsPerWeek: weeks > 0 ? Math.round(swims.length / weeks * 10) / 10 : 0,
              dayOfWeekCounts: dayCounts,
              dayOfWeekAvgStrain: dayAvgStrain,
            };
          }

          const qLabels = ["Q1", "Q2", "Q3", "Q4"];

          try {
            // Current quarter — elapsed days so far
            const [cStart, cEnd] = quarterRange(year, quarter);
            const elapsedDays = Math.ceil((now.getTime() - cStart.getTime()) / 86400000);
            console.log(`[Whoop Q] Current: ${qLabels[quarter]} ${year}, ${elapsedDays} days elapsed`);

            const cSwims = await getSwimWorkoutsInRange(cStart, now);
            console.log(`[Whoop Q] ${qLabels[quarter]} ${year}: ${cSwims.length} swims fetched`);
            setCurrentQ(buildStats(`${qLabels[quarter]} ${year}`, cSwims, cStart, elapsedDays));

            // Previous quarter — cap to same elapsed days for fair comparison
            const pq = quarter === 0 ? 3 : quarter - 1;
            const py = quarter === 0 ? year - 1 : year;
            const [pStart, pEnd] = quarterRange(py, pq);
            const pSwims = await getSwimWorkoutsInRange(pStart, pEnd);
            console.log(`[Whoop Q] ${qLabels[pq]} ${py}: ${pSwims.length} swims fetched, capping to first ${elapsedDays} days`);
            setPrevQ(buildStats(`${qLabels[pq]} ${py}`, pSwims, pStart, elapsedDays));

            // Same quarter last year — cap to same elapsed days
            const [lyStart, lyEnd] = quarterRange(year - 1, quarter);
            const lySwims = await getSwimWorkoutsInRange(lyStart, lyEnd);
            console.log(`[Whoop Q] ${qLabels[quarter]} ${year - 1}: ${lySwims.length} swims fetched, capping to first ${elapsedDays} days`);
            setLastYearQ(buildStats(`${qLabels[quarter]} ${year - 1}`, lySwims, lyStart, elapsedDays));
          } catch (e) {
            console.log("Whoop quarterly fetch error:", e);
          }
          setWhoopLoading(false);
        }
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

  async function shareDashboard() {
    try {
      const uri = await dashboardRef.current?.capture?.();
      if (!uri) return;
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
    } catch (e) {
      console.log("Share error:", e);
    }
  }

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
          <View style={s.headerRow}>
            <View>
              <Text style={s.subtitle}>DASHBOARD</Text>
              <Text style={s.title}>Mako</Text>
            </View>
            <Pressable onPress={shareDashboard} style={s.shareBtn} hitSlop={12}>
              <FontAwesome name="share-square-o" size={18} color={colors.swim[400]} />
            </Pressable>
          </View>

          <ViewShot ref={dashboardRef} options={{ format: "png", quality: 1, result: "tmpfile" }} style={s.viewShot}>{/* Week dots */}
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

          {/* Weekly Insights */}
          {(() => {
            const today = new Date();
            const todayDay = today.getDay(); // 0=Sun

            // Current week: Sun–today
            const thisWeekStart = new Date(today);
            thisWeekStart.setDate(today.getDate() - todayDay);
            thisWeekStart.setHours(0, 0, 0, 0);
            const thisWeekEnd = new Date(today);
            thisWeekEnd.setHours(23, 59, 59, 999);

            // Last week same window: last Sun through last (same day)
            const lastWeekStart = new Date(thisWeekStart);
            lastWeekStart.setDate(lastWeekStart.getDate() - 7);
            const lastWeekSameDay = new Date(lastWeekStart);
            lastWeekSameDay.setDate(lastWeekStart.getDate() + todayDay);
            lastWeekSameDay.setHours(23, 59, 59, 999);

            // Last week full
            const lastWeekEnd = new Date(thisWeekStart);
            lastWeekEnd.setMilliseconds(-1);

            const thisWeekWorkouts = allWorkouts.filter((w) => {
              const d = new Date(w.date);
              return d >= thisWeekStart && d <= thisWeekEnd;
            });
            const lastWeekSameDayWorkouts = allWorkouts.filter((w) => {
              const d = new Date(w.date);
              return d >= lastWeekStart && d <= lastWeekSameDay;
            });
            const lastWeekFullWorkouts = allWorkouts.filter((w) => {
              const d = new Date(w.date);
              return d >= lastWeekStart && d <= lastWeekEnd;
            });

            const thisWeekTotal = thisWeekWorkouts.reduce((s, w) => s + w.total_yards, 0);
            const lastWeekSameDayTotal = lastWeekSameDayWorkouts.reduce((s, w) => s + w.total_yards, 0);
            const lastWeekFullTotal = lastWeekFullWorkouts.reduce((s, w) => s + w.total_yards, 0);

            // Avg weekly yardage (last 8 weeks)
            const weeksBack = 8;
            let weekTotals: number[] = [];
            for (let w = 1; w <= weeksBack; w++) {
              const wStart = new Date(thisWeekStart);
              wStart.setDate(wStart.getDate() - w * 7);
              const wEnd = new Date(wStart);
              wEnd.setDate(wEnd.getDate() + 7);
              wEnd.setMilliseconds(-1);
              const wYards = allWorkouts
                .filter((wo) => { const d = new Date(wo.date); return d >= wStart && d < wEnd; })
                .reduce((s, wo) => s + wo.total_yards, 0);
              if (wYards > 0) weekTotals.push(wYards);
            }
            const avgWeekYards = weekTotals.length > 0
              ? Math.round(weekTotals.reduce((a, b) => a + b, 0) / weekTotals.length)
              : 0;

            // Projected: if we maintained this week's pace through the full week
            const daysElapsed = todayDay + 1; // Sun=1 day, Mon=2, etc.
            const projected = daysElapsed > 0 ? Math.round((thisWeekTotal / daysElapsed) * 7) : 0;

            // Avg feeling this week
            const feelings = thisWeekWorkouts.filter((w) => w.feeling_score != null).map((w) => w.feeling_score!);
            const avgFeeling = feelings.length > 0
              ? Math.round(feelings.reduce((a, b) => a + b, 0) / feelings.length * 10) / 10
              : null;

            // Diff vs last week
            const diff = lastWeekSameDayTotal > 0
              ? Math.round(((thisWeekTotal - lastWeekSameDayTotal) / lastWeekSameDayTotal) * 100)
              : null;

            // Avg duration this week
            const durations = thisWeekWorkouts.filter((w) => w.duration_minutes != null).map((w) => w.duration_minutes!);
            const avgDuration = durations.length > 0
              ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
              : null;

            if (allWorkouts.length === 0) return null;

            const dayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][todayDay];
            const fmtYards = (y: number) => y >= 1000 ? `${(y / 1000).toFixed(1)}k` : `${y}`;

            // Last week feelings through same day
            const lastFeelings = lastWeekSameDayWorkouts.filter((w) => w.feeling_score != null).map((w) => w.feeling_score!);
            const lastAvgFeeling = lastFeelings.length > 0
              ? Math.round(lastFeelings.reduce((a, b) => a + b, 0) / lastFeelings.length * 10) / 10
              : null;

            // Last week duration through same day
            const lastDurations = lastWeekSameDayWorkouts.filter((w) => w.duration_minutes != null).map((w) => w.duration_minutes!);
            const lastAvgDuration = lastDurations.length > 0
              ? Math.round(lastDurations.reduce((a, b) => a + b, 0) / lastDurations.length)
              : null;

            return (
              <View style={s.insightsCard}>
                <Text style={s.insightsTitle}>WEEKLY INSIGHTS</Text>

                {/* Column headers */}
                <View style={s.wkCompareHeader}>
                  <View style={s.wkCompareLabel} />
                  <Text style={s.wkCompareColHead}>last wk thru {dayLabel}</Text>
                  <Text style={[s.wkCompareColHead, { color: colors.swim[400] }]}>this week</Text>
                </View>

                {/* Yards */}
                <View style={s.wkCompareRow}>
                  <Text style={s.wkCompareRowLabel}>yards</Text>
                  <Text style={s.wkCompareValDim}>{fmtYards(lastWeekSameDayTotal)}</Text>
                  <Text style={s.wkCompareVal}>{fmtYards(thisWeekTotal)}</Text>
                </View>

                {/* Swims */}
                <View style={s.wkCompareRow}>
                  <Text style={s.wkCompareRowLabel}>swims</Text>
                  <Text style={s.wkCompareValDim}>{lastWeekSameDayWorkouts.length}</Text>
                  <Text style={s.wkCompareVal}>{thisWeekWorkouts.length}</Text>
                </View>

                {/* Avg duration */}
                {(avgDuration != null || lastAvgDuration != null) && (
                  <View style={s.wkCompareRow}>
                    <Text style={s.wkCompareRowLabel}>avg min</Text>
                    <Text style={s.wkCompareValDim}>{lastAvgDuration ?? "–"}</Text>
                    <Text style={s.wkCompareVal}>{avgDuration ?? "–"}</Text>
                  </View>
                )}

                {/* Feeling */}
                {(avgFeeling != null || lastAvgFeeling != null) && (
                  <View style={s.wkCompareRow}>
                    <Text style={s.wkCompareRowLabel}>feeling</Text>
                    <Text style={s.wkCompareValDim}>{lastAvgFeeling ?? "–"}</Text>
                    <Text style={[s.wkCompareVal, avgFeeling != null ? {
                      color: avgFeeling >= 7 ? colors.accent.green : avgFeeling >= 4 ? colors.accent.yellow : colors.accent.red,
                    } : {}]}>{avgFeeling ?? "–"}</Text>
                  </View>
                )}

                {/* Whoop strain */}
                {weeklyStrain && (weeklyStrain.thisWeekSwims > 0 || weeklyStrain.lastWeekSwims > 0) && (
                  <>
                    <View style={s.wkCompareRow}>
                      <Text style={s.wkCompareRowLabel}>avg strain</Text>
                      <Text style={s.wkCompareValDim}>{weeklyStrain.lastWeekAvg ?? "–"}</Text>
                      <Text style={[s.wkCompareVal, { color: "#f97316" }]}>{weeklyStrain.thisWeekAvg ?? "–"}</Text>
                    </View>
                    <View style={s.wkCompareRow}>
                      <Text style={s.wkCompareRowLabel}>total strain</Text>
                      <Text style={s.wkCompareValDim}>{weeklyStrain.lastWeekTotal || "–"}</Text>
                      <Text style={[s.wkCompareVal, { color: "#f97316" }]}>{weeklyStrain.thisWeekTotal || "–"}</Text>
                    </View>
                  </>
                )}

                {/* Projection row */}
                {(projected > 0 || avgWeekYards > 0) && (
                  <View style={s.wkProjectionRow}>
                    {projected > 0 && (
                      <View style={s.wkProjectionItem}>
                        <Text style={s.wkProjectionNum}>{fmtYards(projected)}</Text>
                        <Text style={s.wkProjectionLabel}>on pace for</Text>
                      </View>
                    )}
                    {avgWeekYards > 0 && (
                      <View style={s.wkProjectionItem}>
                        <Text style={[s.wkProjectionNum, {
                          color: projected >= avgWeekYards ? colors.accent.green : colors.accent.yellow,
                        }]}>{fmtYards(avgWeekYards)}</Text>
                        <Text style={s.wkProjectionLabel}>8-wk avg</Text>
                      </View>
                    )}
                    {diff != null && (
                      <View style={s.wkProjectionItem}>
                        <Text style={[s.wkProjectionNum, {
                          color: diff > 0 ? colors.accent.green : diff < 0 ? colors.accent.red : colors.white,
                        }]}>{diff > 0 ? "+" : ""}{diff}%</Text>
                        <Text style={s.wkProjectionLabel}>vs last wk</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Quarterly Insights (Whoop) */}
          {currentQ && (currentQ.swims > 0 || prevQ?.swims || lastYearQ?.swims) && (
            <View style={s.insightsCard}>
              <Text style={s.insightsTitle}>QUARTERLY — WHOOP</Text>

              {/* Column headers */}
              <View style={s.qHeaderRow}>
                <View style={s.qHeaderLabel} />
                <Text style={s.qColHeader}>{currentQ.label}</Text>
                {prevQ && <Text style={s.qColHeader}>{prevQ.label}</Text>}
                {lastYearQ && <Text style={s.qColHeader}>{lastYearQ.label}</Text>}
              </View>

              {/* Avg strain */}
              <View style={s.qRow}>
                <Text style={s.qRowLabel}>avg strain</Text>
                <Text style={s.qVal}>{currentQ.avgStrain}</Text>
                {prevQ && <Text style={s.qValDim}>{prevQ.avgStrain}</Text>}
                {lastYearQ && <Text style={s.qValDim}>{lastYearQ.avgStrain}</Text>}
              </View>

              {/* Swims per week */}
              <View style={s.qRow}>
                <Text style={s.qRowLabel}>swims / wk</Text>
                <Text style={s.qVal}>{currentQ.swimsPerWeek}</Text>
                {prevQ && <Text style={s.qValDim}>{prevQ.swimsPerWeek}</Text>}
                {lastYearQ && <Text style={s.qValDim}>{lastYearQ.swimsPerWeek}</Text>}
              </View>

              {/* Avg duration */}
              <View style={s.qRow}>
                <Text style={s.qRowLabel}>avg min</Text>
                <Text style={s.qVal}>{currentQ.avgDurationMin}</Text>
                {prevQ && <Text style={s.qValDim}>{prevQ.avgDurationMin}</Text>}
                {lastYearQ && <Text style={s.qValDim}>{lastYearQ.avgDurationMin}</Text>}
              </View>

              {/* Total swims */}
              <View style={s.qRow}>
                <Text style={s.qRowLabel}>total swims</Text>
                <Text style={s.qVal}>{currentQ.swims}</Text>
                {prevQ && <Text style={s.qValDim}>{prevQ.swims}</Text>}
                {lastYearQ && <Text style={s.qValDim}>{lastYearQ.swims}</Text>}
              </View>

              {/* Day-of-week frequency */}
              {currentQ.swims > 0 && (
                <View style={s.dayFreqSection}>
                  <Text style={[s.insightsTitle, { marginTop: 14, marginBottom: 12 }]}>SWIM DAYS</Text>
                  {(() => {
                    const maxCount = Math.max(
                      ...currentQ.dayOfWeekCounts,
                      ...(prevQ?.dayOfWeekCounts ?? [0]),
                      1
                    );
                    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                      const curr = currentQ.dayOfWeekCounts[i];
                      const prev = prevQ?.dayOfWeekCounts[i] ?? 0;
                      const currPct = (curr / maxCount) * 100;
                      const prevPct = (prev / maxCount) * 100;
                      const diff = curr - prev;
                      return (
                        <View key={day} style={s.dayFreqRow}>
                          <Text style={s.dayFreqLabel}>{day}</Text>
                          <View style={s.dayFreqBars}>
                            <View style={s.dayFreqBarTrack}>
                              <View style={[s.dayFreqBarCurr, { width: `${currPct}%` as any }]}>
                                {curr > 0 && <Text style={s.dayFreqBarNum}>{curr}</Text>}
                              </View>
                            </View>
                            {prevQ && (
                              <View style={s.dayFreqBarTrack}>
                                <View style={[s.dayFreqBarPrev, { width: `${prevPct}%` as any }]}>
                                  {prev > 0 && <Text style={s.dayFreqBarNumDim}>{prev}</Text>}
                                </View>
                              </View>
                            )}
                          </View>
                          {prevQ && (
                            <Text style={[s.dayFreqDiff, {
                              color: diff > 0 ? colors.accent.green : diff < 0 ? colors.accent.red : "rgba(255,255,255,0.2)",
                            }]}>{diff > 0 ? "+" : diff === 0 ? "" : ""}{diff === 0 ? "–" : diff}</Text>
                          )}
                        </View>
                      );
                    });
                  })()}
                  <View style={s.dayFreqLegend}>
                    <View style={[s.dayFreqLegendDot, { backgroundColor: colors.swim[500] }]} />
                    <Text style={s.dayFreqLegendText}>{currentQ.label}</Text>
                    {prevQ && (
                      <>
                        <View style={[s.dayFreqLegendDot, { backgroundColor: "rgba(255,255,255,0.2)", marginLeft: 12 }]} />
                        <Text style={s.dayFreqLegendText}>{prevQ.label}</Text>
                      </>
                    )}
                  </View>

                  {/* Per-day avg strain comparison */}
                  <Text style={[s.insightsTitle, { marginTop: 18, marginBottom: 10 }]}>AVG STRAIN BY DAY</Text>
                  <View style={s.strainDayHeader}>
                    <View style={{ width: 32 }} />
                    <View style={{ flex: 1 }} />
                    <Text style={s.strainDayColLabel}>{currentQ.label}</Text>
                    {prevQ && <Text style={s.strainDayColLabel}>{prevQ.label}</Text>}
                  </View>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                    const curr = currentQ.dayOfWeekAvgStrain[i];
                    const prev = prevQ?.dayOfWeekAvgStrain[i] ?? 0;
                    const maxStrain = Math.max(
                      ...currentQ.dayOfWeekAvgStrain,
                      ...(prevQ?.dayOfWeekAvgStrain ?? [0]),
                      1
                    );
                    const currPct = (curr / maxStrain) * 100;
                    const prevPct = (prev / maxStrain) * 100;
                    const diff = curr > 0 && prev > 0 ? Math.round((curr - prev) * 10) / 10 : null;
                    return (
                      <View key={day} style={s.strainDayRow}>
                        <Text style={s.dayFreqLabel}>{day}</Text>
                        <View style={s.strainDayBars}>
                          <View style={s.dayFreqBarTrack}>
                            <View style={[s.strainDayBarCurr, { width: `${currPct}%` as any }]} />
                          </View>
                          {prevQ && (
                            <View style={s.dayFreqBarTrack}>
                              <View style={[s.strainDayBarPrev, { width: `${prevPct}%` as any }]} />
                            </View>
                          )}
                        </View>
                        <Text style={s.strainDayVal}>{curr > 0 ? curr.toFixed(1) : "–"}</Text>
                        {prevQ && <Text style={s.strainDayValDim}>{prev > 0 ? prev.toFixed(1) : "–"}</Text>}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

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

          </ViewShot>

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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  shareBtn: { paddingTop: 8 },
  viewShot: { backgroundColor: colors.bg },
  subtitle: { fontSize: 11, color: colors.muted, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: "800", color: colors.white },
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
  insightsCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  insightsTitle: {
    fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.4)",
    letterSpacing: 2, marginBottom: 14,
  },
  insightsRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 12,
  },
  insightsCol: { flex: 1, alignItems: "center" },
  insightsDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.08)" },
  insightsNum: { fontSize: 20, fontWeight: "800", color: colors.white },
  insightsNumDim: { fontSize: 18, fontWeight: "700", color: "rgba(255,255,255,0.35)" },
  insightsLabel: {
    fontSize: 9, fontWeight: "600", color: colors.muted,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2, textAlign: "center",
  },
  wkCompareHeader: {
    flexDirection: "row", alignItems: "center", marginBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingBottom: 6,
  },
  wkCompareLabel: { flex: 1.2 },
  wkCompareColHead: {
    flex: 1, fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.35)",
    textAlign: "right", letterSpacing: 0.3,
  },
  wkCompareRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 5,
  },
  wkCompareRowLabel: {
    flex: 1.2, fontSize: 12, fontWeight: "600", color: colors.muted,
  },
  wkCompareValDim: {
    flex: 1, fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.35)", textAlign: "right",
  },
  wkCompareVal: {
    flex: 1, fontSize: 18, fontWeight: "800", color: colors.white, textAlign: "right",
  },
  wkProjectionRow: {
    flexDirection: "row", justifyContent: "center", gap: 24,
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
  },
  wkProjectionItem: { alignItems: "center" },
  wkProjectionNum: { fontSize: 16, fontWeight: "800", color: colors.white },
  wkProjectionLabel: {
    fontSize: 9, fontWeight: "600", color: colors.muted,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2,
  },
  qHeaderRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingBottom: 8,
  },
  qHeaderLabel: { flex: 1.2 },
  qColHeader: {
    flex: 1, fontSize: 10, fontWeight: "700", color: colors.swim[400],
    textAlign: "center", letterSpacing: 0.5,
  },
  qRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 6,
  },
  qRowLabel: {
    flex: 1.2, fontSize: 11, fontWeight: "600", color: colors.muted,
  },
  dayFreqSection: { marginTop: 4 },
  dayFreqRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dayFreqLabel: { width: 32, fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.5)" },
  dayFreqBars: { flex: 1, marginHorizontal: 8, gap: 3 },
  dayFreqBarTrack: {
    height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.04)",
  },
  dayFreqBarCurr: {
    height: 14, borderRadius: 7, backgroundColor: colors.swim[500],
    justifyContent: "center",
  },
  dayFreqBarPrev: {
    height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
  },
  dayFreqBarNum: { fontSize: 9, fontWeight: "700", color: colors.white, textAlign: "center", paddingHorizontal: 6 },
  dayFreqBarNumDim: { fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.5)", textAlign: "center", paddingHorizontal: 6 },
  dayFreqDiff: { width: 24, fontSize: 11, fontWeight: "700", textAlign: "right" },
  strainDayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  strainDayColLabel: { width: 36, fontSize: 9, fontWeight: "700", color: colors.swim[400], textAlign: "right", letterSpacing: 0.5 },
  strainDayRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  strainDayBars: { flex: 1, marginHorizontal: 8, gap: 3 },
  strainDayBarCurr: { height: 8, borderRadius: 4, backgroundColor: "#f97316" },
  strainDayBarPrev: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)" },
  strainDayVal: { width: 36, fontSize: 12, fontWeight: "700", color: colors.white, textAlign: "right" },
  strainDayValDim: { width: 36, fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.35)", textAlign: "right" },
  dayFreqLegend: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12 },
  dayFreqLegendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  dayFreqLegendText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  qVal: {
    flex: 1, fontSize: 16, fontWeight: "800", color: colors.white, textAlign: "center",
  },
  qValDim: {
    flex: 1, fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.4)", textAlign: "center",
  },
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
