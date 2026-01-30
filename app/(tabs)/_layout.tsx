import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="demo-vector-search"
        options={{
          title: 'Visual Search',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="demo-jaccard"
        options={{
          title: 'Skills',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.crop.square.stack.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="test-diagnostics"
        options={{
          title: 'Perf Lab',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bolt.shield.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="hammer.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="test-metrics"
        options={{
          title: 'Metrics',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ruler.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="demo-colors"
        options={{
          title: 'Colors',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paintpalette.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="demo-hamming"
        options={{
          title: 'Hamming',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.on.doc.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
