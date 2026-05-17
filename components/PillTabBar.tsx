import { View, Text, Pressable, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { colors } from "../lib/theme";

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome>["name"]> = {
  index: "home",
  history: "clock-o",
  settings: "sliders",
};

const LABELS: Record<string, string> = {
  index: "Home",
  history: "History",
  settings: "Settings",
};

const HIDDEN_TABS = new Set(["log"]);

export default function PillTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const router = useRouter();
  const visibleRoutes = state.routes.filter((r) => !HIDDEN_TABS.has(r.name));
  const logFocused = state.routes[state.index]?.name === "log";

  return (
    <View style={s.wrapper}>
      <View style={s.barRow}>
        {/* Pill */}
        <View style={s.pill}>
          {visibleRoutes.map((route) => {
            const realIndex = state.routes.indexOf(route);
            const focused = state.index === realIndex;
            const icon = ICONS[route.name] || "circle";
            const label = LABELS[route.name] || route.name;

            return (
              <Pressable
                key={route.key}
                onPress={() => {
                  const e = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !e.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={[s.tab, focused && s.tabActive]}
              >
                <FontAwesome
                  name={icon}
                  size={20}
                  color={focused ? colors.swim[500] : colors.muted}
                />
                {focused && <Text style={s.label}>{label}</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* FAB */}
        <Pressable onPress={() => router.push("/(tabs)/log")} style={({ pressed }) => [s.fab, (pressed || logFocused) && s.fabActive]}>
          <FontAwesome name="plus" size={18} color={logFocused ? colors.swim[500] : colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: "rgba(22, 22, 31, 0.85)",
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  tabActive: {
    backgroundColor: "rgba(40, 165, 255, 0.12)",
    paddingHorizontal: 18,
  },
  label: {
    color: colors.swim[500],
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(22, 22, 31, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  fabActive: {
    borderColor: colors.swim[500],
    backgroundColor: "rgba(40, 165, 255, 0.1)",
  },
});
