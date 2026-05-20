import { HealthLap, WorkoutEvent } from "./healthkit";
import { SwimSet, WorkLine } from "./types";

export interface LapWithRest {
  swimTime: number;      // seconds of actual swimming
  restAfter: number;     // seconds of rest after this lap
  distanceYards: number;
  strokeStyle: string;
  strokeCount?: number;
  swolf?: number;
}

export interface RepPace {
  repIndex: number;       // 0-based within the set line
  swimTimeSeconds: number;
  pacePer100: number;     // seconds per 100 yards
  laps: LapWithRest[];
  strokeCount?: number;   // total strokes for this rep
  avgSwolf?: number;
}

export interface SetCorrelation {
  setIndex: number;
  startLap: number;   // first lap index consumed (0-based into processedLaps)
  endLap: number;     // last lap index consumed (exclusive)
  lines: LineCorrelation[];
}

export interface LineCorrelation {
  lineId: string;
  reps: RepPace[];
}

const REST_GAP_THRESHOLD = 3; // seconds gap between laps to count as rest

/**
 * Separate actual swim time from rest on each lap.
 *
 * The Apple Watch often extends the last lap's endTime to include the rest
 * period before the next set starts. We detect this by:
 * 1. Looking at gaps between consecutive laps (gap = next.startTime - this.endTime)
 * 2. Using segment events to find rest boundaries
 * 3. For the last lap before a rest gap: the actual swim time is estimated
 *    from the lap's own duration minus any overlap with the gap, or by using
 *    the median pace of nearby laps of the same distance as a sanity check.
 */
export function separateSwimAndRest(
  laps: HealthLap[],
  events: WorkoutEvent[] | null
): LapWithRest[] {
  if (laps.length === 0) return [];

  // Build a set of segment boundary times from workout events
  const segmentEnds = new Set<number>();
  const segmentStarts = new Set<number>();
  if (events) {
    for (const e of events) {
      if (e.type === "segment") {
        segmentStarts.add(Math.round(e.startTime));
        segmentEnds.add(Math.round(e.endTime));
      }
    }
  }

  const result: LapWithRest[] = [];

  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i];
    const nextLap = i < laps.length - 1 ? laps[i + 1] : null;

    // Gap between this lap's end and next lap's start
    const gapToNext = nextLap ? nextLap.startTime - lap.endTime : 0;

    // Check if there's a segment boundary between this lap and the next
    const isLastInSegment = !nextLap || isSegmentBoundaryBetween(
      lap.endTime,
      nextLap.startTime,
      segmentEnds,
      segmentStarts
    );

    let swimTime: number;
    let restAfter: number;

    if (!nextLap) {
      // Last lap of workout — use raw duration, no rest
      swimTime = lap.duration;
      restAfter = 0;
    } else if (gapToNext >= REST_GAP_THRESHOLD) {
      // There's a clear gap between this lap and the next.
      // The watch may have inflated this lap's duration to include rest.
      // Actual swim = from this lap's start to when swimming stopped.
      //
      // Heuristic: if lap.duration > gap means the duration extends into
      // the gap. The real swim ended at (lap.endTime - gapToNext) approximately,
      // but more accurately: the swim ended, then rest started.
      // The gap is between lap.endTime and nextLap.startTime.
      // But lap.endTime already = start + duration, so the "rest" is embedded
      // in the duration if lap.endTime > where swimming actually stopped.
      //
      // Best approach: look at typical swim pace for this distance from
      // surrounding laps that DON'T have rest after them.
      const typicalSwimTime = getTypicalLapTime(laps, i, lap.distanceYards);

      if (typicalSwimTime > 0 && lap.duration > typicalSwimTime * 1.5) {
        // Duration is suspiciously long — rest is baked into it
        swimTime = typicalSwimTime;
        restAfter = lap.duration - typicalSwimTime + gapToNext;
      } else {
        // Duration seems reasonable — rest is in the gap
        swimTime = lap.duration;
        restAfter = gapToNext;
      }
    } else if (isLastInSegment && gapToNext < REST_GAP_THRESHOLD) {
      // Segment boundary but no gap — rest is baked into duration
      const typicalSwimTime = getTypicalLapTime(laps, i, lap.distanceYards);
      if (typicalSwimTime > 0 && lap.duration > typicalSwimTime * 1.5) {
        swimTime = typicalSwimTime;
        restAfter = lap.duration - typicalSwimTime;
      } else {
        swimTime = lap.duration;
        restAfter = 0;
      }
    } else {
      // Normal lap in the middle of a set
      swimTime = lap.duration;
      restAfter = Math.max(0, gapToNext);
    }

    result.push({
      swimTime: Math.round(swimTime * 10) / 10,
      restAfter: Math.round(restAfter * 10) / 10,
      distanceYards: lap.distanceYards,
      strokeStyle: lap.strokeStyle,
      strokeCount: lap.strokeCount,
      swolf: lap.swolf,
    });
  }

  return result;
}

function isSegmentBoundaryBetween(
  lapEnd: number,
  nextLapStart: number,
  segmentEnds: Set<number>,
  segmentStarts: Set<number>
): boolean {
  // Check if any segment end falls near lapEnd or any segment start falls near nextLapStart
  for (const se of segmentEnds) {
    if (Math.abs(se - lapEnd) < 2) return true;
  }
  for (const ss of segmentStarts) {
    if (ss > lapEnd && ss <= nextLapStart + 1) return true;
  }
  return false;
}

/**
 * Get a typical swim time for a lap of the given distance by looking at
 * nearby laps that don't have rest after them (middle-of-set laps).
 */
function getTypicalLapTime(
  laps: HealthLap[],
  currentIndex: number,
  distance: number
): number {
  const candidates: number[] = [];
  const range = Math.min(20, laps.length);
  const start = Math.max(0, currentIndex - range);
  const end = Math.min(laps.length - 1, currentIndex + range);

  for (let i = start; i <= end; i++) {
    if (i === currentIndex) continue;
    const lap = laps[i];
    if (Math.abs(lap.distanceYards - distance) > 1) continue;

    // Only use laps that look like "normal" pace (not inflated)
    const nextLap = i < laps.length - 1 ? laps[i + 1] : null;
    const gap = nextLap ? nextLap.startTime - lap.endTime : 999;

    // If gap is small (<3s), this lap probably doesn't include rest
    if (gap < REST_GAP_THRESHOLD) {
      candidates.push(lap.duration);
    }
  }

  if (candidates.length === 0) return 0;

  // Return median
  candidates.sort((a, b) => a - b);
  const mid = Math.floor(candidates.length / 2);
  return candidates.length % 2 === 0
    ? (candidates[mid - 1] + candidates[mid]) / 2
    : candidates[mid];
}

/**
 * Count the number of laps a set would consume based on its work lines.
 */
export function lapsNeededForSet(set: SwimSet, lapDistance: number): number {
  let total = 0;
  for (const group of set.groups || []) {
    const rounds = group.rounds || 1;
    for (const line of group.lines) {
      if (line.kind === "rest") continue;
      const wl = line as WorkLine;
      const lapsPerRep = Math.round(wl.distance / lapDistance);
      total += lapsPerRep * wl.reps * rounds;
    }
  }
  return total;
}

/**
 * Correlate Apple Watch laps with user-logged swim sets.
 *
 * Each set can have a manual startLap override via setLapStarts.
 * If not overridden, a set starts where the previous set left off.
 */
export function correlateLapsToSets(
  laps: HealthLap[],
  events: WorkoutEvent[] | null,
  sets: SwimSet[],
  poolLength: number,
  setLapStarts?: Record<string, number>
): SetCorrelation[] {
  const processedLaps = separateSwimAndRest(laps, events);
  if (processedLaps.length === 0) return [];

  const lapDistanceYards = processedLaps[0]?.distanceYards || poolLength;
  let autoLapIndex = 0;
  const correlations: SetCorrelation[] = [];

  for (let si = 0; si < sets.length; si++) {
    const set = sets[si];

    // Per-set start override or auto-continue from previous set
    const override = setLapStarts?.[set.id];
    let lapIndex = override != null ? override : autoLapIndex;
    const setStartLap = lapIndex;

    const lineCorrelations: LineCorrelation[] = [];

    for (const group of set.groups || []) {
      const rounds = group.rounds || 1;
      for (const line of group.lines) {
        if (line.kind === "rest") continue;
        const wl = line as WorkLine;
        const reps: RepPace[] = [];
        const totalReps = wl.reps * rounds;

        for (let r = 0; r < totalReps; r++) {
          const lapsPerRep = Math.round(wl.distance / lapDistanceYards);
          if (lapsPerRep <= 0) continue;

          const repLaps: LapWithRest[] = [];
          let repSwimTime = 0;
          let repStrokes = 0;
          let swolfSum = 0;
          let swolfCount = 0;

          for (let l = 0; l < lapsPerRep && lapIndex < processedLaps.length; l++) {
            const lap = processedLaps[lapIndex];
            repLaps.push(lap);
            repSwimTime += lap.swimTime;
            if (lap.strokeCount != null) repStrokes += lap.strokeCount;
            if (lap.swolf != null) { swolfSum += lap.swolf; swolfCount++; }
            lapIndex++;
          }

          if (repLaps.length > 0) {
            const pacePer100 = wl.distance > 0
              ? (repSwimTime / wl.distance) * 100
              : 0;

            reps.push({
              repIndex: r,
              swimTimeSeconds: Math.round(repSwimTime * 10) / 10,
              pacePer100: Math.round(pacePer100 * 10) / 10,
              laps: repLaps,
              strokeCount: repStrokes > 0 ? repStrokes : undefined,
              avgSwolf: swolfCount > 0 ? Math.round(swolfSum / swolfCount) : undefined,
            });
          }
        }

        if (reps.length > 0) {
          lineCorrelations.push({ lineId: wl.id, reps });
        }
      }
    }

    correlations.push({
      setIndex: si,
      startLap: setStartLap,
      endLap: lapIndex,
      lines: lineCorrelations,
    });

    // Next auto set starts where this one ended
    autoLapIndex = lapIndex;
  }

  return correlations;
}
