import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import TimeInput from "./TimeInput";
import { useState, useEffect } from "react";
import { Stroke, Effort, Segment, RepDetail, SetLine } from "../lib/types";
import { colors } from "../lib/theme";

const EFFORTS: { label: string; value: Effort; color: string }[] = [
  { label: "Easy", value: "easy", color: colors.accent.green },
  { label: "Moderate", value: "moderate", color: colors.accent.yellow },
  { label: "Fast", value: "fast", color: "#f97316" },
  { label: "Sprint", value: "sprint", color: colors.accent.red },
];

const STROKES: { label: string; value: Stroke }[] = [
  { label: "Fr", value: "free" },
  { label: "Bk", value: "back" },
  { label: "Br", value: "breast" },
  { label: "Fl", value: "fly" },
  { label: "Kk", value: "kick" },
  { label: "Dr", value: "drill" },
];

const OFFSETS = [-10, -5, 0, 5, 10, 15, 20];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function paceValue(dist: number, baseTime100: number, offset: number): number {
  const base = Math.ceil(((dist / 100) * baseTime100) / 5) * 5;
  return base + offset;
}

function defaultSegments(distance: number, poolLength: number, stroke: Stroke): Segment[] {
  const count = Math.max(1, Math.floor(distance / poolLength));
  return Array.from({ length: count }, () => ({
    distance: poolLength,
    effort: "moderate" as Effort,
    stroke,
  }));
}

export interface LineInfo {
  id: string;
  reps: number;
  distance: number;
  stroke: Stroke;
  interval: number | null;
}

interface Props {
  visible: boolean;
  lines: LineInfo[];
  poolLength: number;
  baseTime100: number;
  repDetails: RepDetail[];
  onSave: (details: RepDetail[]) => void;
  onClose: () => void;
}

export default function RepDetailModal({
  visible,
  lines,
  poolLength,
  baseTime100,
  repDetails,
  onSave,
  onClose,
}: Props) {
  const [details, setDetails] = useState<RepDetail[]>([]);
  const [expandedRep, setExpandedRep] = useState<number | null>(null);

  const totalReps = (lines || []).reduce((s, l) => s + (l.reps || 0), 0);

  useEffect(() => {
    if (visible && lines.length > 0 && totalReps > 0) {
      if (repDetails.length === totalReps) {
        setDetails(repDetails);
      } else {
        let idx = 0;
        const newDetails: RepDetail[] = [];
        for (const line of lines) {
          for (let r = 0; r < line.reps; r++) {
            newDetails.push(repDetails[idx] || {
              interval: line.interval,
              segments: defaultSegments(line.distance, poolLength, line.stroke),
            });
            idx++;
          }
        }
        setDetails(newDetails);
      }
      setExpandedRep(null);
    }
  }, [visible, totalReps]);

  function updateRep(idx: number, updates: Partial<RepDetail>) {
    setDetails((d) => d.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  }

  function updateSegment(repIdx: number, segIdx: number, updates: Partial<Segment>) {
    const rep = details[repIdx];
    if (!rep) return;
    const segs = rep.segments.map((seg, i) => (i === segIdx ? { ...seg, ...updates } : seg));
    updateRep(repIdx, { segments: segs });
  }

  function setAllIntervals(lineIdx: number, seconds: number) {
    let offset = 0;
    for (let i = 0; i < lineIdx; i++) offset += lines[i].reps;
    const count = lines[lineIdx].reps;
    setDetails((d) =>
      d.map((r, i) => (i >= offset && i < offset + count ? { ...r, interval: seconds } : r))
    );
  }

  interface Preset {
    label: string;
    hardSegs: number;
    hardEffort: Effort;
  }

  function applySplit(lineIdx: number, hardSegs: number, hardEffort: Effort) {
    const line = lines[lineIdx];
    const segCount = Math.max(1, Math.floor(line.distance / poolLength));
    let offset = 0;
    for (let i = 0; i < lineIdx; i++) offset += lines[i].reps;

    setDetails((d) =>
      d.map((r, i) => {
        if (i < offset || i >= offset + line.reps) return r;
        const segs = Array.from({ length: segCount }, (_, si) => ({
          distance: poolLength,
          effort: (si < hardSegs ? hardEffort : "easy") as Effort,
          stroke: line.stroke,
        }));
        return { ...r, segments: segs };
      })
    );
  }

  function applyRepSplit(globalRepIdx: number, distance: number, stroke: Stroke, hardSegs: number, hardEffort: Effort) {
    const segCount = Math.max(1, Math.floor(distance / poolLength));
    const segs = Array.from({ length: segCount }, (_, si) => ({
      distance: poolLength,
      effort: (si < hardSegs ? hardEffort : "easy") as Effort,
      stroke,
    }));
    updateRep(globalRepIdx, { segments: segs });
  }

  function buildPresets(distance: number): Preset[] {
    const segCount = Math.max(1, Math.floor(distance / poolLength));
    const presets: Preset[] = [
      { label: "All Easy", hardSegs: 0, hardEffort: "easy" },
      { label: "All Fast", hardSegs: segCount, hardEffort: "fast" },
      { label: "All Sprint", hardSegs: segCount, hardEffort: "sprint" },
    ];
    for (let f = 1; f < segCount; f++) {
      const hard = f * poolLength;
      const easy = distance - hard;
      presets.push({ label: `${hard}/${easy}`, hardSegs: f, hardEffort: "fast" });
    }
    return presets;
  }

  function matchesPreset(segments: Segment[], preset: Preset, segCount: number): boolean {
    if (segments.length !== segCount) return false;
    if (preset.hardSegs === 0) return segments.every((s) => s.effort === "easy");
    return segments.every((s, i) =>
      i < preset.hardSegs ? s.effort === preset.hardEffort : s.effort === "easy"
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={onClose}>
            <Text style={s.cancelBtn}>Cancel</Text>
          </Pressable>
          <Text style={s.title}>
            {lines.map((l) => `${l.reps}x${l.distance}`).join(" + ")} Details
          </Text>
          <Pressable onPress={() => onSave(details)}>
            <Text style={s.saveBtn}>Save</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {(lines || []).map((line, li) => {
            let repOffset = 0;
            for (let i = 0; i < li; i++) repOffset += (lines[i]?.reps || 0);
            const lineReps = details.slice(repOffset, repOffset + (line.reps || 0));
            if (!line.reps || !line.distance) return null;

            return (
              <View key={line.id}>
                {/* Line header */}
                <Text style={s.lineHeader}>
                  {line.reps}x{line.distance} {line.stroke.toUpperCase()}
                </Text>

                {/* Presets */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presetRow}>
                  {buildPresets(line.distance).map((p) => {
                    const segCount = Math.max(1, Math.floor(line.distance / poolLength));
                    const allMatch = lineReps.length > 0 && lineReps.every((r) => matchesPreset(r.segments, p, segCount));
                    return (
                      <Pressable
                        key={p.label}
                        onPress={() => applySplit(li, p.hardSegs, p.hardEffort)}
                        style={[s.presetChip, allMatch && s.presetChipActive]}
                      >
                        <Text style={[s.presetText, allMatch && s.presetTextActive]}>{p.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Intervals for this line */}
                <Text style={s.sectionLabel}>SET ALL INTERVALS</Text>
                <View style={s.intervalRow}>
                  <View style={s.paceChips}>
                    {OFFSETS.map((offset) => {
                      const val = paceValue(line.distance, baseTime100, offset);
                      const allSame = lineReps.every((d) => d.interval === val);
                      const label = offset === 0 ? "base" : offset > 0 ? `+${offset}` : `${offset}`;
                      return (
                        <Pressable
                          key={offset}
                          onPress={() => setAllIntervals(li, val)}
                          style={[s.paceChip, allSame && s.paceChipActive]}
                        >
                          <Text style={[s.paceChipLabel, allSame && s.paceChipLabelActive]}>{label}</Text>
                          <Text style={[s.paceChipTime, allSame && s.paceChipTimeActive]}>
                            {formatTime(val)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TimeInput
                    style={s.intervalInput}
                    value={lineReps.length > 0 && lineReps.every((d) => d.interval === lineReps[0].interval) ? lineReps[0].interval : null}
                    onChange={(v) => { if (v != null && v > 0) setAllIntervals(li, v); }}
                  />
                </View>

                {/* Per rep for this line */}
                {lineReps.map((rep, localRi) => {
                  const globalRi = repOffset + localRi;
                  const isExpanded = expandedRep === globalRi;
                  return (
                    <View key={globalRi} style={s.repCard}>
                      <Pressable
                        style={s.repHeader}
                        onPress={() => setExpandedRep(isExpanded ? null : globalRi)}
                      >
                        <Text style={s.repTitle}>#{localRi + 1}</Text>
                        <View style={s.repSummary}>
                          {rep.interval != null && (
                            <Text style={s.repInterval}>@ {formatTime(rep.interval)}</Text>
                          )}
                          <View style={s.segmentDots}>
                            {rep.segments.map((seg, si) => {
                              const ec = EFFORTS.find((e) => e.value === seg.effort)?.color || colors.muted;
                              const strokeAbbr = seg.stroke === line.stroke ? "" : seg.stroke.slice(0, 2);
                              return (
                                <View key={si} style={s.dotWrap}>
                                  <View style={[s.dot, { backgroundColor: ec }]} />
                                  {strokeAbbr !== "" && (
                                    <Text style={s.dotStroke}>{strokeAbbr}</Text>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                          <Text style={s.chevron}>{isExpanded ? "▾" : "▸"}</Text>
                        </View>
                      </Pressable>

                      {isExpanded && (
                        <View style={s.repBody}>
                          <View style={s.intervalRow}>
                            <View style={s.paceChips}>
                              {OFFSETS.map((offset) => {
                                const val = paceValue(line.distance, baseTime100, offset);
                                const isActive = rep.interval === val;
                                const label = offset === 0 ? "base" : offset > 0 ? `+${offset}` : `${offset}`;
                                return (
                                  <Pressable
                                    key={offset}
                                    onPress={() => updateRep(globalRi, { interval: val })}
                                    style={[s.paceChip, isActive && s.paceChipActive]}
                                  >
                                    <Text style={[s.paceChipLabel, isActive && s.paceChipLabelActive]}>{label}</Text>
                                    <Text style={[s.paceChipTime, isActive && s.paceChipTimeActive]}>
                                      {formatTime(val)}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <TimeInput
                              style={s.intervalInput}
                              value={rep.interval}
                              onChange={(v) => updateRep(globalRi, { interval: v })}
                            />
                          </View>

                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.repPresetRow}>
                            {buildPresets(line.distance).map((p) => {
                              const segCount = Math.max(1, Math.floor(line.distance / poolLength));
                              const isActive = matchesPreset(rep.segments, p, segCount);
                              return (
                                <Pressable
                                  key={p.label}
                                  onPress={() => applyRepSplit(globalRi, line.distance, line.stroke, p.hardSegs, p.hardEffort)}
                                  style={[s.repPresetChip, isActive && s.repPresetChipActive]}
                                >
                                  <Text style={[s.repPresetText, isActive && s.repPresetTextActive]}>{p.label}</Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>

                          {rep.segments.map((seg, si) => (
                            <View key={si} style={s.segRow}>
                              <Text style={s.segLabel}>
                                {poolLength * si}–{poolLength * (si + 1)}
                              </Text>
                              <View style={s.segChips}>
                                {EFFORTS.map((e) => (
                                  <Pressable
                                    key={e.value}
                                    onPress={() => updateSegment(globalRi, si, { effort: e.value })}
                                    style={[s.effortChip, seg.effort === e.value && { backgroundColor: e.color }]}
                                  >
                                    <Text style={[s.effortText, seg.effort === e.value && s.effortTextActive]}>
                                      {e.label}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                              <View style={s.segChips}>
                                {STROKES.map((st) => (
                                  <Pressable
                                    key={st.value}
                                    onPress={() => updateSegment(globalRi, si, { stroke: st.value })}
                                    style={[s.strokeChip, seg.stroke === st.value && s.strokeChipActive]}
                                  >
                                    <Text style={[s.strokeText, seg.stroke === st.value && s.strokeTextActive]}>
                                      {st.label}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
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

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", color: colors.white },
  saveBtn: { fontSize: 15, color: colors.swim[500], fontWeight: "700" },
  lineHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  presetRow: { paddingHorizontal: 20, marginBottom: 4 },
  presetChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  presetChipActive: { backgroundColor: colors.swim[600] },
  presetText: { fontSize: 13, fontWeight: "600", color: colors.white },
  presetTextActive: { color: colors.white },
  intervalRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20 },
  intervalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    width: 56,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
    marginLeft: 8,
  },
  paceChips: { flexDirection: "row", flexWrap: "wrap", flex: 1 },
  paceChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
    alignItems: "center",
    minWidth: 44,
  },
  paceChipActive: { backgroundColor: colors.swim[600] },
  paceChipLabel: { fontSize: 10, fontWeight: "700", color: colors.muted },
  paceChipLabelActive: { color: "rgba(255,255,255,0.7)" },
  paceChipTime: { fontSize: 12, fontWeight: "700", color: colors.white, marginTop: 1 },
  paceChipTimeActive: { color: colors.white },
  repCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  repHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  repTitle: { fontSize: 14, fontWeight: "700", color: colors.white },
  repSummary: { flexDirection: "row", alignItems: "center" },
  repInterval: { fontSize: 12, color: colors.muted, marginRight: 10 },
  segmentDots: { flexDirection: "row", marginRight: 8 },
  dotWrap: { alignItems: "center", marginRight: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotStroke: { fontSize: 7, color: colors.muted, fontWeight: "600", marginTop: 1 },
  chevron: { fontSize: 12, color: colors.muted },
  repBody: { paddingHorizontal: 14, paddingBottom: 14 },
  repPresetRow: { marginBottom: 10 },
  repPresetChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  repPresetChipActive: { backgroundColor: colors.swim[600] },
  repPresetText: { fontSize: 11, fontWeight: "600", color: colors.white },
  repPresetTextActive: { color: colors.white },
  segRow: { marginBottom: 10 },
  segLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  segChips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  effortChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 5,
    marginBottom: 4,
  },
  effortText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  effortTextActive: { color: colors.white },
  strokeChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  strokeChipActive: { backgroundColor: colors.swim[600] },
  strokeText: { fontSize: 10, fontWeight: "600", color: colors.muted },
  strokeTextActive: { color: colors.white },
});
