import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

interface Props {
  value: number;
  onChange: (value: number) => void;
}

const LABELS: Record<number, string> = {
  1: "Terrible",
  2: "Very Bad",
  3: "Bad",
  4: "Below Avg",
  5: "Average",
  6: "Above Avg",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Perfect",
};

function getColor(n: number) {
  if (n <= 3) return colors.accent.red;
  if (n <= 5) return colors.accent.yellow;
  if (n <= 7) return colors.swim[500];
  return colors.accent.green;
}

export default function FeelingSlider({ value, onChange }: Props) {
  return (
    <View>
      <View style={s.header}>
        <Text style={s.label}>HOW DID IT FEEL?</Text>
        <Text style={[s.feeling, { color: getColor(value) }]}>{LABELS[value]}</Text>
      </View>
      <View style={s.row}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = n === value;
          const filled = n <= value;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[
                s.dot,
                filled && !selected && s.dotFilled,
                selected && { backgroundColor: getColor(value) },
              ]}
            >
              <Text style={[s.dotText, (selected || filled) && s.dotTextActive]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.5 },
  feeling: { fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  dotFilled: { backgroundColor: colors.surfaceLight },
  dotText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  dotTextActive: { color: colors.white },
});
