export type PoolUnit = 'yards' | 'meters';

export type Stroke = 'free' | 'back' | 'breast' | 'fly' | 'IM' | 'mixed' | 'choice'
  | 'kick' | 'drill';  // deprecated: use Mode instead. kept for existing workout compat
export type Mode = 'swim' | 'kick' | 'drill' | 'pull' | 'scull';
export type Effort = 'easy' | 'moderate' | 'fast' | 'sprint';
export type LineModifier = 'build' | 'descend' | 'ascend' | 'negative_split' | 'positive_split' | 'broken';
export type Equipment = 'fins' | 'paddles' | 'buoy' | 'kickboard' | 'snorkel' | 'band';
export type IntervalType = 'fixed' | 'base' | 'rest';
export type BenchmarkType = 'test_set' | 'time_trial' | 'custom';

export interface BreathControl {
  type: 'none' | 'every_n' | 'limited';
  value?: number;  // every_n: breathe every N strokes, limited: N breaths per 25, none: no breath
}

export interface Targets {
  stroke_count?: number;     // "holding 14 strokes"
  dps?: number;              // distance per stroke in yards/meters
  tempo_seconds?: number;    // seconds per stroke cycle (what tempo trainers measure)
}

// Variations cycle by rep position: rep i uses cycle[i % total_cycle_length].
// A cycle entry with count=3 occupies 3 positions.
// If both RepPattern and RepDetail exist for a rep, RepDetail wins.
export interface RepPattern {
  cycle: Array<{
    count?: number;            // consecutive reps using this variation (default 1)
    stroke?: Stroke;
    mode?: Mode;
    effort?: Effort;
    equipment?: Equipment[];
    breathing?: BreathControl;
  }>;
}

export interface Segment {
  distance: number;
  effort: Effort;
  stroke: Stroke;
  mode?: Mode;
  equipment?: Equipment[];
  breathing?: BreathControl;
}

export interface RepDetail {
  interval: number | null;
  segments: Segment[];
}

export interface RepActual {
  time_seconds: number;
  rest_seconds?: number;
}

// Discriminated union: work lines vs rest lines
export interface WorkLine {
  kind: 'work';
  id: string;
  reps: number;
  distance: number;
  stroke: Stroke;
  mode?: Mode;
  effort?: Effort;
  interval_seconds: number | null;
  interval_type?: IntervalType;
  base_offset?: number;
  modifiers?: LineModifier[];
  equipment?: Equipment[];
  breathing?: BreathControl;
  targets?: Targets;
  rep_pattern?: RepPattern;
  actuals?: RepActual[];
}

export interface RestLine {
  kind: 'rest';
  id: string;
  rest_seconds: number;
}

export type SetLine = WorkLine | RestLine;

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
  base_time_100: number | null;  // base pace used for this workout (seconds per 100)
  lane: string | null;           // lane number or name
  coach: string | null;          // coach name
  created_at: string;
  sets?: SwimSet[];
  benchmarks?: Benchmark[];
  photos?: string[];
  ocrText?: string | null;
}
