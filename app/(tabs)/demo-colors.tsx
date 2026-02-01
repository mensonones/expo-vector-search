import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { VectorIndex } from 'expo-vector-search';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

const TOTAL_COLORS = 30;
const VEC_DIM = 3; // R, G, B

type ColorItem = {
    id: number;
    r: number;
    g: number;
    b: number;
    hex: string;
};

// Simple pseudo-random generator to ensure consistent demo data across devices
const seedRandom = (seed: number) => {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
};

export default function DemoColorsScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const isDark = colorScheme === 'dark';

    const [index, setIndex] = useState<VectorIndex | null>(null);
    const [colors, setColors] = useState<ColorItem[]>([]);
    const [isReady, setIsReady] = useState(false);
    const [targetColor, setTargetColor] = useState<ColorItem | null>(null);
    const [matches, setMatches] = useState<ColorItem[]>([]);
    const [simdBackend, setSimdBackend] = useState<string>('-');

    useEffect(() => {
        try {
            const idx = new VectorIndex(1);
            setSimdBackend(idx.isa || 'unknown');
        } catch (e) {
            setSimdBackend('n/a');
        }
    }, []);

    // Initialize Index and Generate Colors
    useEffect(() => {
        const random = seedRandom(123); // Fixed seed
        setTimeout(() => {
            const idx = new VectorIndex(VEC_DIM, { metric: 'l2sq' });
            const generatedColors: ColorItem[] = [];

            for (let i = 0; i < TOTAL_COLORS; i++) {
                const r = random();
                const g = random();
                const b = random();

                // Add to Index
                idx.add(i, new Float32Array([r, g, b]));

                generatedColors.push({
                    id: i,
                    r, g, b,
                    hex: rgbToHex(r, g, b)
                });
            }

            setIndex(idx);
            setColors(generatedColors);
            setIsReady(true);

            // Auto-select first target
            selectTarget(generatedColors[Math.floor(random() * TOTAL_COLORS)], idx, generatedColors);

        }, 500);
    }, []);

    const rgbToHex = (r: number, g: number, b: number) => {
        const toHex = (c: number) => {
            const hex = Math.floor(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const selectTarget = useCallback((color: ColorItem, idx: VectorIndex | null, allColors: ColorItem[]) => {
        if (!idx) return;
        setTargetColor(color);

        // Search for closest colors using L2
        const results = idx.search(new Float32Array([color.r, color.g, color.b]), 21); // 1 self + 20 matches

        // Map results back to ColorItems
        const found = results
            .map(r => allColors[r.key])
            .filter(c => c.id !== color.id); // Exclude self

        setMatches(found);
    }, []);

    const renderColorGrid = ({ item }: { item: ColorItem }) => (
        <TouchableOpacity
            style={[styles.colorCell, { backgroundColor: item.hex }]}
            onPress={() => selectTarget(item, index, colors)}
        />
    );

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Header Title */}
            <View style={styles.header}>
                <GlassCard style={styles.headerGlass}>
                    <View style={styles.headerRow}>
                        <IconSymbol size={32} name="paintpalette.fill" color={theme.text} style={{ opacity: 0.8 }} />
                        <View>
                            <ThemedText type="title" style={styles.title}>L2 Color Matcher</ThemedText>
                            <ThemedText style={styles.subtitle}>Euclidean Space • {simdBackend.toUpperCase()}</ThemedText>
                        </View>
                    </View>
                </GlassCard>
            </View>

            {/* Target Selection */}
            <View style={styles.section}>
                <ThemedText style={styles.sectionLabel}>SELECTED TARGET</ThemedText>
                <View style={styles.targetRow}>
                    <View style={[styles.targetSwatch, { backgroundColor: targetColor?.hex }]} />
                    <View style={styles.targetInfo}>
                        <ThemedText style={styles.hexText}>{targetColor?.hex.toUpperCase()}</ThemedText>
                        <ThemedText style={styles.rgbText}>
                            R:{(targetColor?.r ?? 0).toFixed(2)} G:{(targetColor?.g ?? 0).toFixed(2)} B:{(targetColor?.b ?? 0).toFixed(2)}
                        </ThemedText>
                    </View>
                </View>
            </View>

            {/* Matches */}
            <View style={styles.section}>
                <ThemedText style={styles.sectionLabel}>NEAREST NEIGHBORS (L2 METRIC)</ThemedText>
                <FlatList
                    data={matches}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.matchCell, { backgroundColor: item.hex }]}
                            onPress={() => selectTarget(item, index, colors)}
                        />
                    )}
                />
            </View>

            {/* Palette Label */}
            <View style={[styles.section, { marginBottom: 8 }]}>
                <ThemedText style={styles.sectionLabel}>TAP TO SELECT NEW TARGET ({TOTAL_COLORS} ITEMS)</ThemedText>
            </View>
        </View>
    );

    if (!isReady) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={theme.tint} />
                <ThemedText style={{ marginTop: 20, opacity: 0.5 }}>Generating {TOTAL_COLORS} colors...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={colors}
                keyExtractor={item => item.id.toString()}
                numColumns={4}
                renderItem={renderColorGrid}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={60}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    listContent: { paddingBottom: 60 },
    headerContainer: { paddingHorizontal: 20, paddingTop: 60, gap: 24, marginBottom: 8 },

    header: { marginBottom: 8 },
    headerGlass: { padding: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { opacity: 0.5, fontSize: 14 },

    section: {},
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8E8E93',
        letterSpacing: 1.5,
        marginBottom: 8,
    },

    targetRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    targetSwatch: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    targetInfo: { gap: 4 },
    hexText: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
    rgbText: { fontSize: 12, opacity: 0.5, fontFamily: 'Menlo' },


    matchCell: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },

    colorCell: { flex: 1, aspectRatio: 1, margin: 1, borderRadius: 2 },
});
