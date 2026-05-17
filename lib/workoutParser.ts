import { NativeModules, Platform } from "react-native";

const { WorkoutParser } = NativeModules;

export interface ParsedLine {
  reps: number;
  distance: number;
  stroke: string;
  interval_seconds: number | null;
}

export interface ParsedSet {
  rounds?: number;
  lines: ParsedLine[];
}

export interface ParseResult {
  method: string;
  sets: ParsedSet[];
  llmRaw?: string;
}

export function isParserAvailable(): boolean {
  return Platform.OS === "ios" && WorkoutParser != null;
}

export async function extractTextFromImage(imageUri: string): Promise<string> {
  if (!isParserAvailable()) throw new Error("Parser not available");
  return WorkoutParser.extractText(imageUri);
}

export async function parseWorkoutText(text: string): Promise<ParseResult> {
  if (!isParserAvailable()) return { method: "unavailable", sets: [] };
  const response = await WorkoutParser.parseWorkoutText(text);

  // Native returns { method, result, llmRaw? }
  const method = response?.method || "unknown";
  const llmRaw = response?.llmRaw || undefined;
  const jsonStr = response?.result || "[]";

  let sets: ParsedSet[] = [];
  try {
    sets = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
  } catch {}

  return { method, sets, llmRaw };
}
