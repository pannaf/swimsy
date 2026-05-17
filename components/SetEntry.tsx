import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Stroke } from "../lib/types";
import { colors } from "../lib/theme";
import TimeInput from "./TimeInput";

const STROKES: { label: string; value: Stroke }[] = [
  { label: "Fr", value: "free" },
  { label: "Bk", value: "back" },
  { label: "Br", value: "breast" },
  { label: "Fl", value: "fly" },
  { label: "IM", value: "IM" },
  { label: "Kk", value: "kick" },
  { label: "Dr", value: "drill" },
  { label: "Mx", value: "mixed" },
];

const OFFSETS = [-10, -5, 0, 5, 10, 15, 20];

export interface LineInput {
  id: string;
  reps: string;
  distance: string;
  stroke: Stroke;
  interval: string;
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
    reps: "1",
    distance: "100",
    stroke: "free",
    interval: "",
  };
}

export function createEmptyGroup(): GroupInput {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    rounds: "1",
    lines: [createEmptyLine()],
  };
}

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
  const dist = parseInt(line.distance) || 0;
  const currentInterval = line.interval ? parseInt(line.interval) : 0;

  return (
    <View style={s.lineCard}>
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, { width: 48, textAlign: "center" }]}
          value={line.reps}
          onChangeText={(v) => onUpdate({ reps: v })}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={colors.muted}
        />
        <Text style={s.x}>x</Text>
        <TextInput
          style={[s.input, { width: 64, textAlign: "center" }]}
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
      </View>

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
    </View>
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
    const groupYards = g.lines.reduce(
      (ls, l) => ls + (parseInt(l.reps) || 0) * (parseInt(l.distance) || 0), 0
    );
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
                <Pressable onPress={() => addLine(group.id)} style={s.addLineBtn}>
                  <Text style={s.addLineText}>+ Add Line</Text>
                </Pressable>
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
  x: { color: colors.muted, fontWeight: "700", marginHorizontal: 8, fontSize: 14 },
  distChips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  distChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 5,
    marginRight: 5, marginBottom: 4,
  },
  distChipActive: { backgroundColor: colors.swim[600] },
  distText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  distTextActive: { color: colors.white },
  strokes: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  strokeChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    marginRight: 4, marginBottom: 4,
  },
  strokeActive: { backgroundColor: colors.swim[600] },
  strokeText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  strokeTextActive: { color: colors.white },
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
  addLineBtn: { paddingVertical: 6, alignItems: "center" },
  addLineText: { fontSize: 12, fontWeight: "600", color: colors.muted },
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
