import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Polyline, Rect, Line, Text as SvgText } from "react-native-svg";
import { colors } from "../lib/theme";

const ZONE_COLORS = [
  "#6b7280", // 0
  "#9ca3af", // 1
  "#3b82f6", // 2
  colors.accent.green, // 3
  "#f97316", // 4
  colors.accent.red, // 5
];

// Karvonen zone boundaries using heart rate reserve
function getZoneBoundaries(maxHR: number, restHR: number): number[] {
  const hrr = maxHR - restHR;
  return [
    Math.round(hrr * 0.50 + restHR), // zone 0/1 boundary
    Math.round(hrr * 0.60 + restHR), // zone 1/2
    Math.round(hrr * 0.70 + restHR), // zone 2/3
    Math.round(hrr * 0.80 + restHR), // zone 3/4
    Math.round(hrr * 0.90 + restHR), // zone 4/5
  ];
}

function getZone(bpm: number, bounds: number[]): number {
  if (bpm >= bounds[4]) return 5;
  if (bpm >= bounds[3]) return 4;
  if (bpm >= bounds[2]) return 3;
  if (bpm >= bounds[1]) return 2;
  if (bpm >= bounds[0]) return 1;
  return 0;
}

function fmtDur(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function fmtMin(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}m`;
}

interface Props {
  samples: { t: number; bpm: number }[];
  maxHR?: number;
  restingHR?: number;
  age?: number;
}

export default function HeartRateChart({ samples, maxHR: maxHRProp, restingHR: restHRProp, age }: Props) {
  if (!samples || samples.length < 2) return null;

  const width = Dimensions.get("window").width - 40;
  const chartHeight = 120;
  const padding = { top: 16, bottom: 24, left: 0, right: 0 };
  const plotW = width - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const observedMax = Math.max(...samples.map((s) => s.bpm));
  const estimatedMax = age ? 220 - age : 182; // default to age 38
  const maxHR = maxHRProp || Math.max(observedMax, estimatedMax);
  const restHR = restHRProp || 48; // sensible default
  const zoneBounds = getZoneBoundaries(maxHR, restHR);
  const minHR = Math.min(...samples.map((s) => s.bpm));
  const maxT = samples[samples.length - 1].t;
  const minT = samples[0].t;
  const tRange = maxT - minT || 1;
  const hrRange = maxHR - minHR || 1;
  const hrPad = hrRange * 0.1;

  // Build polyline points and zone-colored vertical bars
  const toX = (t: number) => padding.left + ((t - minT) / tRange) * plotW;
  const toY = (bpm: number) => padding.top + (1 - (bpm - (minHR - hrPad)) / (hrRange + hrPad * 2)) * plotH;

  const points = samples.map((s) => `${toX(s.t)},${toY(s.bpm)}`).join(" ");

  // Zone-colored bars (thin vertical rects for each sample interval)
  const bars: { x: number; w: number; color: string }[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const x = toX(samples[i].t);
    const nextX = toX(samples[i + 1].t);
    const w = nextX - x;
    if (w > 0 && w < plotW * 0.1) { // skip gaps
      const zone = getZone(samples[i].bpm, zoneBounds);
      bars.push({ x, w, color: ZONE_COLORS[zone] });
    }
  }

  // Time axis labels
  const timeLabels: { t: number; label: string }[] = [];
  const interval = tRange > 3600 ? 900 : tRange > 1800 ? 600 : 300; // 15m, 10m, or 5m
  for (let t = Math.ceil(minT / interval) * interval; t <= maxT; t += interval) {
    timeLabels.push({ t, label: fmtMin(t) });
  }

  // Compute zone durations from samples
  const zoneMilli: number[] = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < samples.length - 1; i++) {
    const dur = (samples[i + 1].t - samples[i].t) * 1000;
    if (dur > 0 && dur < 60000) {
      const zone = getZone(samples[i].bpm, zoneBounds);
      zoneMilli[zone] += dur;
    }
  }
  const totalMilli = zoneMilli.reduce((a, b) => a + b, 0);

  const zoneData = [
    { label: "5", bpm: `${zoneBounds[4]}+`, color: ZONE_COLORS[5] },
    { label: "4", bpm: `${zoneBounds[3]}-${zoneBounds[4]}`, color: ZONE_COLORS[4] },
    { label: "3", bpm: `${zoneBounds[2]}-${zoneBounds[3]}`, color: ZONE_COLORS[3] },
    { label: "2", bpm: `${zoneBounds[1]}-${zoneBounds[2]}`, color: ZONE_COLORS[2] },
    { label: "1", bpm: `${zoneBounds[0]}-${zoneBounds[1]}`, color: ZONE_COLORS[1] },
    { label: "0", bpm: `<${zoneBounds[0]}`, color: ZONE_COLORS[0] },
  ];

  return (
    <View style={s.container}>
      {/* Chart */}
      <View style={s.chartWrap}>
        <Text style={s.chartMax}>{maxHR}</Text>
        <Svg width={width} height={chartHeight}>
          {/* Zone-colored background bars */}
          {bars.map((bar, i) => (
            <Rect
              key={i}
              x={bar.x}
              y={padding.top}
              width={Math.max(bar.w, 1)}
              height={plotH}
              fill={bar.color}
              opacity={0.25}
            />
          ))}
          {/* HR line */}
          <Polyline
            points={points}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Time axis */}
          {timeLabels.map((tl) => (
            <SvgText
              key={tl.t}
              x={toX(tl.t)}
              y={chartHeight - 4}
              fontSize={10}
              fill="rgba(255,255,255,0.3)"
              textAnchor="middle"
            >
              {tl.label}
            </SvgText>
          ))}
        </Svg>
        <Text style={s.chartMin}>{minHR}</Text>
      </View>

      {/* Zone breakdown */}
      <View style={s.zones}>
        {zoneData.map((z, i) => {
          const idx = 5 - i;
          const ms = zoneMilli[idx];
          const pct = totalMilli > 0 ? Math.round((ms / totalMilli) * 100) : 0;
          return (
            <View key={z.label} style={s.zoneRow}>
              <Text style={[s.zoneLabel, { color: z.color }]}>{z.label}</Text>
              <View style={s.zoneBarOuter}>
                <View style={s.zoneBarTrack}>
                  <View style={[s.zoneBarFill, { width: `${pct}%`, backgroundColor: z.color }]} />
                </View>
              </View>
              <Text style={s.zonePct}>{pct}%</Text>
              <Text style={s.zoneDur}>{fmtDur(ms)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 16 },
  chartWrap: { marginBottom: 16 },
  chartMax: {
    position: "absolute", top: 8, right: 0,
    fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.4)",
  },
  chartMin: {
    position: "absolute", bottom: 20, right: 0,
    fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.4)",
  },
  zones: { marginTop: 4 },
  zoneRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 6,
  },
  zoneLabel: { fontSize: 13, fontWeight: "800", width: 18 },
  zoneBarOuter: { flex: 1, marginHorizontal: 8 },
  zoneBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  zoneBarFill: { height: 6, borderRadius: 3 },
  zonePct: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.5)", width: 36, textAlign: "right" },
  zoneDur: { fontSize: 13, fontWeight: "600", color: colors.white, width: 44, textAlign: "right" },
});
