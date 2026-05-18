export type PoolUnit = 'yards' | 'meters';

export type Stroke = 'free' | 'back' | 'breast' | 'fly' | 'IM' | 'kick' | 'drill' | 'mixed';

export type Effort = 'easy' | 'moderate' | 'fast' | 'sprint';

export interface Segment {
  distance: number;
  effort: Effort;
  stroke: Stroke;
}

export interface RepDetail {
  interval: number | null;
  segments: Segment[];
}

export interface SetLine {
  id: string;
  reps: number;
  distance: number;
  stroke: Stroke;
  interval_seconds: number | null;
}

export interface SetGroup {
  id: string;
  rounds: number;
  lines: SetLine[];
}

export interface SwimSet {
  id: string;
  order_index: number;
  groups: SetGroup[];
  rep_details: RepDetail[];
  description: string | null;
  // legacy flat fields for migration
  reps?: number;
  distance?: number;
  stroke?: Stroke;
  interval_seconds?: number | null;
}

export type BenchmarkType = 'test_set' | 'time_trial' | 'custom';

export interface Benchmark {
  id: string;
  type: BenchmarkType;
  name: string;
  reps: number | null;
  distance: number | null;
  stroke: Stroke | null;
  interval_seconds: number | null;
  avg_pace_per_100: number | null;
  total_time_seconds: number | null;
  value: number | null;
  unit: string | null;
  notes: string | null;
}

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  total_yards: number;
  pool_length: number;
  pool_unit: PoolUnit;
  feeling_score: number;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  sets?: SwimSet[];
  benchmarks?: Benchmark[];
  photos?: string[];          // local file URIs of workout board photos
  ocrText?: string | null;    // raw OCR text extracted from photos
}
