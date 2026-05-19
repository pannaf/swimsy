import { NativeModules, Platform } from "react-native";

console.log("NativeModules available:", Object.keys(NativeModules).filter(k => k.includes("Health") || k.includes("Workout")).join(", ") || "none");
const { HealthKitBridge } = NativeModules;
console.log("HealthKitBridge:", HealthKitBridge ? "loaded" : "null");

export interface HealthSwimData {
  startDate: string;
  endDate: string;
  distance: number;
  calories: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  vo2Max: number | null;
  sleepHours: number | null;
  duration: number | null;
  totalStrokes: number | null;
  lapCount: number | null;
  poolLengthYards: number | null;
  swolf: number | null;
  strokeBreakdown: Record<string, number> | null;
}

export function isAvailable(): boolean {
  const available = Platform.OS === "ios" && HealthKitBridge != null;
  console.log("HealthKit available:", available, "Bridge:", HealthKitBridge != null);
  return available;
}

export async function requestPermissions(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const result = await HealthKitBridge.requestPermissions();
    console.log("HealthKit permissions result:", result);
    return result;
  } catch (e) {
    console.log("HealthKit permissions error:", e);
    return false;
  }
}

export async function getSwimDataForDate(date: string): Promise<HealthSwimData | null> {
  if (!isAvailable()) return null;
  try {
    console.log("HealthKit fetching swim data for:", date);
    const data = await HealthKitBridge.getSwimDataForDate(date);
    console.log("HealthKit swim data:", JSON.stringify(data).slice(0, 300));
    if (!data || typeof data !== "object") return null;
    return {
      startDate: data.startDate || date,
      endDate: data.endDate || date,
      distance: data.distance || 0,
      calories: data.calories || 0,
      avgHeartRate: data.avgHeartRate ?? null,
      maxHeartRate: data.maxHeartRate ?? null,
      restingHeartRate: data.restingHeartRate ?? null,
      hrv: data.hrv ?? null,
      vo2Max: data.vo2Max ?? null,
      sleepHours: data.sleepHours ?? null,
      duration: data.duration ?? null,
      totalStrokes: data.totalStrokes ?? null,
      lapCount: data.lapCount ?? null,
      poolLengthYards: data.poolLengthYards ?? null,
      swolf: data.swolf ?? null,
      strokeBreakdown: data.strokeBreakdown ?? null,
    };
  } catch {
    return null;
  }
}
