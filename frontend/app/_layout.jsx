// app/_layout.js 或路由配置文件
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="control" options={{ headerShown: false }} />
      <Stack.Screen name="armcontrol" options={{ headerShown: false }} />
    </Stack>
  );
}