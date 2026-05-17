import { NativeModules, Platform } from "react-native";

const { HealthKitBridge } = NativeModules;

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
}

export function isAvailable(): boolean {
  return Platform.OS === "ios" && HealthKitBridge != null;
}

export async function requestPermissions(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    return await HealthKitBridge.requestPermissions();
  } catch {
    return false;
  }
}

export async function getSwimDataForDate(date: string): Promise<HealthSwimData | null> {
  if (!isAvailable()) return null;
  try {
    const data = await HealthKitBridge.getSwimDataForDate(date);
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
    };
  } catch {
    return null;
  }
}
