import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

const CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || "";
const CLIENT_SECRET = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET || "";
const API_BASE = "https://api.prod.whoop.com/developer/v1";
const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const REDIRECT_URI = "swimsy://auth/whoop";
const TOKENS_KEY = "swimsy_whoop_tokens";

const SCOPES = [
  "read:recovery",
  "read:sleep",
  "read:workout",
  "read:body_measurement",
  "read:profile",
];

interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface ZoneDurations {
  zone_zero_milli: number;   // rest
  zone_one_milli: number;    // light (50-60%)
  zone_two_milli: number;    // moderate (60-70%)
  zone_three_milli: number;  // hard (70-80%)
  zone_four_milli: number;   // very hard (80-90%)
  zone_five_milli: number;   // max (90-100%)
}

export interface ZoneBands {
  zone0Max: number;
  zone1Max: number;
  zone2Max: number;
  zone3Max: number;
  zone4Max: number;
  maxHR: number;
}

export interface WhoopDayData {
  recovery_score: number | null;
  hrv: number | null;
  resting_hr: number | null;
  strain_score: number | null;
  sleep_performance: number | null;
  sleep_total_milli: number | null;
  sleep_restorative_milli: number | null;
  workout_strain: number | null;
  workout_avg_hr: number | null;
  workout_max_hr: number | null;
  workout_calories: number | null;
  workout_duration_milli: number | null;
  workout_start: string | null;
  workout_end: string | null;
  zone_durations: ZoneDurations | null;
  zone_bands: ZoneBands | null;
}

async function getTokens(): Promise<WhoopTokens | null> {
  const raw = await AsyncStorage.getItem(TOKENS_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function saveTokens(tokens: WhoopTokens) {
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export async function isConnected(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens != null;
}

export async function disconnect(): Promise<void> {
  await AsyncStorage.removeItem(TOKENS_KEY);
}

async function getAccessToken(): Promise<string | null> {
  let tokens = await getTokens();
  if (!tokens) return null;

  if (Date.now() >= tokens.expires_at - 60000) {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`,
      });
      if (!res.ok) {
        await disconnect();
        return null;
      }
      const data = await res.json();
      tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      await saveTokens(tokens);
    } catch {
      return null;
    }
  }

  return tokens.access_token;
}

export async function authorize(): Promise<boolean> {
  try {
    console.log("Whoop redirect URI:", REDIRECT_URI);
    const scope = SCOPES.join(" ");
    const authUrl = `${AUTH_URL}?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&state=swimsy_auth_${Date.now()}`;
    console.log("Whoop auth URL:", authUrl);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
    console.log("Whoop auth result:", JSON.stringify(result));

    if (result.type !== "success" || !result.url) return false;

    const url = new URL(result.url);
    const code = url.searchParams.get("code");
    console.log("Whoop code:", code);
    if (!code) return false;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`,
    });

    console.log("Whoop token response:", res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.log("Whoop token error:", errText);
      return false;
    }

    const data = await res.json();
    await saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });

    return true;
  } catch {
    return false;
  }
}

async function apiGet(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getAccessToken();
  if (!token) return null;

  // Use v2 API
  for (const base of ["https://api.prod.whoop.com/developer/v2"]) {
    let url = `${base}${path}`;
    if (params) {
      const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      url += `?${qs}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`Whoop API ${base}${path}: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Whoop API ${path} data:`, JSON.stringify(data).slice(0, 300));
      return data;
    }
    const errText = await res.text();
    console.log(`Whoop API error: ${errText.slice(0, 200)}`);
  }

  return null;
}

export interface WhoopSwimSummary {
  date: string;
  strain: number;
  durationMinutes: number;
  calories: number;
  avgHr: number | null;
}

/**
 * Fetch all swim workouts from Whoop in a date range.
 * Paginates through results automatically.
 */
export async function getSwimWorkoutsInRange(
  startDate: Date,
  endDate: Date
): Promise<WhoopSwimSummary[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const results: WhoopSwimSummary[] = [];
  let nextToken: string | null = null;
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  do {
    const params: Record<string, string> = {
      start: startISO,
      end: endISO,
      limit: "25",
    };
    if (nextToken) params.nextToken = nextToken;

    const data = await apiGet("/activity/workout", params);
    if (!data?.records) break;

    console.log(`[Whoop Range] got ${data.records.length} workouts, next_token: ${data.next_token ?? "none"}`);
    for (const w of data.records) {
      // sport_id 33 = Swimming
      const isSwim = w.sport_id === 33 ||
        w.sport_name === "swimming" ||
        w.sport_name?.toLowerCase().includes("swim");
      if (!isSwim) continue;

      const start = w.start ? new Date(w.start) : null;
      const end = w.end ? new Date(w.end) : null;
      const dur = start && end ? (end.getTime() - start.getTime()) / 60000 : 0;

      results.push({
        date: start?.toISOString().slice(0, 10) || "",
        strain: w.score?.strain ?? 0,
        durationMinutes: Math.round(dur),
        calories: w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : 0,
        avgHr: w.score?.average_heart_rate ?? null,
      });
    }

    // Whoop API may use next_token or nextToken
    nextToken = data.next_token || data.nextToken || null;
  } while (nextToken);

  return results;
}

export async function getDataForDate(date: string): Promise<WhoopDayData | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const day = new Date(date);
  const startISO = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
  const endISO = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();
  console.log(`Whoop fetching data for: ${date} (${startISO} to ${endISO})`);

  const result: WhoopDayData = {
    recovery_score: null, hrv: null, resting_hr: null, strain_score: null,
    sleep_performance: null, sleep_total_milli: null, sleep_restorative_milli: null,
    workout_strain: null, workout_avg_hr: null, workout_max_hr: null, workout_calories: null,
    workout_duration_milli: null, workout_start: null, workout_end: null,
    zone_durations: null, zone_bands: null,
  };

  try {
    // Recovery - try both collection and direct endpoints
    // Recovery: fetch from the night before through morning of workout day
    // Whoop scores recovery when you wake up, so the cycle starts the previous evening
    const recoveryStart = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 12).toISOString();
    const recovery = await apiGet("/recovery", { start: recoveryStart, end: startISO, limit: "1" });
    if (recovery?.records?.[0]?.score) {
      const r = recovery.records[0].score;
      result.recovery_score = r?.recovery_score ?? null;
      result.hrv = r?.hrv_rmssd_milli ?? null;
      result.resting_hr = r?.resting_heart_rate ?? null;
    }

    // Sleep
    // Sleep: the night before the workout (went to bed previous evening, woke up morning of workout)
    const sleepStart = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 18).toISOString();
    const sleepEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
    const sleep = await apiGet("/activity/sleep", { start: sleepStart, end: sleepEnd, limit: "1" });
    if (sleep?.records?.[0]?.score) {
      const sl = sleep.records[0].score;
      result.sleep_performance = sl?.sleep_performance_percentage ?? null;
      const ss = sl?.stage_summary;
      if (ss) {
        const inBed = ss.total_in_bed_time_milli || 0;
        const awake = ss.total_awake_time_milli || 0;
        result.sleep_total_milli = inBed - awake;
        // Restorative = SWS (deep) + REM
        const sws = ss.total_slow_wave_sleep_time_milli || 0;
        const rem = ss.total_rem_sleep_time_milli || 0;
        result.sleep_restorative_milli = sws + rem;
      }
    }

    // Workout
    const workouts = await apiGet("/activity/workout", { start: startISO, end: endISO, limit: "10" });
    if (workouts?.records) {
      // sport_id 33 = Swimming
      console.log("Whoop workouts:", workouts.records.map((w: any) => `${w.sport_name} (${w.sport_id})`));
      const swim = workouts.records.find((w: any) =>
        w.sport_id === 33 || w.sport_name === "swimming" || w.sport_name?.toLowerCase().includes("swim")
      ) || workouts.records[0];
      if (swim) {
        result.workout_start = swim.start || null;
        result.workout_end = swim.end || null;
        if (swim.start && swim.end) {
          result.workout_duration_milli = new Date(swim.end).getTime() - new Date(swim.start).getTime();
        }
        result.workout_strain = swim.score?.strain ?? null;
        result.workout_avg_hr = swim.score?.average_heart_rate ?? null;
        result.workout_max_hr = swim.score?.max_heart_rate ?? null;
        result.workout_calories = swim.score?.kilojoule ? Math.round(swim.score.kilojoule / 4.184) : null;
        if (swim.score.zone_durations) {
          result.zone_durations = swim.score.zone_durations;
        }
      }
    }
    // Body measurement for max HR → zone bands
    // Try both singular and plural endpoints
    let body = await apiGet("/body_measurement", { limit: "1" });
    if (!body) body = await apiGet("/body_measurements", { limit: "1" });
    if (!body) body = await apiGet("/user/body_measurement", { limit: "1" });
    console.log("Whoop body:", JSON.stringify(body).slice(0, 300));
    let maxHR = 200; // default
    if (body?.records?.[0]?.max_heart_rate) {
      maxHR = body.records[0].max_heart_rate;
    }
    // Whoop zones: 0=<50%, 1=50-60%, 2=60-70%, 3=70-80%, 4=80-90%, 5=90-100%
    result.zone_bands = {
      zone0Max: Math.round(maxHR * 0.5),
      zone1Max: Math.round(maxHR * 0.6),
      zone2Max: Math.round(maxHR * 0.7),
      zone3Max: Math.round(maxHR * 0.8),
      zone4Max: Math.round(maxHR * 0.9),
      maxHR,
    };
  } catch (e) {
    console.log("Whoop data fetch error:", e);
  }

  return result;
}
