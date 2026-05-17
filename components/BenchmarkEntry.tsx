import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Stroke, BenchmarkType } from "../lib/types";
import { colors } from "../lib/theme";
import TimeInput from "./TimeInput";

const TYPES: { label: string; value: BenchmarkType }[] = [
  { label: "Test Set", value: "test_set" },
  { label: "Time Trial", value: "time_trial" },
  { label: "Custom", value: "custom" },
];

const STROKES: { label: string; value: Stroke }[] = [
  { label: "Fr", value: "free" },
  { label: "Bk", value: "back" },
  { label: "Br", value: "breast" },
  { label: "Fl", value: "fly" },
  { label: "IM", value: "IM" },
];

export interface BenchmarkInput {
  id: string;
  type: BenchmarkType;
  name: string;
  reps: string;
  distance: string;
  stroke: Stroke;
  interval: string;
  avgPace: string;
  totalTime: string;
  value: string;
  unit: string;
  notes: string;
}

export function createEmptyBenchmark(): BenchmarkInput {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    type: "test_set",
    name: "",
    reps: "",
    distance: "100",
    stroke: "free",
    interval: "",
    avgPace: "",
    totalTime: "",
    value: "",
    unit: "",
    notes: "",
  };
}

interface Props {
  benchmark: BenchmarkInput;
  onUpdate: (u: Partial<BenchmarkInput>) => void;
  onRemove: () => void;
}

export default function BenchmarkEntry({ benchmark: b, onUpdate, onRemove }: Props) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.label}>BENCHMARK</Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <FontAwesome name="times" size={14} color={colors.accent.red} />
        </Pressable>
      </View>

      {/* Type */}
      <View style={s.typeRow}>
        {TYPES.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => onUpdate({ type: t.value })}
            style={[s.typeChip, b.type === t.value && s.typeChipActive]}
          >
            <Text style={[s.typeText, b.type === t.value && s.typeTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Name */}
      <TextInput
        style={s.nameInput}
        value={b.name}
        onChangeText={(v) => onUpdate({ name: v })}
        placeholder={
          b.type === "test_set" ? "e.g., 10x100 free" :
          b.type === "time_trial" ? "e.g., 200 free TT" : "e.g., SWOLF, stroke count"
        }
        placeholderTextColor={colors.muted}
      />

      {/* Test Set fields */}
      {b.type === "test_set" && (
        <View>
          <View style={s.row}>
            <View style={s.fieldCol}>
              <Text style={s.fieldLabel}>REPS</Text>
              <TextInput
                style={s.fieldInput}
                value={b.reps}
                onChangeText={(v) => onUpdate({ reps: v })}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[s.fieldCol, { marginHorizontal: 8 }]}>
              <Text style={s.fieldLabel}>DISTANCE</Text>
              <TextInput
                style={s.fieldInput}
                value={b.distance}
                onChangeText={(v) => onUpdate({ distance: v })}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={s.fieldCol}>
              <Text style={s.fieldLabel}>INTERVAL</Text>
              <TimeInput
                value={b.interval ? parseInt(b.interval) : null}
                onChange={(v) => onUpdate({ interval: v != null ? v.toString() : "" })}
                style={s.fieldInput}
              />
            </View>
          </View>
          <View style={s.strokeRow}>
            {STROKES.map((st) => (
              <Pressable
                key={st.value}
                onPress={() => onUpdate({ stroke: st.value })}
                style={[s.strokeChip, b.stroke === st.value && s.strokeActive]}
              >
                <Text style={[s.strokeText, b.stroke === st.value && s.strokeTextActive]}>{st.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.row}>
            <View style={s.fieldCol}>
              <Text style={s.fieldLabel}>AVG PACE /100</Text>
              <TimeInput
                value={b.avgPace ? parseInt(b.avgPace) : null}
                onChange={(v) => onUpdate({ avgPace: v != null ? v.toString() : "" })}
                style={s.fieldInput}
              />
            </View>
          </View>
        </View>
      )}

      {/* Time Trial fields */}
      {b.type === "time_trial" && (
        <View>
          <View style={s.row}>
            <View style={s.fieldCol}>
              <Text style={s.fieldLabel}>DISTANCE</Text>
              <TextInput
                style={s.fieldInput}
                value={b.distance}
                onChangeText={(v) => onUpdate({ distance: v })}
                keyboardType="number-pad"
                placeholder="200"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[s.fieldCol, { marginLeft: 8 }]}>
              <Text style={s.fieldLabel}>TOTAL TIME</Text>
              <TimeInput
                value={b.totalTime ? parseInt(b.totalTime) : null}
                onChange={(v) => onUpdate({ totalTime: v != null ? v.toString() : "" })}
                style={s.fieldInput}
              />
            </View>
          </View>
          <View style={s.strokeRow}>
            {STROKES.map((st) => (
              <Pressable
                key={st.value}
                onPress={() => onUpdate({ stroke: st.value })}
                style={[s.strokeChip, b.stroke === st.value && s.strokeActive]}
              >
                <Text style={[s.strokeText, b.stroke === st.value && s.strokeTextActive]}>{st.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Custom fields */}
      {b.type === "custom" && (
        <View style={s.row}>
          <View style={s.fieldCol}>
            <Text style={s.fieldLabel}>VALUE</Text>
            <TextInput
              style={s.fieldInput}
              value={b.value}
              onChangeText={(v) => onUpdate({ value: v })}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={[s.fieldCol, { marginLeft: 8 }]}>
            <Text style={s.fieldLabel}>UNIT</Text>
            <TextInput
              style={s.fieldInput}
              value={b.unit}
              onChangeText={(v) => onUpdate({ unit: v })}
              placeholder="e.g., count, score"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
      )}

      {/* Notes */}
      <TextInput
        style={s.notesInput}
        value={b.notes}
        onChangeText={(v) => onUpdate({ notes: v })}
        placeholder="Notes"
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  label: { fontSize: 10, color: colors.accent.yellow, fontWeight: "700", letterSpacing: 1.5 },
  typeRow: { flexDirection: "row", marginBottom: 10 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: colors.surfaceLight, marginRight: 6,
  },
  typeChipActive: { backgroundColor: colors.accent.yellow },
  typeText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  typeTextActive: { color: colors.bg },
  nameInput: {
    backgroundColor: colors.surfaceLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontWeight: "600", color: colors.white, marginBottom: 10,
  },
  row: { flexDirection: "row", marginBottom: 10 },
  fieldCol: { flex: 1 },
  fieldLabel: { fontSize: 9, color: colors.muted, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  fieldInput: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, fontWeight: "600", color: colors.white, textAlign: "center",
  },
  strokeRow: { flexDirection: "row", marginBottom: 10 },
  strokeChip: {
    backgroundColor: colors.surfaceLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    marginRight: 5,
  },
  strokeActive: { backgroundColor: colors.swim[600] },
  strokeText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  strokeTextActive: { color: colors.white },
  notesInput: {
    backgroundColor: colors.surfaceLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: colors.white,
  },
});
