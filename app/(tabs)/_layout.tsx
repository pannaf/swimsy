import { Tabs } from "expo-router";
import PillTabBar from "../../components/PillTabBar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
