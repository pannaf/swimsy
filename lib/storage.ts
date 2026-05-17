import AsyncStorage from "@react-native-async-storage/async-storage";
import { Workout, SwimSet, PoolUnit } from "./types";

const WORKOUTS_KEY = "swimsy_workouts";
const SETTINGS_KEY = "swimsy_settings";

export interface UserSettings {
  defaultPoolLength: number;
  defaultPoolUnit: PoolUnit;
  baseTime100: number; // seconds for 100 at base pace
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultPoolLength: 25,
  defaultPoolUnit: "yards",
  baseTime100: 90,
};

export async function getSettings(): Promise<UserSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface StoredWorkout extends Workout {
  sets: SwimSet[];
}

async function getAll(): Promise<StoredWorkout[]> {
  const raw = await AsyncStorage.getItem(WORKOUTS_KEY);
  if (!raw) return [];
  const data = JSON.parse(raw) as StoredWorkout[];
  // Migrate old sets to lines-based format
  return data.map((w) => ({
    ...w,
    sets: w.sets.map((s: any) => {
      if (s.groups) return s;
      // Migrate from lines-based to groups-based
      if (s.lines) return {
        id: s.id,
        order_index: s.order_index,
        groups: [{ id: s.id + "_g0", rounds: s.rounds || 1, lines: s.lines }],
        rep_details: s.rep_details || [],
        description: s.description,
      };
      // Migrate from parts-based format
      if (s.parts) {
        return {
          id: s.id,
          order_index: s.order_index,
          lines: s.parts.map((p: any) => ({
            id: p.id,
            reps: p.reps,
            distance: p.distance,
            stroke: p.stroke,
            interval_seconds: p.interval_seconds,
          })),
          rep_details: [],
          description: s.description,
        };
      }
      // Migrate from flat format
      return {
        id: s.id,
        order_index: s.order_index,
        lines: [{
          id: s.id + "_l0",
          reps: s.reps || 1,
          distance: s.distance || 0,
          stroke: s.stroke || "free",
          interval_seconds: s.interval_seconds || null,
        }],
        rep_details: s.rep_details || [],
        description: s.description,
      };
    }),
  }));
}

async function save(workouts: StoredWorkout[]) {
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}

export async function getWorkouts(): Promise<StoredWorkout[]> {
  const workouts = await getAll();
  return workouts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getWorkout(id: string): Promise<StoredWorkout | null> {
  const workouts = await getAll();
  return workouts.find((w) => w.id === id) || null;
}

export async function saveWorkout(
  workout: Omit<StoredWorkout, "id" | "created_at" | "user_id">
): Promise<StoredWorkout> {
  const workouts = await getAll();
  const newWorkout: StoredWorkout = {
    ...workout,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    user_id: "local",
    created_at: new Date().toISOString(),
  };
  workouts.push(newWorkout);
  await save(workouts);
  return newWorkout;
}

export async function updateWorkout(id: string, updates: Partial<StoredWorkout>): Promise<StoredWorkout | null> {
  const workouts = await getAll();
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  workouts[idx] = { ...workouts[idx], ...updates };
  await save(workouts);
  return workouts[idx];
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await getAll();
  await save(workouts.filter((w) => w.id !== id));
}
