import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Stroke, Mode, Effort, LineModifier, Equipment, BreathControl,
  IntervalType, Targets,
} from "../lib/types";
import { colors } from "../lib/theme";
import TimeInput from "./TimeInput";

const STROKES: { label: string; value: Stroke }[] = [
  { label: "Fr", value: "free" },
  { label: "Bk", value: "back" },
  { label: "Br", value: "breast" },
  { label: "Fl", value: "fly" },
  { label: "IM", value: "IM" },
  { label: "Ch", value: "choice" },
  { label: "Mx", value: "mixed" },
];

const MODES: { label: string; value: Mode }[] = [
  { label: "Swim", value: "swim" },
  { label: "Kick", value: "kick" },
  { label: "Drill", value: "drill" },
  { label: "Pull", value: "pull" },
  { label: "Scull", value: "scull" },
];

const EFFORTS: { label: string; value: Effort; color: string }[] = [
  { label: "Easy", value: "easy", color: colors.accent.green },
  { label: "Mod", value: "moderate", color: colors.accent.yellow },
  { label: "Fast", value: "fast", color: "#f97316" },
  { label: "Sprint", value: "sprint", color: colors.accent.red },
];

const MODIFIERS: { label: string; value: LineModifier }[] = [
  { label: "Build", value: "build" },
  { label: "Desc", value: "descend" },
  { label: "Asc", value: "ascend" },
  { label: "Neg Split", value: "negative_split" },
  { label: "Pos Split", value: "positive_split" },
  { label: "Broken", value: "broken" },
];

const EQUIPMENT_OPTIONS: { label: string; value: Equipment }[] = [
  { label: "Fins", value: "fins" },
  { label: "Paddles", value: "paddles" },
  { label: "Buoy", value: "buoy" },
  { label: "Board", value: "kickboard" },
  { label: "Snorkel", value: "snorkel" },
  { label: "Band", value: "band" },
];

const OFFSETS = [-10, -5, 0, 5, 10, 15, 20];

export interface LineInput {
  id: string;
  kind: "work" | "rest";
  // work fields
  reps: string;
  distance: string;
  stroke: Stroke;
  mode: Mode;
  effort: Effort | "";
  interval: string;
  interval_type: IntervalType;
  base_offset: number;
  modifiers: LineModifier[];
  equipment: Equipment[];
  breathing: BreathControl | null;
  targets: Targets | null;
  // rest fields
  rest_seconds: string;
}

export interface GroupInput {
  id: string;
  rounds: string;
  lines: LineInput[];
}

export interface SetInput {
  id: string;
  groups: GroupInput[];
  description: string;
  hasDetails: boolean;
}

interface Props {
  set: SetInput;
  index: number;
  baseTime100: number;
  onUpdate: (updates: Partial<SetInput>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenDetails: () => void;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function suggestedInterval(distance: number, baseTime100: number): number {
  const raw = (distance / 100) * baseTime100;
  return Math.ceil(raw / 5) * 5;
}

function paceValue(dist: number, baseTime100: number, offset: number): number {
  return suggestedInterval(dist, baseTime100) + offset;
}

export function createEmptyLine(): LineInput {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    kind: "work",
    reps: "1",
    distance: "100",
    stroke: "free",
    mode: "swim",
    effort: "",
    interval: "",
    interval_type: "fixed",
    base_offset: 0,
    modifiers: [],
    equipment: [],
    breathing: null,
    targets: null,
    rest_seconds: "",
  };
}

export function createRestLine(): LineInput {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    kind: "rest",
    reps: "",
    distance: "",
    stroke: "free",
    mode: "swim",
    effort: "",
    interval: "",
    interval_type: "fixed",
    base_offset: 0,
    modifiers: [],
    equipment: [],
    breathing: null,
    targets: null,
    rest_seconds: "30",
  };
}

export function createEmptyGroup(): GroupInput {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    rounds: "1",
    lines: [createEmptyLine()],
  };
}

// --- Chip toggle helpers ---

function toggleInArray<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

// --- Rest Line Entry ---

function RestLineEntry({
  line,
  onUpdate,
  onRemove,
  onSwitchToWork,
  canRemove,
}: {
  line: LineInput;
  onUpdate: (u: Partial<LineInput>) => void;
  onRemove: () => void;
  onSwitchToWork: () => void;
  canRemove: boolean;
}) {
  return (
    <View style={s.lineCard}>
      <View style={s.inputRow}>
        <Pressable onPress={onSwitchToWork} style={s.kindToggle}>
          <Text style={s.kindToggleTextInactive}>Work</Text>
        </Pressable>
        <Pressable style={[s.kindToggle, s.kindToggleActive]}>
          <Text style={s.kindToggleTextActive}>Rest</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <FontAwesome name="times" size={14} color={colors.accent.red} />
          </Pressable>
        )}
      </View>
      <View style={s.restRow}>
        <TextInput
          style={[s.input, { width: 64, textAlign: "center" }]}
          value={line.rest_seconds}
          onChangeText={(v) => onUpdate({ rest_seconds: v })}
          keyboardType="number-pad"
          placeholder="30"
          placeholderTextColor={colors.muted}
        />
        <Text style={s.restLabel}>seconds rest</Text>
      </View>
      <View style={s.restChips}>
        {[10, 15, 20, 30, 45, 60, 90, 120].map((sec) => (
          <Pressable
            key={sec}
            onPress={() => onUpdate({ rest_seconds: sec.toString() })}
            style={[s.distChip, parseInt(line.rest_seconds) === sec && s.distChipActive]}
          >
            <Text style={[s.distText, parseInt(line.rest_seconds) === sec && s.distTextActive]}>
              {sec >= 60 ? `${sec / 60}:00` : `:${sec}`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// --- Work Line Entry ---

function WorkLineEntry({
  line,
  baseTime100,
  onUpdate,
  onRemove,
  onSwitchToRest,
  canRemove,
}: {
  line: LineInput;
  baseTime100: number;
  onUpdate: (u: Partial<LineInput>) => void;
  onRemove: () => void;
  onSwitchToRest: () => void;
  canRemove: boolean;
}) {
  const [showMore, setShowMore] = useState(
    line.modifiers.length > 0 || line.equipment.length > 0 || line.breathing != null || line.targets != null
  );
  const dist = parseInt(line.distance) || 0;
  const currentInterval = line.interval ? parseInt(line.interval) : 0;

  return (
    <View style={s.lineCard}>
      {/* Kind toggle + reps x distance */}
      <View style={s.inputRow}>
        <Pressable style={[s.kindToggle, s.kindToggleActive]}>
          <Text style={s.kindToggleTextActive}>Work</Text>
        </Pressable>
        <Pressable onPress={onSwitchToRest} style={s.kindToggle}>
          <Text style={s.kindToggleTextInactive}>Rest</Text>
        </Pressable>
        <View style={{ width: 8 }} />
        <TextInput
          style={[s.input, { width: 42, textAlign: "center" }]}
          value={line.reps}
          onChangeText={(v) => onUpdate({ reps: v })}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={colors.muted}
        />
        <Text style={s.x}>x</Text>
        <TextInput
          style={[s.input, { width: 58, textAlign: "center" }]}
          value={line.distance}
          onChangeText={(v) => onUpdate({ distance: v })}
          keyboardType="number-pad"
          placeholder="100"
          placeholderTextColor={colors.muted}
        />
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: "auto" }}>
            <FontAwesome name="times" size={14} color={colors.accent.red} />
          </Pressable>
        )}
      </View>

      {/* Distance chips */}
      <View style={s.distChips}>
        {[25, 50, 75, 100, 150, 200, 250, 300, 400, 500].map((d) => (
          <Pressable
            key={d}
            onPress={() => onUpdate({ distance: d.toString() })}
            style={[s.distChip, dist === d && s.distChipActive]}
          >
            <Text style={[s.distText, dist === d && s.distTextActive]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      {/* Stroke + Mode row */}
      <View style={s.strokes}>
        {STROKES.map((st) => (
          <Pressable
            key={st.value}
            onPress={() => onUpdate({ stroke: st.value })}
            style={[s.strokeChip, line.stroke === st.value && s.strokeActive]}
          >
            <Text style={[s.strokeText, line.stroke === st.value && s.strokeTextActive]}>
              {st.label}
            </Text>
          </Pressable>
        ))}
        <View style={{ width: 6 }} />
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => onUpdate({ mode: m.value })}
            style={[s.strokeChip, line.mode === m.value && s.modeActive]}
          >
            <Text style={[s.strokeText, line.mode === m.value && s.modeTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Effort row */}
      <View style={s.effortRow}>
        {EFFORTS.map((e) => (
          <Pressable
            key={e.value}
            onPress={() => onUpdate({ effort: line.effort === e.value ? "" : e.value })}
            style={[s.effortChip, line.effort === e.value && { backgroundColor: e.color }]}
          >
            <Text style={[s.effortChipText, line.effort === e.value && s.effortChipTextActive]}>
              {e.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Interval */}
      {dist > 0 && (
        <View style={s.paceRow}>
          <View style={s.paceChips}>
            {OFFSETS.map((offset) => {
              const val = paceValue(dist, baseTime100, offset);
              const isActive = currentInterval === val;
              const label = offset === 0 ? "base" : offset > 0 ? `+${offset}` : `${offset}`;
              return (
                <Pressable
                  key={offset}
                  onPress={() => onUpdate({ interval: val.toString() })}
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
            value={currentInterval || null}
            onChange={(v) => onUpdate({ interval: v != null ? v.toString() : "" })}
          />
        </View>
      )}

      {/* More options toggle */}
      <Pressable onPress={() => setShowMore(!showMore)} style={s.moreToggle}>
        <Text style={s.moreToggleText}>
          {showMore ? "Less options" : "More options"}
        </Text>
        <FontAwesome name={showMore ? "chevron-up" : "chevron-down"} size={10} color={colors.muted} />
      </Pressable>

      {showMore && (
        <View style={s.moreSection}>
          {/* Modifiers */}
          <Text style={s.moreLabel}>MODIFIERS</Text>
          <View style={s.chipRow}>
            {MODIFIERS.map((m) => {
              const active = line.modifiers.includes(m.value);
              return (
                <Pressable
                  key={m.value}
                  onPress={() => onUpdate({ modifiers: toggleInArray(line.modifiers, m.value) })}
                  style={[s.toggleChip, active && s.toggleChipActive]}
                >
                  <Text style={[s.toggleChipText, active && s.toggleChipTextActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Equipment */}
          <Text style={s.moreLabel}>EQUIPMENT</Text>
          <View style={s.chipRow}>
            {EQUIPMENT_OPTIONS.map((eq) => {
              const active = line.equipment.includes(eq.value);
              return (
                <Pressable
                  key={eq.value}
                  onPress={() => onUpdate({ equipment: toggleInArray(line.equipment, eq.value) })}
                  style={[s.toggleChip, active && s.toggleChipActive]}
                >
                  <Text style={[s.toggleChipText, active && s.toggleChipTextActive]}>{eq.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Breathing */}
          <Text style={s.moreLabel}>BREATHING</Text>
          <View style={s.chipRow}>
            <Pressable
              onPress={() => onUpdate({ breathing: null })}
              style={[s.toggleChip, line.breathing == null && s.toggleChipActive]}
            >
              <Text style={[s.toggleChipText, line.breathing == null && s.toggleChipTextActive]}>Normal</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate({ breathing: { type: "none" } })}
              style={[s.toggleChip, line.breathing?.type === "none" && s.toggleChipActive]}
            >
              <Text style={[s.toggleChipText, line.breathing?.type === "none" && s.toggleChipTextActive]}>No breath</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate({ breathing: { type: "every_n", value: line.breathing?.type === "every_n" ? line.breathing.value : 5 } })}
              style={[s.toggleChip, line.breathing?.type === "every_n" && s.toggleChipActive]}
            >
              <Text style={[s.toggleChipText, line.breathing?.type === "every_n" && s.toggleChipTextActive]}>Every N</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate({ breathing: { type: "limited", value: line.breathing?.type === "limited" ? line.breathing.value : 1 } })}
              style={[s.toggleChip, line.breathing?.type === "limited" && s.toggleChipActive]}
            >
              <Text style={[s.toggleChipText, line.breathing?.type === "limited" && s.toggleChipTextActive]}>Limited</Text>
            </Pressable>
          </View>
          {line.breathing?.type === "every_n" && (
            <View style={s.breathValueRow}>
              <Text style={s.breathValueLabel}>Breathe every</Text>
              <TextInput
                style={[s.input, { width: 42, textAlign: "center" }]}
                value={line.breathing.value?.toString() ?? ""}
                onChangeText={(v) => onUpdate({ breathing: { type: "every_n", value: parseInt(v) || undefined } })}
                keyboardType="number-pad"
              />
              <Text style={s.breathValueLabel}>strokes</Text>
            </View>
          )}
          {line.breathing?.type === "limited" && (
            <View style={s.breathValueRow}>
              <TextInput
                style={[s.input, { width: 42, textAlign: "center" }]}
                value={line.breathing.value?.toString() ?? ""}
                onChangeText={(v) => onUpdate({ breathing: { type: "limited", value: parseInt(v) || undefined } })}
                keyboardType="number-pad"
              />
              <Text style={s.breathValueLabel}>breath(s) per 25</Text>
            </View>
          )}

          {/* Targets */}
          <Text style={s.moreLabel}>TARGETS</Text>
          <View style={s.targetsRow}>
            <View style={s.targetField}>
              <Text style={s.targetLabel}>Strokes</Text>
              <TextInput
                style={[s.input, { textAlign: "center" }]}
                value={line.targets?.stroke_count?.toString() ?? ""}
                onChangeText={(v) => {
                  const val = parseInt(v) || undefined;
                  const t = { ...line.targets, stroke_count: val } as Targets;
                  onUpdate({ targets: (t.stroke_count || t.dps || t.tempo_seconds) ? t : null });
                }}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={s.targetField}>
              <Text style={s.targetLabel}>DPS</Text>
              <TextInput
                style={[s.input, { textAlign: "center" }]}
                value={line.targets?.dps?.toString() ?? ""}
                onChangeText={(v) => {
                  const val = parseFloat(v) || undefined;
                  const t = { ...line.targets, dps: val } as Targets;
                  onUpdate({ targets: (t.stroke_count || t.dps || t.tempo_seconds) ? t : null });
                }}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={s.targetField}>
              <Text style={s.targetLabel}>Tempo (s)</Text>
              <TextInput
                style={[s.input, { textAlign: "center" }]}
                value={line.targets?.tempo_seconds?.toString() ?? ""}
                onChangeText={(v) => {
                  const val = parseFloat(v) || undefined;
                  const t = { ...line.targets, tempo_seconds: val } as Targets;
                  onUpdate({ targets: (t.stroke_count || t.dps || t.tempo_seconds) ? t : null });
                }}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// --- Line Entry dispatcher ---

function LineEntry({
  line,
  baseTime100,
  onUpdate,
  onRemove,
  canRemove,
}: {
  line: LineInput;
  baseTime100: number;
  onUpdate: (u: Partial<LineInput>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  if (line.kind === "rest") {
    return (
      <RestLineEntry
        line={line}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onSwitchToWork={() => onUpdate({ kind: "work" })}
        canRemove={canRemove}
      />
    );
  }
  return (
    <WorkLineEntry
      line={line}
      baseTime100={baseTime100}
      onUpdate={onUpdate}
      onRemove={onRemove}
      onSwitchToRest={() => onUpdate({ kind: "rest", rest_seconds: "30" })}
      canRemove={canRemove}
    />
  );
}

export default function SetEntry({
  set, index, baseTime100, onUpdate, onRemove, onMoveUp, onMoveDown, onOpenDetails, canRemove, isFirst, isLast,
}: Props) {
  function updateGroup(gid: string, u: Partial<GroupInput>) {
    onUpdate({ groups: set.groups.map((g) => (g.id === gid ? { ...g, ...u } : g)) });
  }
  function updateLine(gid: string, lid: string, u: Partial<LineInput>) {
    onUpdate({
      groups: set.groups.map((g) =>
        g.id === gid ? { ...g, lines: g.lines.map((l) => (l.id === lid ? { ...l, ...u } : l)) } : g
      ),
    });
  }
  function removeLine(gid: string, lid: string) {
    const group = set.groups.find((g) => g.id === gid);
    if (!group) return;
    if (group.lines.length > 1) {
      updateGroup(gid, { lines: group.lines.filter((l) => l.id !== lid) });
    } else if (set.groups.length > 1) {
      onUpdate({ groups: set.groups.filter((g) => g.id !== gid) });
    }
  }
  function addLine(gid: string) {
    const group = set.groups.find((g) => g.id === gid);
    if (group) updateGroup(gid, { lines: [...group.lines, createEmptyLine()] });
  }
  function addRestLine(gid: string) {
    const group = set.groups.find((g) => g.id === gid);
    if (group) updateGroup(gid, { lines: [...group.lines, createRestLine()] });
  }
  function addGroup() {
    onUpdate({ groups: [...set.groups, createEmptyGroup()] });
  }
  function removeGroup(gid: string) {
    if (set.groups.length > 1) {
      onUpdate({ groups: set.groups.filter((g) => g.id !== gid) });
    }
  }

  const totalYards = set.groups.reduce((sum, g) => {
    const rounds = parseInt(g.rounds) || 1;
    const groupYards = g.lines.reduce((ls, l) => {
      if (l.kind === "rest") return ls;
      return ls + (parseInt(l.reps) || 0) * (parseInt(l.distance) || 0);
    }, 0);
    return sum + groupYards * rounds;
  }, 0);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.reorderBtns}>
            <Pressable onPress={onMoveUp} disabled={isFirst} hitSlop={6}>
              <FontAwesome name="chevron-up" size={10} color={isFirst ? colors.border : colors.muted} />
            </Pressable>
            <Pressable onPress={onMoveDown} disabled={isLast} hitSlop={6}>
              <FontAwesome name="chevron-down" size={10} color={isLast ? colors.border : colors.muted} />
            </Pressable>
          </View>
          <Text style={s.setLabel}>SET {index + 1}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {totalYards > 0 && <Text style={s.yardage}>{totalYards}</Text>}
          {canRemove && (
            <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: 12 }}>
              <Text style={s.remove}>Remove</Text>
            </Pressable>
          )}
        </View>
      </View>

      {set.groups.map((group, gi) => {
        const rounds = parseInt(group.rounds) || 1;
        return (
          <View key={group.id} style={gi > 0 ? s.groupDivider : undefined}>
            {/* Rounds selector */}
            <View style={s.roundsRow}>
              <Text style={s.roundsLabel}>{rounds > 1 ? `${rounds}× through` : "1× through"}</Text>
              <View style={s.roundsChips}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => updateGroup(group.id, { rounds: n.toString() })}
                    style={[s.roundChip, rounds === n && s.roundChipActive]}
                  >
                    <Text style={[s.roundText, rounds === n && s.roundTextActive]}>{n}×</Text>
                  </Pressable>
                ))}
              </View>
              {set.groups.length > 1 && (
                <Pressable onPress={() => removeGroup(group.id)} hitSlop={8}>
                  <FontAwesome name="times" size={12} color={colors.accent.red} />
                </Pressable>
              )}
            </View>

            {/* Group bracket */}
            <View style={rounds > 1 ? s.bracketWrap : undefined}>
              {rounds > 1 && <View style={s.bracket} />}
              <View style={{ flex: 1 }}>
                {group.lines.map((line) => (
                  <LineEntry
                    key={line.id}
                    line={line}
                    baseTime100={baseTime100}
                    onUpdate={(u) => updateLine(group.id, line.id, u)}
                    onRemove={() => removeLine(group.id, line.id)}
                    canRemove={group.lines.length > 1 || set.groups.length > 1}
                  />
                ))}
                <View style={s.addBtnsRow}>
                  <Pressable onPress={() => addLine(group.id)} style={s.addLineBtn}>
                    <Text style={s.addLineText}>+ Line</Text>
                  </Pressable>
                  <Pressable onPress={() => addRestLine(group.id)} style={s.addLineBtn}>
                    <Text style={[s.addLineText, { color: colors.muted }]}>+ Rest</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        );
      })}

      <Pressable onPress={addGroup} style={s.addGroupBtn}>
        <Text style={s.addGroupText}>+ Add Group</Text>
      </Pressable>

      <Pressable onPress={onOpenDetails} style={s.detailsBtn}>
        <Text style={s.detailsBtnText}>
          {set.hasDetails ? "Edit Rep Details" : "Per-Rep Details"}
        </Text>
        <FontAwesome name="chevron-right" size={12} color={colors.swim[400]} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  reorderBtns: { marginRight: 10, alignItems: "center", gap: 4 },
  setLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.5 },
  yardage: { fontSize: 12, color: colors.swim[400], fontWeight: "700" },
  remove: { fontSize: 12, color: colors.accent.red, fontWeight: "600" },
  groupDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 6 },
  roundsRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  roundsLabel: { fontSize: 11, color: colors.swim[400], fontWeight: "700", marginRight: 8 },
  roundsChips: { flexDirection: "row", flex: 1 },
  roundChip: {
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
    backgroundColor: colors.surfaceLight, marginRight: 4,
  },
  roundChipActive: { backgroundColor: colors.swim[600] },
  roundText: { fontSize: 10, fontWeight: "700", color: colors.muted },
  roundTextActive: { color: colors.white },
  bracketWrap: { flexDirection: "row" },
  bracket: {
    width: 3, backgroundColor: colors.swim[600], borderRadius: 2, marginRight: 10, marginVertical: 4,
  },
  lineCard: { marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 15, fontWeight: "600", color: colors.white,
  },
  x: { color: colors.muted, fontWeight: "700", marginHorizontal: 6, fontSize: 14 },
  // Kind toggle (Work/Rest)
  kindToggle: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: colors.surfaceLight, marginRight: 4,
  },
  kindToggleActive: { backgroundColor: colors.swim[600] },
  kindToggleTextActive: { fontSize: 11, fontWeight: "700", color: colors.white },
  kindToggleTextInactive: { fontSize: 11, fontWeight: "600", color: colors.muted },
  // Rest line
  restRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  restLabel: { color: colors.muted, fontSize: 13, marginLeft: 8 },
  restChips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  // Distance chips
  distChips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  distChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 5,
    marginRight: 5, marginBottom: 4,
  },
  distChipActive: { backgroundColor: colors.swim[600] },
  distText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  distTextActive: { color: colors.white },
  // Stroke + Mode chips
  strokes: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  strokeChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    marginRight: 4, marginBottom: 4,
  },
  strokeActive: { backgroundColor: colors.swim[600] },
  strokeText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  strokeTextActive: { color: colors.white },
  modeActive: { backgroundColor: "#7c3aed" },
  modeTextActive: { color: colors.white },
  // Effort chips
  effortRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  effortChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    marginRight: 5, marginBottom: 4,
  },
  effortChipText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  effortChipTextActive: { color: colors.white },
  // Interval/pace
  paceRow: { flexDirection: "row", alignItems: "flex-start" },
  paceChips: { flexDirection: "row", flexWrap: "wrap", flex: 1 },
  paceChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    marginRight: 5, marginBottom: 5, alignItems: "center", minWidth: 42,
  },
  paceChipActive: { backgroundColor: colors.swim[600] },
  paceChipLabel: { fontSize: 9, fontWeight: "700", color: colors.muted },
  paceChipLabelActive: { color: "rgba(255,255,255,0.7)" },
  paceChipTime: { fontSize: 11, fontWeight: "700", color: colors.white, marginTop: 1 },
  paceChipTimeActive: { color: colors.white },
  // More options
  moreToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 6, marginTop: 2,
  },
  moreToggleText: { fontSize: 11, fontWeight: "600", color: colors.muted, marginRight: 6 },
  moreSection: { marginTop: 4 },
  moreLabel: {
    fontSize: 9, color: colors.muted, fontWeight: "700", letterSpacing: 1.2,
    marginBottom: 6, marginTop: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  toggleChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    marginRight: 5, marginBottom: 4,
  },
  toggleChipActive: { backgroundColor: colors.swim[600] },
  toggleChipText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  toggleChipTextActive: { color: colors.white },
  breathValueRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 4 },
  breathValueLabel: { fontSize: 12, color: colors.muted, marginHorizontal: 6 },
  // Targets
  targetsRow: { flexDirection: "row" },
  targetField: { flex: 1, marginRight: 8 },
  targetLabel: { fontSize: 9, color: colors.muted, fontWeight: "700", marginBottom: 4 },
  // Add line buttons
  addBtnsRow: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 6 },
  addLineBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  addLineText: { fontSize: 12, fontWeight: "600", color: colors.swim[400] },
  addGroupBtn: {
    paddingVertical: 8, alignItems: "center",
    borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, marginBottom: 4,
  },
  addGroupText: { fontSize: 13, fontWeight: "600", color: colors.swim[400] },
  detailsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  detailsBtnText: { fontSize: 13, fontWeight: "600", color: colors.swim[400] },
});
