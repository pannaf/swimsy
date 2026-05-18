import {
  View, Text, ScrollView, TextInput, Pressable, Alert, Modal,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from "react-native";
import { useState, useCallback, useEffect } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { saveWorkout, getWorkout, updateWorkout, getSettings, StoredWorkout } from "../../lib/storage";
import { RepDetail } from "../../lib/types";
import { colors } from "../../lib/theme";
import SetEntry, { SetInput, createEmptyGroup, createEmptyLine, GroupInput, LineInput } from "../../components/SetEntry";
import RepDetailModal, { LineInfo } from "../../components/RepDetailModal";
import FeelingSlider from "../../components/FeelingSlider";
import BenchmarkEntry, { BenchmarkInput, createEmptyBenchmark } from "../../components/BenchmarkEntry";
import DateTimePicker from "@react-native-community/datetimepicker";
import { isParserAvailable, extractTextFromImage, parseWorkoutText } from "../../lib/workoutParser";

const POOL_OPTIONS = [
  { label: "25 yd", length: 25, unit: "yards" as const },
  { label: "25 m", length: 25, unit: "meters" as const },
  { label: "50 m", length: 50, unit: "meters" as const },
  { label: "50 yd", length: 50, unit: "yards" as const },
];

function createEmptySet(): SetInput {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    groups: [createEmptyGroup()],
    description: "",
    hasDetails: false,
  };
}

type RepDetailsMap = Record<string, RepDetail[]>;

export default function LogSwim() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [poolIndex, setPoolIndex] = useState(0);
  const [swimDate, setSwimDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sets, setSets] = useState<SetInput[]>([createEmptySet()]);
  const [repDetailsMap, setRepDetailsMap] = useState<RepDetailsMap>({});
  const [benchmarks, setBenchmarks] = useState<BenchmarkInput[]>([]);
  const [workoutPhotos, setWorkoutPhotos] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [feelingScore, setFeelingScore] = useState(5);
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [quickMode, setQuickMode] = useState(false);
  const [quickYards, setQuickYards] = useState("");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [baseTime, setBaseTime] = useState(90);
  const [modalSetId, setModalSetId] = useState<string | null>(null);

  // Load settings
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const settings = await getSettings();
        setBaseTime(settings.baseTime100);
        if (!editId) {
          const idx = POOL_OPTIONS.findIndex(
            (p) => p.length === settings.defaultPoolLength && p.unit === settings.defaultPoolUnit
          );
          if (idx >= 0) setPoolIndex(idx);
        }
      })();
    }, [])
  );

  // Load workout for editing
  useEffect(() => {
    if (!editId || editId === editingWorkoutId) return;
    (async () => {
      const w = await getWorkout(editId);
      if (!w) return;
      setEditingWorkoutId(w.id);
      setSwimDate(new Date(w.date));
      setFeelingScore(w.feeling_score ?? 5);
      setNotes(w.notes ?? "");
      setDuration(w.duration_minutes != null ? w.duration_minutes.toString() : "");
      const poolIdx = POOL_OPTIONS.findIndex(
        (p) => p.length === w.pool_length && p.unit === w.pool_unit
      );
      if (poolIdx >= 0) setPoolIndex(poolIdx);

      // Convert stored sets to SetInput format
      const loadedSets: SetInput[] = (w.sets || []).map((s) => ({
        id: s.id,
        groups: (s.groups || []).map((g) => ({
          id: g.id,
          rounds: String(g.rounds || 1),
          lines: g.lines.map((l): LineInput => {
            if (l.kind === "rest") {
              return {
                ...createEmptyLine(),
                id: l.id,
                kind: "rest",
                rest_seconds: String(l.rest_seconds),
              };
            }
            return {
              ...createEmptyLine(),
              id: l.id,
              kind: "work",
              reps: String(l.reps),
              distance: String(l.distance),
              stroke: l.stroke,
              mode: l.mode || "swim",
              effort: l.effort || "",
              interval: l.interval_seconds != null ? String(l.interval_seconds) : "",
              interval_type: l.interval_type || "fixed",
              base_offset: l.base_offset || 0,
              modifiers: l.modifiers || [],
              equipment: l.equipment || [],
              breathing: l.breathing || null,
              targets: l.targets || null,
            };
          }),
        })),
        description: s.description || "",
        hasDetails: (s.rep_details || []).length > 0,
      }));
      setSets(loadedSets.length > 0 ? loadedSets : [createEmptySet()]);

      // Load rep details
      const rdMap: RepDetailsMap = {};
      for (const s of w.sets || []) {
        if (s.rep_details && s.rep_details.length > 0) {
          rdMap[s.id] = s.rep_details;
        }
      }
      setRepDetailsMap(rdMap);

      // Load photos
      setWorkoutPhotos(w.photos || []);
      setOcrText(w.ocrText || null);

      // Load benchmarks
      if (w.benchmarks && w.benchmarks.length > 0) {
        setBenchmarks(w.benchmarks.map((bm) => ({
          id: bm.id,
          type: bm.type,
          name: bm.name,
          reps: bm.reps != null ? String(bm.reps) : "",
          distance: bm.distance != null ? String(bm.distance) : "",
          stroke: bm.stroke || "free",
          interval: bm.interval_seconds != null ? String(bm.interval_seconds) : "",
          avgPace: bm.avg_pace_per_100 != null ? String(bm.avg_pace_per_100) : "",
          totalTime: bm.total_time_seconds != null ? String(bm.total_time_seconds) : "",
          value: bm.value != null ? String(bm.value) : "",
          unit: bm.unit || "",
          notes: bm.notes || "",
        })));
      }
    })();
  }, [editId]);

  async function handlePhotoImport() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await parsePhoto(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not open photo library");
    }
  }

  async function handleCameraCapture() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera access needed", "Please enable camera in Settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await parsePhoto(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not open camera");
    }
  }

  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDescribe, setShowDescribe] = useState(false);
  const [describeText, setDescribeText] = useState("");

  function addLog(msg: string) {
    setDebugLog((prev) => [...prev, msg]);
  }

  async function parseDescription() {
    if (!describeText.trim()) return;
    if (!isParserAvailable()) {
      Alert.alert("Rebuild Required", "Parsing needs a native build. Run: npx expo run:ios --device");
      return;
    }
    setShowDescribe(false);
    setParsing(true);
    setDebugLog([]);
    try {
      addLog(`1. Input text:\n${describeText}`);
      addLog("2. Sending to parser...");
      const result = await parseWorkoutText(describeText);
      addLog(`3. Method: ${result.method}`);
      if (result.llmRaw) {
        addLog(`4. LLM raw:\n${result.llmRaw.slice(0, 500)}`);
      }
      addLog(`5. Parsed JSON:\n${JSON.stringify(result.sets, null, 2).slice(0, 500)}`);

      const parsed = result.sets;
      addLog(`6. Found ${parsed.length} set(s)`);

      if (parsed.length === 0) {
        addLog("FAILED: No sets parsed");
        setParsing(false);
        return;
      }

      // Expand any line where distance contains "+" (e.g., "25+50+75" → 3 lines)
      function expandLines(lines: any[]): any[] {
        const result: any[] = [];
        for (const l of lines) {
          const distStr = String(l.distance || "");
          if (distStr.includes("+")) {
            const parts = distStr.split("+").map((s: string) => parseInt(s.trim())).filter((n: number) => n > 0);
            for (const d of parts) {
              result.push({ ...l, distance: d, reps: l.reps || 1 });
            }
          } else {
            result.push(l);
          }
        }
        return result;
      }

      // If a group has rounds > 1 and lines are a repeating pattern, deduplicate
      function deduplicateRoundLines(lines: any[], rounds: number): any[] {
        if (rounds <= 1 || lines.length < 2) return lines;
        const chunkSize = lines.length / rounds;
        if (chunkSize !== Math.floor(chunkSize) || chunkSize < 1) return lines;
        // Check if all chunks are identical
        const chunk = lines.slice(0, chunkSize);
        let allSame = true;
        for (let r = 1; r < rounds; r++) {
          for (let i = 0; i < chunkSize; i++) {
            const a = chunk[i];
            const b = lines[r * chunkSize + i];
            if (!b || String(a.distance) !== String(b.distance) || String(a.reps) !== String(b.reps)) {
              allSame = false;
              break;
            }
          }
          if (!allSame) break;
        }
        return allSame ? chunk : lines;
      }

      const newSets: SetInput[] = parsed.map((ps: any) => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        groups: (ps.groups || [{ rounds: 1, lines: ps.lines || [] }]).map((g: any) => {
          const groupRounds = parseInt(g.rounds) || 1;
          let expanded = expandLines(g.lines || []);
          expanded = deduplicateRoundLines(expanded, groupRounds);
          return {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            rounds: String(groupRounds),
            lines: expanded.map((l: any) => {
              const lineReps = parseInt(l.reps) || 1;
              const effectiveReps = (groupRounds > 1 && lineReps === groupRounds) ? 1 : lineReps;
              return {
                ...createEmptyLine(),
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                reps: String(effectiveReps),
                distance: String(l.distance || 100),
                stroke: (l.stroke || "free") as any,
                interval: l.interval_seconds != null ? String(l.interval_seconds) : "",
              };
            }),
          };
        }),
        description: "",
        hasDetails: false,
      }));
      setSets(newSets);
      setDescribeText("");
      addLog(`7. Done! Created ${newSets.length} sets`);
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setParsing(false);
    }
  }

  async function parsePhoto(uri: string) {
    if (!isParserAvailable()) {
      Alert.alert("Rebuild Required", "Photo parsing needs a native build. Run: npx expo run:ios --device");
      return;
    }
    setParsing(true);
    setDebugLog([]);
    try {
      addLog("1. Running OCR...");
      const ocrText = await extractTextFromImage(uri);
      addLog(`2. OCR result:\n${ocrText}`);

      if (!ocrText.trim()) {
        addLog("FAILED: No text found in image");
        setParsing(false);
        return;
      }

      // Save photo and OCR for training data
      setWorkoutPhotos((prev) => [...prev, uri]);
      setOcrText(ocrText);

      // Show OCR text in describe modal so user can edit before parsing
      setDescribeText(ocrText);
      setShowDescribe(true);
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setParsing(false);
    }
  }

  const pool = POOL_OPTIONS[poolIndex];
  const totalYards = quickMode
    ? (parseInt(quickYards) || 0)
    : sets.reduce((sum, set) =>
        sum + set.groups.reduce((gs, g) => {
          const rounds = parseInt(g.rounds) || 1;
          return gs + g.lines.reduce((ls, l) => {
            if (l.kind === "rest") return ls;
            return ls + (parseInt(l.reps) || 0) * (parseInt(l.distance) || 0);
          }, 0) * rounds;
        }, 0),
      0);

  function addSet() { setSets([...sets, createEmptySet()]); }
  function updateSet(id: string, u: Partial<SetInput>) {
    setSets(sets.map((s) => (s.id === id ? { ...s, ...u } : s)));
  }
  function removeSet(id: string) {
    if (sets.length > 1) {
      setSets(sets.filter((s) => s.id !== id));
      setRepDetailsMap((m) => { const n = { ...m }; delete n[id]; return n; });
    }
  }
  function moveSet(id: string, dir: -1 | 1) {
    const idx = sets.findIndex((s) => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sets.length) return;
    const next = [...sets];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setSets(next);
  }

  const modalSet = modalSetId ? sets.find((s) => s.id === modalSetId) : null;
  const modalLines: LineInfo[] = modalSet?.groups
    ? modalSet.groups.flatMap((g) => {
        const rounds = parseInt(g.rounds) || 1;
        return g.lines
          .filter((l) => l.kind !== "rest")
          .map((l) => ({
            id: l.id,
            reps: (parseInt(l.reps) || 1) * rounds,
            distance: parseInt(l.distance) || 100,
            stroke: l.stroke,
            interval: l.interval ? parseInt(l.interval) : null,
          }));
      })
    : [];

  function handleSaveDetails(details: RepDetail[]) {
    if (modalSetId) {
      setRepDetailsMap((m) => ({ ...m, [modalSetId]: details }));
      updateSet(modalSetId, { hasDetails: true });
    }
    setModalSetId(null);
  }

  async function handleSave() {
    if (totalYards === 0) {
      Alert.alert("No yardage", quickMode ? "Enter total yardage." : "Add at least one set with distance.");
      return;
    }
    setSaving(true);
    try {
      const setsData = sets.map((s, i) => ({
        id: s.id,
        order_index: i,
        groups: s.groups.map((g) => ({
          id: g.id,
          rounds: parseInt(g.rounds) || 1,
          lines: g.lines
            .filter((l) => l.kind === "rest" ? (parseInt(l.rest_seconds) || 0) > 0 : (parseInt(l.distance) || 0) > 0)
            .map((l): any => {
              if (l.kind === "rest") {
                return { kind: "rest", id: l.id, rest_seconds: parseInt(l.rest_seconds) || 0 };
              }
              return {
                kind: "work",
                id: l.id,
                reps: parseInt(l.reps) || 1,
                distance: parseInt(l.distance) || 0,
                stroke: l.stroke,
                mode: l.mode !== "swim" ? l.mode : undefined,
                effort: l.effort || undefined,
                interval_seconds: l.interval ? parseInt(l.interval) : null,
                interval_type: l.interval_type !== "fixed" ? l.interval_type : undefined,
                base_offset: l.base_offset || undefined,
                modifiers: l.modifiers.length > 0 ? l.modifiers : undefined,
                equipment: l.equipment.length > 0 ? l.equipment : undefined,
                breathing: l.breathing || undefined,
                targets: l.targets || undefined,
              };
            }),
        })).filter((g) => g.lines.length > 0),
        rep_details: repDetailsMap[s.id] || [],
        description: s.description || null,
      })).filter((s) => s.groups.length > 0);

      // Copy photos to permanent storage
      const savedPhotos: string[] = [];
      for (const uri of workoutPhotos) {
        try {
          const dir = `${FileSystem.documentDirectory}photos/`;
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const filename = `swim_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
          const dest = `${dir}${filename}`;
          await FileSystem.copyAsync({ from: uri, to: dest });
          savedPhotos.push(dest);
        } catch {}
      }

      const workoutData = {
        date: swimDate.toISOString(),
        total_yards: totalYards,
        pool_length: pool.length,
        pool_unit: pool.unit,
        feeling_score: feelingScore,
        notes: notes || null,
        duration_minutes: duration ? parseInt(duration) : null,
        sets: quickMode ? [] : setsData,
        photos: savedPhotos.length > 0 ? savedPhotos : undefined,
        ocrText: ocrText || undefined,
        benchmarks: benchmarks.filter((b) => b.name.trim() || b.reps || b.distance || b.value || b.totalTime || b.avgPace || b.interval).map((b) => ({
          id: b.id,
          type: b.type,
          name: b.name,
          reps: b.reps ? parseInt(b.reps) : null,
          distance: b.distance ? parseInt(b.distance) : null,
          stroke: b.stroke || null,
          interval_seconds: b.interval ? parseInt(b.interval) : null,
          avg_pace_per_100: b.avgPace ? parseInt(b.avgPace) : null,
          total_time_seconds: b.totalTime ? parseInt(b.totalTime) : null,
          value: b.value ? parseFloat(b.value) : null,
          unit: b.unit || null,
          notes: b.notes || null,
        })),
      };

      let workoutId: string;
      const bmCount = (workoutData.benchmarks || []).length;
      if (editingWorkoutId) {
        await updateWorkout(editingWorkoutId, workoutData);
        workoutId = editingWorkoutId;
      } else {
        const workout = await saveWorkout(workoutData);
        workoutId = workout.id;
      }
      if (bmCount > 0) {
        console.log(`Saved ${bmCount} benchmarks with workout ${workoutId}`);
      }

      // Reset form
      setEditingWorkoutId(null);
      setQuickMode(false);
      setQuickYards("");
      setSets([createEmptySet()]);
      setRepDetailsMap({});
      setBenchmarks([]);
      setWorkoutPhotos([]);
      setOcrText(null);
      setSwimDate(new Date());
      setFeelingScore(5);
      setNotes("");
      setDuration("");

      Alert.alert(
        editingWorkoutId ? "Updated!" : "Saved!",
        `${totalYards} ${pool.unit} ${editingWorkoutId ? "updated" : "logged"}.${bmCount > 0 ? ` ${bmCount} benchmark(s).` : ""}`,
        [
          { text: "View", onPress: () => router.push(`/workout/${workoutId}`) },
          { text: "OK" },
        ]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.container}>
            <Text style={s.subtitle}>{editingWorkoutId ? "EDIT SWIM" : "NEW SWIM"}</Text>
            <View style={s.titleRow}>
              <Text style={s.title}>{editingWorkoutId ? "Edit" : "Log"}</Text>
              <Text style={s.totalYards}>
                {totalYards}
                <Text style={s.totalUnit}> {pool.unit}</Text>
              </Text>
            </View>

            {/* Date picker */}
            <Pressable onPress={() => setShowDatePicker(!showDatePicker)} style={s.dateBtn}>
              <FontAwesome name="calendar" size={14} color={colors.swim[400]} />
              <Text style={s.dateBtnText}>
                {swimDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </Text>
              {swimDate.toDateString() === new Date().toDateString() && (
                <Text style={s.dateBadge}>Today</Text>
              )}
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={swimDate}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                themeVariant="dark"
                onChange={(_, date) => {
                  if (date) setSwimDate(date);
                  setShowDatePicker(false);
                }}
              />
            )}

            {/* Mode toggle */}
            <View style={s.modeRow}>
              <Pressable
                onPress={() => setQuickMode(false)}
                style={[s.modeChip, !quickMode && s.modeChipActive]}
              >
                <Text style={[s.modeText, !quickMode && s.modeTextActive]}>Detailed</Text>
              </Pressable>
              <Pressable
                onPress={() => setQuickMode(true)}
                style={[s.modeChip, quickMode && s.modeChipActive]}
              >
                <Text style={[s.modeText, quickMode && s.modeTextActive]}>Quick</Text>
              </Pressable>
            </View>

            {quickMode ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.sectionLabel}>TOTAL YARDAGE</Text>
                <TextInput
                  style={s.textInput}
                  value={quickYards}
                  onChangeText={setQuickYards}
                  keyboardType="number-pad"
                  placeholder="e.g. 2500"
                  placeholderTextColor={colors.muted}
                />
              </View>
            ) : (
            <>
            {/* Import options */}
            <View style={s.photoRow}>
              <Pressable style={s.photoBtn} onPress={handleCameraCapture} disabled={parsing}>
                <FontAwesome name="camera" size={14} color={colors.swim[400]} />
                <Text style={s.photoBtnText}>Snap</Text>
              </Pressable>
              <Pressable style={s.photoBtn} onPress={handlePhotoImport} disabled={parsing}>
                <FontAwesome name="image" size={14} color={colors.swim[400]} />
                <Text style={s.photoBtnText}>Photo</Text>
              </Pressable>
              <Pressable style={s.photoBtn} onPress={() => setShowDescribe(true)} disabled={parsing}>
                <FontAwesome name="microphone" size={14} color={colors.swim[400]} />
                <Text style={s.photoBtnText}>Describe</Text>
              </Pressable>
            </View>
            {parsing && (
              <View style={s.parsingRow}>
                <ActivityIndicator color={colors.swim[400]} />
                <Text style={s.parsingText}>Parsing workout...</Text>
              </View>
            )}
            {debugLog.length > 0 && (
              <View style={s.debugBox}>
                <View style={s.debugHeader}>
                  <Text style={s.debugTitle}>PARSE LOG</Text>
                  <Pressable onPress={() => setDebugLog([])}>
                    <Text style={s.debugClear}>Clear</Text>
                  </Pressable>
                </View>
                <ScrollView style={s.debugScroll} nestedScrollEnabled>
                  {debugLog.map((msg, i) => (
                    <Text key={i} style={s.debugText}>{msg}</Text>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={s.sectionLabel}>POOL</Text>
            <View style={s.poolRow}>
              {POOL_OPTIONS.map((opt, i) => (
                <Pressable
                  key={opt.label}
                  onPress={() => setPoolIndex(i)}
                  style={[s.poolChip, i === poolIndex && s.poolChipActive]}
                >
                  <Text style={[s.poolText, i === poolIndex && s.poolTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.sectionLabel}>SETS</Text>
            {sets.map((set, index) => (
              <SetEntry
                key={set.id}
                set={set}
                index={index}
                baseTime100={baseTime}
                onUpdate={(u) => updateSet(set.id, u)}
                onRemove={() => removeSet(set.id)}
                onMoveUp={() => moveSet(set.id, -1)}
                onMoveDown={() => moveSet(set.id, 1)}
                onOpenDetails={() => setModalSetId(set.id)}
                canRemove={sets.length > 1}
                isFirst={index === 0}
                isLast={index === sets.length - 1}
              />
            ))}
            <Pressable onPress={addSet} style={s.addSet}>
              <Text style={s.addSetText}>+ Add Set</Text>
            </Pressable>
            </>
            )}

            {/* Benchmarks */}
            <Text style={s.sectionLabel}>BENCHMARKS</Text>
            {benchmarks.map((bm) => (
              <BenchmarkEntry
                key={bm.id}
                benchmark={bm}
                onUpdate={(u) => setBenchmarks(benchmarks.map((b) => b.id === bm.id ? { ...b, ...u } : b))}
                onRemove={() => setBenchmarks(benchmarks.filter((b) => b.id !== bm.id))}
              />
            ))}
            <Pressable
              onPress={() => setBenchmarks([...benchmarks, createEmptyBenchmark()])}
              style={s.addSet}
            >
              <Text style={s.addSetText}>+ Add Benchmark</Text>
            </Pressable>

            <Text style={s.sectionLabel}>DURATION (MINUTES)</Text>
            <TextInput
              style={s.textInput}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="e.g. 60"
              placeholderTextColor={colors.muted}
            />

            <FeelingSlider value={feelingScore} onChange={setFeelingScore} />

            <Text style={[s.sectionLabel, { marginTop: 24 }]}>NOTES</Text>
            <TextInput
              style={[s.textInput, { minHeight: 90, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel? Anything to remember?"
              placeholderTextColor={colors.muted}
              multiline
            />

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[s.save, saving && { backgroundColor: colors.surfaceLight }]}
            >
              <Text style={[s.saveText, saving && { color: colors.muted }]}>
                {saving ? "Saving..." : editingWorkoutId ? "Update Workout" : "Save Workout"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showDescribe} animationType="slide" presentationStyle="pageSheet">
        <View style={s.describeModal}>
          <View style={s.describeHeader}>
            <Pressable onPress={() => setShowDescribe(false)}>
              <Text style={s.describeCancelText}>Cancel</Text>
            </Pressable>
            <Text style={s.describeTitle}>Describe Workout</Text>
            <Pressable onPress={parseDescription}>
              <Text style={s.describeParseText}>Parse</Text>
            </Pressable>
          </View>
          <Text style={s.describeHint}>
            Describe your sets — tap the mic on your keyboard to dictate. Example: "We did 6 by 100 free on 1:30, then 4 by 50 kick on 1:00"
          </Text>
          <TextInput
            style={s.describeInput}
            value={describeText}
            onChangeText={setDescribeText}
            placeholder='e.g. "4x100 free at 1:30, then 8x50 kick at :50"'
            placeholderTextColor={colors.muted}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </View>
      </Modal>

      {modalSet && (
        <RepDetailModal
          visible={!!modalSetId}
          lines={modalLines}
          poolLength={pool.length}
          baseTime100={baseTime}
          repDetails={repDetailsMap[modalSet.id] || []}
          onSave={handleSaveDetails}
          onClose={() => setModalSetId(null)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  subtitle: { fontSize: 11, color: colors.muted, fontWeight: "700", letterSpacing: 2 },
  titleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: "800", color: colors.white },
  totalYards: { fontSize: 22, fontWeight: "800", color: colors.swim[400] },
  totalUnit: { fontSize: 13, fontWeight: "400", color: colors.muted },
  sectionLabel: {
    fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10,
  },
  poolRow: { flexDirection: "row", marginBottom: 20 },
  poolChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surface, marginRight: 8, borderWidth: 1, borderColor: colors.border,
  },
  poolChipActive: { backgroundColor: colors.swim[600], borderColor: colors.swim[600] },
  poolText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  poolTextActive: { color: colors.white },
  addSet: {
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 18,
    paddingVertical: 14, alignItems: "center", marginBottom: 24,
  },
  addSetText: { color: colors.muted, fontWeight: "600", fontSize: 14 },
  textInput: {
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.white, marginBottom: 24, borderWidth: 1, borderColor: colors.border,
  },
  dateBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start",
  },
  dateBtnText: { color: colors.white, fontSize: 14, fontWeight: "600", marginLeft: 8 },
  dateBadge: {
    color: colors.swim[400], fontSize: 11, fontWeight: "700", marginLeft: 8,
  },
  modeRow: { flexDirection: "row", marginBottom: 16 },
  modeChip: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12,
    backgroundColor: colors.surface, marginRight: 8, borderWidth: 1, borderColor: colors.border,
  },
  modeChipActive: { backgroundColor: colors.swim[600], borderColor: colors.swim[600] },
  modeText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  modeTextActive: { color: colors.white },
  photoRow: { flexDirection: "row", marginBottom: 16 },
  photoBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  photoBtnText: { color: colors.swim[400], fontSize: 13, fontWeight: "600", marginLeft: 8 },
  parsingRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  parsingText: { color: colors.muted, fontSize: 13, marginLeft: 8 },
  debugBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border, maxHeight: 300,
  },
  debugHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  debugTitle: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 1.5 },
  debugClear: { fontSize: 12, color: colors.accent.red, fontWeight: "600" },
  debugScroll: { maxHeight: 260 },
  debugText: { fontSize: 11, color: colors.swim[400], fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 16, marginBottom: 6 },
  describeModal: { flex: 1, backgroundColor: colors.bg, paddingTop: 12 },
  describeHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  describeCancelText: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  describeTitle: { fontSize: 16, fontWeight: "700", color: colors.white },
  describeParseText: { fontSize: 15, color: colors.swim[500], fontWeight: "700" },
  describeHint: {
    fontSize: 13, color: colors.muted, lineHeight: 18, paddingHorizontal: 20, paddingVertical: 16,
  },
  describeInput: {
    flex: 1, backgroundColor: colors.surface, marginHorizontal: 20, borderRadius: 16,
    padding: 16, fontSize: 16, color: colors.white, lineHeight: 24,
    borderWidth: 1, borderColor: colors.border, textAlignVertical: "top",
  },
  save: { backgroundColor: colors.swim[600], borderRadius: 18, paddingVertical: 18, alignItems: "center" },
  saveText: { color: colors.white, fontSize: 17, fontWeight: "700" },
});
