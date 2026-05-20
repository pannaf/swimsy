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
  { label: "Lane Leader", value: "lane_leader" },
];

const EQUIPMENT_OPTIONS: { label: string; value: Equipment }[] = [
  { label: "Fins", value: "fins" },
  { label: "Paddles", value: "paddles" },
  { label: "Buoy", value: "buoy" },
  { label: "Board", value: "kickboard" },
  { label: "Snorkel", value: "snorkel" },
  { label: "Band", value: "band" },
  { label: "Drag Suit", value: "drag_suit" },
];

const OFFSETS = [-10, -5, 0, 5, 10, 15, 20];

export interface LineInput {
  id: string;
  kind: "work" | "rest";
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
  expandedLineId: string | null;
  onExpandLine: (id: string | null) => void;
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

function effortColor(effort: Effort | ""): string {
  return EFFORTS.find((e) => e.value === effort)?.color || colors.muted;
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

function toggleInArray<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

// --- Summary line for tags ---
function tagSummary(line: LineInput): string[] {
  const tags: string[] = [];
  if (line.mode !== "swim") tags.push(line.mode);
  if (line.modifiers.length > 0) tags.push(...line.modifiers.map((m) => m.replace(/_/g, " ")));
  if (line.equipment.length > 0) tags.push(line.equipment.join(", "));
  if (line.breathing) {
    if (line.breathing.type === "none") tags.push("no breath");
    else if (line.breathing.type === "every_n") tags.push(`every ${line.breathing.value}`);
    else if (line.breathing.type === "limited") tags.push(`${line.breathing.value}br/25`);
  }
  return tags;
}

// === COLLAPSED LINE ===
function CollapsedLine({
  line,
  onExpand,
  onRemove,
  canRemove,
}: {
  line: LineInput;
  onExpand: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  if (line.kind === "rest") {
    const sec = parseInt(line.rest_seconds) || 0;
    return (
      <Pressable onPress={onExpand} style={s.collapsedRow}>
        <Text style={s.restText}>
          {sec >= 60 ? `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}` : `:${sec}`} rest
        </Text>
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={12} style={s.collapsedRemove}>
            <FontAwesome name="times" size={11} color={colors.accent.red} />
          </Pressable>
        )}
      </Pressable>
    );
  }

  const reps = parseInt(line.reps) || 1;
  const dist = line.distance || "?";
  const interval = line.interval ? parseInt(line.interval) : null;
  const tags = tagSummary(line);

  return (
    <Pressable onPress={onExpand} style={s.collapsedRow}>
      <View style={s.collapsedLeft}>
        {line.effort ? (
          <View style={[s.effortDotSmall, { backgroundColor: effortColor(line.effort) }]} />
        ) : null}
        <Text style={s.collapsedText}>
          {reps > 1 ? `${reps} x ` : ""}{dist}
          <Text style={s.collapsedStroke}> {line.stroke}</Text>
          {line.mode !== "swim" && <Text style={s.collapsedMode}> {line.mode}</Text>}
        </Text>
        {tags.length > 0 && (
          <View style={s.collapsedTags}>
            {tags.map((t, i) => (
              <View key={i} style={s.miniTag}><Text style={s.miniTagText}>{t}</Text></View>
            ))}
          </View>
        )}
      </View>
      <View style={s.collapsedRight}>
        {interval != null && interval > 0 && (
          <Text style={s.collapsedInterval}>@ {formatTime(interval)}</Text>
        )}
        <FontAwesome name="chevron-right" size={10} color={colors.muted} style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );
}

// === EXPANDED LINE ===
function ExpandedLine({
  line,
  baseTime100,
  onUpdate,
  onRemove,
  onCollapse,
  canRemove,
}: {
  line: LineInput;
  baseTime100: number;
  onUpdate: (u: Partial<LineInput>) => void;
  onRemove: () => void;
  onCollapse: () => void;
  canRemove: boolean;
}) {
  const [showMore, setShowMore] = useState(
    line.modifiers.length > 0 || line.equipment.length > 0 || line.breathing != null || line.targets != null
  );

  // --- REST ---
  if (line.kind === "rest") {
    return (
      <View style={s.expandedCard}>
        <View style={s.expandedHeader}>
          <Pressable onPress={onCollapse}><Text style={s.doneBtn}>Done</Text></Pressable>
          {canRemove && (
            <Pressable onPress={onRemove} hitSlop={8}>
              <FontAwesome name="trash-o" size={14} color={colors.accent.red} />
            </Pressable>
          )}
        </View>
        <View style={s.restInputRow}>
          <TextInput
            style={[s.input, { width: 64, textAlign: "center" }]}
            value={line.rest_seconds}
            onChangeText={(v) => onUpdate({ rest_seconds: v })}
            keyboardType="number-pad"
            placeholder="30"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <Text style={s.restLabel}>seconds rest</Text>
        </View>
        <View style={s.chipRow}>
          {[10, 15, 20, 30, 45, 60, 90, 120].map((sec) => (
            <Pressable
              key={sec}
              onPress={() => onUpdate({ rest_seconds: sec.toString() })}
              style={[s.chip, parseInt(line.rest_seconds) === sec && s.chipActive]}
            >
              <Text style={[s.chipText, parseInt(line.rest_seconds) === sec && s.chipTextActive]}>
                {sec >= 60 ? `${sec / 60}:00` : `:${sec}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // --- WORK ---
  const dist = parseInt(line.distance) || 0;
  const currentInterval = line.interval ? parseInt(line.interval) : 0;

  return (
    <View style={s.expandedCard}>
      {/* Header */}
      <View style={s.expandedHeader}>
        <Pressable onPress={onCollapse}><Text style={s.doneBtn}>Done</Text></Pressable>
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <FontAwesome name="trash-o" size={14} color={colors.accent.red} />
          </Pressable>
        )}
      </View>

      {/* Row 1: Reps x Distance + quick picks */}
      <View style={s.repsDistRow}>
        <TextInput
          style={[s.input, { width: 42, textAlign: "center" }]}
          value={line.reps}
          onChangeText={(v) => onUpdate({ reps: v })}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={colors.muted}
        />
        <Text style={s.x}>×</Text>
        <TextInput
          style={[s.input, { width: 56, textAlign: "center" }]}
          value={line.distance}
          onChangeText={(v) => onUpdate({ distance: v })}
          keyboardType="number-pad"
          placeholder="100"
          placeholderTextColor={colors.muted}
          autoFocus
        />
        <View style={s.inlineChips}>
          {[25, 50, 100, 200, 300, 500].map((d) => (
            <Pressable
              key={d}
              onPress={() => onUpdate({ distance: d.toString() })}
              style={[s.tinyChip, dist === d && s.chipActive]}
            >
              <Text style={[s.tinyChipText, dist === d && s.chipTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Row 2: Stroke */}
      <View style={s.tightRow}>
        {STROKES.map((st) => (
          <Pressable
            key={st.value}
            onPress={() => onUpdate({ stroke: st.value })}
            style={[s.tinyChip, line.stroke === st.value && s.chipActive]}
          >
            <Text style={[s.tinyChipText, line.stroke === st.value && s.chipTextActive]}>{st.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Row 3: Interval quick picks + custom */}
      {dist > 0 && (
        <View style={s.tightRow}>
          {OFFSETS.map((offset) => {
            const val = paceValue(dist, baseTime100, offset);
            const isActive = currentInterval === val;
            const label = offset === 0 ? "B" : offset > 0 ? `+${offset}` : `${offset}`;
            return (
              <Pressable
                key={offset}
                onPress={() => onUpdate({ interval: val.toString() })}
                style={[s.paceChip, isActive && s.chipActive]}
              >
                <Text style={[s.paceLabel, isActive && s.paceLabelActive]}>{label}</Text>
                <Text style={[s.paceTime, isActive && s.chipTextActive]}>{formatTime(val)}</Text>
              </Pressable>
            );
          })}
          <TimeInput
            value={currentInterval || null}
            onChange={(v) => onUpdate({ interval: v != null ? v.toString() : "" })}
          />
        </View>
      )}

      {/* More options toggle */}
      <Pressable onPress={() => setShowMore(!showMore)} style={s.moreToggle}>
        <Text style={s.moreToggleText}>{showMore ? "Less" : "More"}</Text>
        <FontAwesome name={showMore ? "chevron-up" : "chevron-down"} size={9} color={colors.muted} />
      </Pressable>

      {showMore && (
        <View>
          {/* Mode */}
          <Text style={s.sectionLabel}>MODE</Text>
          <View style={s.chipRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.value}
                onPress={() => onUpdate({ mode: m.value })}
                style={[s.chip, line.mode === m.value && s.modeChipActive]}
              >
                <Text style={[s.chipText, line.mode === m.value && s.chipTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Effort */}
          <Text style={s.sectionLabel}>EFFORT</Text>
          <View style={s.chipRow}>
            {EFFORTS.map((e) => (
              <Pressable
                key={e.value}
                onPress={() => onUpdate({ effort: line.effort === e.value ? "" : e.value })}
                style={[s.chip, line.effort === e.value && { backgroundColor: e.color }]}
              >
                <Text style={[s.chipText, line.effort === e.value && s.chipTextActive]}>{e.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Modifiers */}
          <Text style={s.sectionLabel}>MODIFIERS</Text>
          <View style={s.chipRow}>
            {MODIFIERS.map((m) => {
              const active = line.modifiers.includes(m.value);
              return (
                <Pressable
                  key={m.value}
                  onPress={() => onUpdate({ modifiers: toggleInArray(line.modifiers, m.value) })}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Equipment */}
          <Text style={s.sectionLabel}>EQUIPMENT</Text>
          <View style={s.chipRow}>
            {EQUIPMENT_OPTIONS.map((eq) => {
              const active = line.equipment.includes(eq.value);
              return (
                <Pressable
                  key={eq.value}
                  onPress={() => onUpdate({ equipment: toggleInArray(line.equipment, eq.value) })}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{eq.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Breathing */}
          <Text style={s.sectionLabel}>BREATHING</Text>
          <View style={s.chipRow}>
            <Pressable
              onPress={() => onUpdate({ breathing: null })}
              style={[s.chip, line.breathing == null && s.chipActive]}
            >
              <Text style={[s.chipText, line.breathing == null && s.chipTextActive]}>Normal</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate({ breathing: { type: "none" } })}
              style={[s.chip, line.breathing?.type === "none" && s.chipActive]}
            >
              <Text style={[s.chipText, line.breathing?.type === "none" && s.chipTextActive]}>No breath</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate({ breathing: { type: "every_n", value: line.breathing?.type === "every_n" ? line.breathing.value : 5 } })}
              style={[s.chip, line.breathing?.type === "every_n" && s.chipActive]}
            >
              <Text style={[s.chipText, line.breathing?.type === "every_n" && s.chipTextActive]}>Every N</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate({ breathing: { type: "limited", value: line.breathing?.type === "limited" ? line.breathing.value : 1 } })}
              style={[s.chip, line.breathing?.type === "limited" && s.chipActive]}
            >
              <Text style={[s.chipText, line.breathing?.type === "limited" && s.chipTextActive]}>Limited</Text>
            </Pressable>
          </View>
          {line.breathing?.type === "every_n" && (
            <View style={s.breathRow}>
              <Text style={s.breathLabel}>Breathe every</Text>
              <TextInput
                style={[s.input, { width: 42, textAlign: "center" }]}
                value={line.breathing.value?.toString() ?? ""}
                onChangeText={(v) => onUpdate({ breathing: { type: "every_n", value: parseInt(v) || undefined } })}
                keyboardType="number-pad"
              />
              <Text style={s.breathLabel}>strokes</Text>
            </View>
          )}
          {line.breathing?.type === "limited" && (
            <View style={s.breathRow}>
              <TextInput
                style={[s.input, { width: 42, textAlign: "center" }]}
                value={line.breathing.value?.toString() ?? ""}
                onChangeText={(v) => onUpdate({ breathing: { type: "limited", value: parseInt(v) || undefined } })}
                keyboardType="number-pad"
              />
              <Text style={s.breathLabel}>breath(s) per 25</Text>
            </View>
          )}

          {/* Targets */}
          <Text style={s.sectionLabel}>TARGETS</Text>
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

// === LINE ENTRY (dispatches collapsed vs expanded) ===
function LineEntry({
  line,
  baseTime100,
  isExpanded,
  onExpand,
  onCollapse,
  onUpdate,
  onRemove,
  canRemove,
}: {
  line: LineInput;
  baseTime100: number;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onUpdate: (u: Partial<LineInput>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  if (isExpanded) {
    return (
      <ExpandedLine
        line={line}
        baseTime100={baseTime100}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onCollapse={onCollapse}
        canRemove={canRemove}
      />
    );
  }
  return (
    <CollapsedLine
      line={line}
      onExpand={onExpand}
      onRemove={onRemove}
      canRemove={canRemove}
    />
  );
}

// === SET ENTRY ===
export default function SetEntry({
  set, index, baseTime100, expandedLineId, onExpandLine, onUpdate, onRemove, onMoveUp, onMoveDown, onOpenDetails, canRemove, isFirst, isLast,
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
    if (expandedLineId === lid) onExpandLine(null);
  }
  function addLine(gid: string) {
    const group = set.groups.find((g) => g.id === gid);
    if (!group) return;
    const newLine = createEmptyLine();
    updateGroup(gid, { lines: [...group.lines, newLine] });
    onExpandLine(newLine.id);
  }
  function addRestLine(gid: string) {
    const group = set.groups.find((g) => g.id === gid);
    if (!group) return;
    const newLine = createRestLine();
    updateGroup(gid, { lines: [...group.lines, newLine] });
    onExpandLine(newLine.id);
  }
  function addGroup() {
    const newGroup = createEmptyGroup();
    onUpdate({ groups: [...set.groups, newGroup] });
    onExpandLine(newGroup.lines[0].id);
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

            <View style={rounds > 1 ? s.bracketWrap : undefined}>
              {rounds > 1 && <View style={s.bracket} />}
              <View style={{ flex: 1 }}>
                {group.lines.map((line) => (
                  <LineEntry
                    key={line.id}
                    line={line}
                    baseTime100={baseTime100}
                    isExpanded={expandedLineId === line.id}
                    onExpand={() => onExpandLine(line.id)}
                    onCollapse={() => onExpandLine(null)}
                    onUpdate={(u) => updateLine(group.id, line.id, u)}
                    onRemove={() => removeLine(group.id, line.id)}
                    canRemove={group.lines.length > 1 || set.groups.length > 1}
                  />
                ))}
                <View style={s.addBtnsRow}>
                  <Pressable onPress={() => addLine(group.id)} style={s.addBtn}>
                    <Text style={s.addBtnText}>+ Line</Text>
                  </Pressable>
                  <Pressable onPress={() => addRestLine(group.id)} style={s.addBtn}>
                    <Text style={[s.addBtnText, { color: colors.muted }]}>+ Rest</Text>
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

// === STYLES ===
const s = StyleSheet.create({
  // Card
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

  // Groups
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

  // Collapsed line
  collapsedRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  collapsedLeft: { flexDirection: "row", alignItems: "center", flex: 1, flexWrap: "wrap" },
  collapsedRight: { flexDirection: "row", alignItems: "center" },
  collapsedText: { fontSize: 15, fontWeight: "700", color: colors.white },
  collapsedStroke: { fontWeight: "600", color: colors.swim[400] },
  collapsedMode: { fontWeight: "600", color: "#a78bfa" },
  collapsedInterval: { fontSize: 13, color: colors.muted, fontWeight: "500" },
  collapsedRemove: { marginLeft: 8 },
  collapsedTags: { flexDirection: "row", marginLeft: 8 },
  miniTag: {
    backgroundColor: colors.surfaceLight, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
    marginRight: 3,
  },
  miniTagText: { fontSize: 9, fontWeight: "600", color: colors.swim[400] },
  effortDotSmall: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  restText: { fontSize: 13, fontWeight: "600", color: colors.muted, fontStyle: "italic" },

  // Expanded line
  expandedCard: {
    backgroundColor: colors.surfaceLight, borderRadius: 14, padding: 12, marginVertical: 4,
  },
  expandedHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  doneBtn: { fontSize: 14, fontWeight: "700", color: colors.swim[500] },
  repsDistRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, flexWrap: "wrap" },
  input: {
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7,
    fontSize: 15, fontWeight: "600", color: colors.white,
  },
  x: { color: colors.muted, fontWeight: "700", marginHorizontal: 5, fontSize: 13 },
  inlineChips: { flexDirection: "row", marginLeft: 8, flexWrap: "wrap", flex: 1 },

  // Compact chip rows
  tightRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6, alignItems: "center" },
  effortIntervalRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6, alignItems: "center" },
  divider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 6 },
  tinyChip: {
    backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    marginRight: 4, marginBottom: 3,
  },
  tinyChipText: { fontSize: 11, fontWeight: "600", color: colors.muted },

  // Shared chips (for More section)
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: {
    backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4,
    marginRight: 4, marginBottom: 3,
  },
  chipActive: { backgroundColor: colors.swim[600] },
  chipText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: colors.white },
  modeChipActive: { backgroundColor: "#7c3aed" },

  // Pace
  paceChip: {
    backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    marginRight: 4, marginBottom: 3, alignItems: "center", minWidth: 38,
  },
  paceLabel: { fontSize: 8, fontWeight: "700", color: colors.muted },
  paceLabelActive: { color: "rgba(255,255,255,0.7)" },
  paceTime: { fontSize: 10, fontWeight: "700", color: colors.white, marginTop: 1 },

  // More options
  moreToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 4, marginTop: 2,
  },
  moreToggleText: { fontSize: 11, fontWeight: "600", color: colors.muted, marginRight: 6 },
  sectionLabel: {
    fontSize: 9, color: colors.muted, fontWeight: "700", letterSpacing: 1.2,
    marginBottom: 6, marginTop: 8,
  },

  // Breathing
  breathRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 4 },
  breathLabel: { fontSize: 12, color: colors.muted, marginHorizontal: 6 },

  // Rest
  restInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  restLabel: { color: colors.muted, fontSize: 13, marginLeft: 8 },

  // Targets
  targetsRow: { flexDirection: "row" },
  targetField: { flex: 1, marginRight: 8 },
  targetLabel: { fontSize: 9, color: colors.muted, fontWeight: "700", marginBottom: 4 },

  // Add buttons
  addBtnsRow: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 6 },
  addBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  addBtnText: { fontSize: 12, fontWeight: "600", color: colors.swim[400] },
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
