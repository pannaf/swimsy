import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSettings, saveSettings, UserSettings } from "../../lib/storage";
import { PoolUnit } from "../../lib/types";
import { colors } from "../../lib/theme";
import { isAvailable, requestPermissions } from "../../lib/healthkit";
import { isConnected as isWhoopConnected, authorize as whoopAuthorize, disconnect as whoopDisconnect } from "../../lib/whoop";

const POOL_OPTIONS: { label: string; length: number; unit: PoolUnit }[] = [
  { label: "25 yd", length: 25, unit: "yards" },
  { label: "25 m", length: 25, unit: "meters" },
  { label: "50 m", length: 50, unit: "meters" },
  { label: "50 yd", length: 50, unit: "yards" },
];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function IntegrationRow({
  icon,
  name,
  desc,
}: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  name: string;
  desc: string;
}) {
  return (
    <View style={s.intRow}>
      <View style={s.iconBox}>
        <FontAwesome name={icon} size={18} color={colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.intName}>{name}</Text>
        <Text style={s.intDesc}>{desc}</Text>
      </View>
      <View style={s.badge}>
        <Text style={s.badgeText}>Soon</Text>
      </View>
    </View>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [baseMin, setBaseMin] = useState("");
  const [baseSec, setBaseSec] = useState("");
  const [healthConnected, setHealthConnected] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await getSettings();
        setSettings(s);
        setBaseMin(Math.floor(s.baseTime100 / 60).toString());
        setBaseSec((s.baseTime100 % 60).toString().padStart(2, "0"));
        setWhoopConnected(await isWhoopConnected());
      })();
    }, [])
  );

  if (!settings) return null;

  const poolIdx = POOL_OPTIONS.findIndex(
    (p) => p.length === settings.defaultPoolLength && p.unit === settings.defaultPoolUnit
  );

  async function updatePool(idx: number) {
    const opt = POOL_OPTIONS[idx];
    const updated = { ...settings!, defaultPoolLength: opt.length, defaultPoolUnit: opt.unit };
    setSettings(updated);
    await saveSettings(updated);
  }

  async function updateBaseTime() {
    const m = parseInt(baseMin) || 0;
    const s = parseInt(baseSec) || 0;
    const total = m * 60 + s;
    if (total < 30 || total > 300) {
      Alert.alert("Invalid", "Base time should be between 0:30 and 5:00");
      return;
    }
    const updated = { ...settings!, baseTime100: total };
    setSettings(updated);
    await saveSettings(updated);
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          <Text style={s.subtitle}>PREFERENCES</Text>
          <Text style={s.title}>Settings</Text>

          {/* Default Pool */}
          <Text style={s.sectionLabel}>DEFAULT POOL</Text>
          <View style={s.poolRow}>
            {POOL_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.label}
                onPress={() => updatePool(i)}
                style={[s.poolChip, i === poolIdx && s.poolChipActive]}
              >
                <Text style={[s.poolText, i === poolIdx && s.poolTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Base 100 Time */}
          <Text style={s.sectionLabel}>BASE 100 PACE</Text>
          <View style={s.baseCard}>
            <Text style={s.baseDesc}>
              Your base pace per 100. Used to calculate suggested intervals.
            </Text>
            <View style={s.baseInputRow}>
              <TextInput
                style={s.baseInput}
                value={baseMin}
                onChangeText={setBaseMin}
                keyboardType="number-pad"
                maxLength={1}
                placeholder="1"
                placeholderTextColor={colors.muted}
              />
              <Text style={s.baseColon}>:</Text>
              <TextInput
                style={s.baseInput}
                value={baseSec}
                onChangeText={(v) => {
                  if (v.length <= 2) setBaseSec(v);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="30"
                placeholderTextColor={colors.muted}
              />
              <Pressable style={s.baseBtn} onPress={updateBaseTime}>
                <Text style={s.baseBtnText}>Save</Text>
              </Pressable>
            </View>
            <Text style={s.basePreview}>
              50 → {formatTime(Math.round(settings.baseTime100 / 2))}
              {"   "}100 → {formatTime(settings.baseTime100)}
              {"   "}200 → {formatTime(settings.baseTime100 * 2)}
            </Text>
          </View>

          {/* Integrations */}
          <Text style={[s.sectionLabel, { marginTop: 8 }]}>WEARABLE INTEGRATIONS</Text>
          {isAvailable() ? (
            <Pressable
              style={s.intRow}
              onPress={async () => {
                const ok = await requestPermissions();
                setHealthConnected(ok);
                Alert.alert(ok ? "Connected" : "Denied", ok ? "Apple Health is connected. Swim data will appear on your workout details." : "Please enable Health permissions in Settings.");
              }}
            >
              <View style={s.iconBox}>
                <FontAwesome name="heartbeat" size={18} color={healthConnected ? colors.accent.green : colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.intName}>Apple Health</Text>
                <Text style={s.intDesc}>Swim workouts, HR, HRV, sleep, VO2 max</Text>
              </View>
              <View style={[s.badge, healthConnected && { backgroundColor: colors.accent.green }]}>
                <Text style={[s.badgeText, healthConnected && { color: colors.white }]}>
                  {healthConnected ? "On" : "Connect"}
                </Text>
              </View>
            </Pressable>
          ) : (
            <IntegrationRow icon="heartbeat" name="Apple Health" desc="iOS only" />
          )}
          <Pressable
            style={s.intRow}
            onPress={async () => {
              if (whoopConnected) {
                Alert.alert("Disconnect Whoop?", "You can reconnect anytime.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Disconnect", style: "destructive", onPress: async () => {
                    await whoopDisconnect();
                    setWhoopConnected(false);
                  }},
                ]);
              } else {
                const ok = await whoopAuthorize();
                setWhoopConnected(ok);
                Alert.alert(ok ? "Connected" : "Failed", ok ? "Whoop is connected. Recovery and strain data will appear on your workouts." : "Could not connect to Whoop. Try again.");
              }
            }}
          >
            <View style={s.iconBox}>
              <FontAwesome name="bolt" size={18} color={whoopConnected ? colors.accent.green : colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.intName}>Whoop</Text>
              <Text style={s.intDesc}>Recovery, strain, HRV, sleep</Text>
            </View>
            <View style={[s.badge, whoopConnected && { backgroundColor: colors.accent.green }]}>
              <Text style={[s.badgeText, whoopConnected && { color: colors.white }]}>
                {whoopConnected ? "On" : "Connect"}
              </Text>
            </View>
          </Pressable>
          <IntegrationRow icon="line-chart" name="Google Fitbit" desc="Activity, sleep, heart rate" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  subtitle: { fontSize: 11, color: colors.muted, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: "800", color: colors.white, marginBottom: 24 },
  sectionLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  poolRow: { flexDirection: "row", marginBottom: 24 },
  poolChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poolChipActive: { backgroundColor: colors.swim[600], borderColor: colors.swim[600] },
  poolText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  poolTextActive: { color: colors.white },
  baseCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  baseDesc: { fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 18 },
  baseInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  baseInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    width: 52,
    paddingVertical: 10,
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
  },
  baseColon: { fontSize: 22, fontWeight: "700", color: colors.white, marginHorizontal: 6 },
  baseBtn: {
    backgroundColor: colors.swim[600],
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 16,
  },
  baseBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  basePreview: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  intRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  intName: { fontSize: 15, fontWeight: "600", color: colors.white },
  intDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, color: colors.muted, fontWeight: "600" },
});
