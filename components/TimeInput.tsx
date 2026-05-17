import { TextInput, StyleSheet } from "react-native";
import { useState, useEffect, useRef } from "react";
import { colors } from "../lib/theme";

interface Props {
  value: number | null;
  onChange: (seconds: number | null) => void;
  style?: object;
}

function secondsToDisplay(sec: number | null): string {
  if (sec == null || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;

  if (t.includes(":")) {
    const [mStr, sStr] = t.split(":");
    const m = parseInt(mStr) || 0;
    const s = parseInt(sStr) || 0;
    return m * 60 + s;
  }

  const n = parseInt(t);
  if (isNaN(n)) return null;
  // 3+ digit number without colon: treat as m:ss (e.g. 135 → 1:35)
  if (n >= 100) {
    const s = n % 100;
    const m = Math.floor(n / 100);
    return m * 60 + s;
  }
  // 1-2 digit: treat as seconds
  return n;
}

export default function TimeInput({ value, onChange, style }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const prevValue = useRef(value);

  // Sync display when value changes externally (chip tap)
  useEffect(() => {
    if (!focused && value !== prevValue.current) {
      setText(secondsToDisplay(value));
      prevValue.current = value;
    }
  }, [value, focused]);

  function handleFocus() {
    setFocused(true);
    setText(secondsToDisplay(value));
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseTime(text);
    onChange(parsed);
    prevValue.current = parsed;
    setText(secondsToDisplay(parsed));
  }

  return (
    <TextInput
      style={[s.input, style]}
      value={focused ? text : secondsToDisplay(value)}
      onChangeText={setText}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder=":00"
      placeholderTextColor={colors.muted}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      selectTextOnFocus
    />
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    width: 56,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
  },
});
