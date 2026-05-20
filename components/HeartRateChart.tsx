import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Path, Line, Text as SvgText, Defs, LinearGradient, Stop, ClipPath, Rect,
} from "react-native-svg";
import { colors } from "../lib/theme";

const ZONE_COLORS = [
  "#6b7280", // 0
  "#9ca3af", // 1
  "#3b82f6", // 2
  colors.accent.green, // 3
  "#f97316", // 4
  colors.accent.red, // 5
];

function getZoneBoundaries(maxHR: number, restHR: number): number[] {
  const hrr = maxHR - restHR;
  return [
    Math.round(hrr * 0.50 + restHR),
    Math.round(hrr * 0.60 + restHR),
    Math.round(hrr * 0.70 + restHR),
    Math.round(hrr * 0.80 + restHR),
    Math.round(hrr * 0.90 + restHR),
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
  return `${Math.floor(sec / 60)}m`;
}

export interface SetMarker {
  label: string;
  startTime: number;
  endTime: number;
}

interface Props {
  samples: { t: number; bpm: number }[];
  maxHR?: number;
  restingHR?: number;
  age?: number;
  setMarkers?: SetMarker[];
}

export default function HeartRateChart({ samples, maxHR: maxHRProp, restingHR: restHRProp, age, setMarkers }: Props) {
  if (!samples || samples.length < 2) return null;

  const width = Dimensions.get("window").width - 40;
  const chartHeight = 160;
  const hasMarkers = setMarkers && setMarkers.length > 0;
  const padding = { top: hasMarkers ? 26 : 20, bottom: 28, left: 32, right: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const observedMax = Math.max(...samples.map((s) => s.bpm));
  const observedMin = Math.min(...samples.map((s) => s.bpm));
  const estimatedMax = age ? 220 - age : 182;
  const maxHR = maxHRProp || Math.max(observedMax, estimatedMax);
  const restHR = restHRProp || 48;
  const zoneBounds = getZoneBoundaries(maxHR, restHR);

  // HR range with padding
  const hrTop = Math.max(observedMax + 5, zoneBounds[4] + 5);
  const hrBottom = Math.max(40, observedMin - 10);
  const hrRange = hrTop - hrBottom || 1;

  const maxT = samples[samples.length - 1].t;
  const minT = samples[0].t;
  const tRange = maxT - minT || 1;

  const toX = (t: number) => padding.left + ((t - minT) / tRange) * plotW;
  const toY = (bpm: number) => padding.top + (1 - (bpm - hrBottom) / hrRange) * plotH;

  // Downsample if too many points (keep it smooth but performant)
  const maxPoints = 200;
  let displaySamples = samples;
  if (samples.length > maxPoints) {
    const step = Math.ceil(samples.length / maxPoints);
    displaySamples = samples.filter((_, i) => i % step === 0 || i === samples.length - 1);
  }

  // Build smooth path using cardinal spline approximation
  const pts = displaySamples.map((s) => ({ x: toX(s.t), y: toY(s.bpm) }));
  let linePath = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }

  // Filled area path (close down to bottom)
  const areaPath = linePath +
    ` L${pts[pts.length - 1].x},${padding.top + plotH}` +
    ` L${pts[0].x},${padding.top + plotH} Z`;

  // Zone boundary lines (horizontal)
  const zoneLines = zoneBounds
    .filter((b) => b > hrBottom && b < hrTop)
    .map((b) => ({ y: toY(b), bpm: b, zone: getZone(b, zoneBounds) }));

  // Time axis labels
  const timeLabels: { t: number; label: string }[] = [];
  const interval = tRange > 3600 ? 900 : tRange > 1800 ? 600 : 300;
  for (let t = Math.ceil(minT / interval) * interval; t <= maxT; t += interval) {
    timeLabels.push({ t, label: fmtMin(t) });
  }

  // HR axis labels
  const hrLabels: number[] = [];
  const hrStep = hrRange > 80 ? 20 : hrRange > 40 ? 10 : 5;
  for (let hr = Math.ceil(hrBottom / hrStep) * hrStep; hr <= hrTop; hr += hrStep) {
    hrLabels.push(hr);
  }

  // Zone durations
  const zoneMilli: number[] = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < samples.length - 1; i++) {
    const dur = (samples[i + 1].t - samples[i].t) * 1000;
    if (dur > 0 && dur < 60000) {
      zoneMilli[getZone(samples[i].bpm, zoneBounds)] += dur;
    }
  }
  const totalMilli = zoneMilli.reduce((a, b) => a + b, 0);

  const zoneData = [
    { label: "5", bpm: `${zoneBounds[4]}+`, color: ZONE_COLORS[5] },
    { label: "4", bpm: `${zoneBounds[3]}–${zoneBounds[4]}`, color: ZONE_COLORS[4] },
    { label: "3", bpm: `${zoneBounds[2]}–${zoneBounds[3]}`, color: ZONE_COLORS[3] },
    { label: "2", bpm: `${zoneBounds[1]}–${zoneBounds[2]}`, color: ZONE_COLORS[2] },
    { label: "1", bpm: `${zoneBounds[0]}–${zoneBounds[1]}`, color: ZONE_COLORS[1] },
    { label: "0", bpm: `<${zoneBounds[0]}`, color: ZONE_COLORS[0] },
  ];

  return (
    <View style={s.container}>
      <Svg width={width} height={chartHeight}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent.red} stopOpacity="0.35" />
            <Stop offset="0.5" stopColor={colors.swim[500]} stopOpacity="0.15" />
            <Stop offset="1" stopColor={colors.swim[500]} stopOpacity="0" />
          </LinearGradient>
          <ClipPath id="plotClip">
            <Rect x={padding.left} y={padding.top} width={plotW} height={plotH} />
          </ClipPath>
        </Defs>

        {/* Zone boundary lines */}
        {zoneLines.map((zl) => (
          <Line
            key={zl.bpm}
            x1={padding.left}
            y1={zl.y}
            x2={padding.left + plotW}
            y2={zl.y}
            stroke={ZONE_COLORS[zl.zone]}
            strokeWidth={0.5}
            strokeDasharray="4,4"
            opacity={0.3}
          />
        ))}

        {/* Set boundary markers */}
        {setMarkers && setMarkers.map((m, i) => {
          const x1 = toX(m.startTime);
          const x2 = toX(m.endTime);
          // Shade the set region
          return (
            <React.Fragment key={i}>
              <Rect
                x={x1}
                y={padding.top}
                width={Math.max(x2 - x1, 1)}
                height={plotH}
                fill={colors.swim[500]}
                opacity={0.06}
              />
              <Line
                x1={x1} y1={padding.top - 2} x2={x1} y2={padding.top + plotH}
                stroke={colors.swim[500]} strokeWidth={1} opacity={0.4}
              />
              <Line
                x1={x2} y1={padding.top - 2} x2={x2} y2={padding.top + plotH}
                stroke={colors.swim[500]} strokeWidth={1} opacity={0.2}
              />
              <SvgText
                x={x1 + 3}
                y={padding.top - 4}
                fontSize={8}
                fill={colors.swim[400]}
                fontWeight="700"
              >
                {m.label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Filled area under curve */}
        <Path
          d={areaPath}
          fill="url(#areaGrad)"
          clipPath="url(#plotClip)"
        />

        {/* HR line */}
        <Path
          d={linePath}
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath="url(#plotClip)"
        />

        {/* Y-axis labels */}
        {hrLabels.map((hr) => (
          <SvgText
            key={hr}
            x={padding.left - 6}
            y={toY(hr) + 3.5}
            fontSize={9}
            fill="rgba(255,255,255,0.25)"
            textAnchor="end"
            fontWeight="600"
          >
            {hr}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {timeLabels.map((tl) => (
          <SvgText
            key={tl.t}
            x={toX(tl.t)}
            y={chartHeight - 6}
            fontSize={9}
            fill="rgba(255,255,255,0.25)"
            textAnchor="middle"
            fontWeight="600"
          >
            {tl.label}
          </SvgText>
        ))}
      </Svg>

      {/* Zone breakdown */}
      <View style={s.zones}>
        {zoneData.map((z, i) => {
          const idx = 5 - i;
          const ms = zoneMilli[idx];
          const pct = totalMilli > 0 ? Math.round((ms / totalMilli) * 100) : 0;
          if (pct === 0 && ms < 1000) return null;
          return (
            <View key={z.label} style={s.zoneRow}>
              <Text style={[s.zoneLabel, { color: z.color }]}>{z.label}</Text>
              <Text style={s.zoneBpm}>{z.bpm}</Text>
              <View style={s.zoneBarOuter}>
                <View style={s.zoneBarTrack}>
                  <View style={[s.zoneBarFill, { width: `${pct}%` as any, backgroundColor: z.color }]} />
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
  container: {},
  zones: { marginTop: 14 },
  zoneRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 5,
  },
  zoneLabel: { fontSize: 12, fontWeight: "800", width: 16 },
  zoneBpm: { fontSize: 9, fontWeight: "500", color: "rgba(255,255,255,0.2)", width: 48 },
  zoneBarOuter: { flex: 1, marginHorizontal: 6 },
  zoneBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  zoneBarFill: { height: 6, borderRadius: 3 },
  zonePct: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.45)", width: 32, textAlign: "right" },
  zoneDur: { fontSize: 12, fontWeight: "600", color: colors.white, width: 40, textAlign: "right" },
});
