import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

type LabStatus = 'idle' | 'running' | 'completed';

export default function PerformanceLabScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const [status, setStatus] = useState<LabStatus>('idle');

    // Benchmark States
    const [jsSearchTime, setJsSearchTime] = useState<number | null>(null);
    const [nativeSearchTime, setNativeSearchTime] = useState<number | null>(null);

    const [singleInsertTime, setSingleInsertTime] = useState<number | null>(null);
    const [batchInsertTime, setBatchInsertTime] = useState<number | null>(null);

    const [f32Memory, setF32Memory] = useState<number | null>(null);
    const [i8Memory, setI8Memory] = useState<number | null>(null);

    const DIMENSIONS = 128;
    const COUNT = 1000; // Smaller count for responsive demo but enough to show difference

    const runPerformanceRace = async () => {
        setStatus('running');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Give UI time to update
        await new Promise(r => setTimeout(r, 100));

        // 1. JS vs Native Race
        const vectors = Array.from({ length: COUNT }, () =>
            new Float32Array(DIMENSIONS).map(() => Math.random())
        );
        const query = new Float32Array(DIMENSIONS).map(() => Math.random());

        // JS Search (Simple Euclidean - squared to save sqrt overhead)
        const jsStart = performance.now();
        let bestDist = Infinity;
        for (let i = 0; i < COUNT; i++) {
            let dist = 0;
            for (let j = 0; j < DIMENSIONS; j++) {
                const diff = vectors[i][j] - query[j];
                dist += diff * diff;
            }
            if (dist < bestDist) bestDist = dist;
        }
        const jsEnd = performance.now();
        setJsSearchTime(jsEnd - jsStart);

        // Native Search
        const nativeIndex = new VectorIndex(DIMENSIONS);
        for (let i = 0; i < COUNT; i++) nativeIndex.add(i, vectors[i]);

        const nativeStart = performance.now();
        nativeIndex.search(query, 1);
        const nativeEnd = performance.now();
        setNativeSearchTime(nativeEnd - nativeStart);

        nativeIndex.delete(); // Cleanup

        // 2. Single vs Batch Insert
        const singleIndex = new VectorIndex(DIMENSIONS);
        const startSingle = performance.now();
        for (let i = 0; i < COUNT; i++) singleIndex.add(i, vectors[i]);
        const endSingle = performance.now();
        setSingleInsertTime(endSingle - startSingle);
        singleIndex.delete();

        const batchIndex = new VectorIndex(DIMENSIONS);
        const keys = new Int32Array(COUNT).map((_, i) => i);
        const contiguousVectors = new Float32Array(COUNT * DIMENSIONS);
        for (let i = 0; i < COUNT; i++) {
            contiguousVectors.set(vectors[i], i * DIMENSIONS);
        }

        const startBatch = performance.now();
        batchIndex.addBatch(keys, contiguousVectors);
        const endBatch = performance.now();
        setBatchInsertTime(endBatch - startBatch);
        batchIndex.delete();

        // 3. Memory Optimization
        const MEM_COUNT = 10000;
        const MEM_DIMS = 384; // Higher dims = more vector dominance in memory report
        const f32Idx = new VectorIndex(MEM_DIMS, { quantization: 'f32' });
        const memVectors = new Float32Array(MEM_DIMS);
        for (let i = 0; i < MEM_COUNT; i++) f32Idx.add(i, memVectors);
        setF32Memory(f32Idx.memoryUsage);
        f32Idx.delete();

        const i8Idx = new VectorIndex(MEM_DIMS, { quantization: 'i8' });
        for (let i = 0; i < MEM_COUNT; i++) i8Idx.add(i, memVectors);
        setI8Memory(i8Idx.memoryUsage);
        i8Idx.delete();

        setStatus('completed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const renderMetric = (label: string, value: string | number | null, unit: string, color: string, compareValue?: number | null) => {
        const isSlower = compareValue && typeof value === 'number' && value > compareValue;
        const ratio = compareValue && typeof value === 'number' ? (value / compareValue).toFixed(1) : null;

        return (
            <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel}>{label}</ThemedText>
                    <ThemedText style={[styles.metricValue, { color }]}>
                        {value !== null ? (typeof value === 'number' ? value.toFixed(2) : value) : '--'}
                        <ThemedText style={styles.unit}>{unit}</ThemedText>
                    </ThemedText>
                </View>
                {ratio && isSlower && (
                    <ThemedText style={styles.ratioNote}>
                        {ratio}x slower than native
                    </ThemedText>
                )}
                <View style={styles.barContainer}>
                    <View style={[styles.bar, {
                        width: value ? '100%' : '0%',
                        backgroundColor: color,
                        opacity: isSlower ? 0.3 : 1
                    }]} />
                </View>
            </View>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.header}>
                    <IconSymbol name="bolt.shield.fill" size={48} color={theme.tint} />
                    <ThemedText type="title" style={styles.title}>Performance Lab</ThemedText>
                    <ThemedText style={styles.subtitle}>Native Vector Search Engine Benchmarks</ThemedText>
                </View>

                {/* Section 1: Search Race */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>JS VS. NATIVE ENGINE RACE</ThemedText>
                    <ThemedText style={styles.description}>
                        Searching {COUNT} vectors ({DIMENSIONS} dims) for the nearest neighbor.
                    </ThemedText>
                    {renderMetric("JavaScript (Runtime loop)", jsSearchTime, "ms", "#FF453A", nativeSearchTime)}
                    {renderMetric("Expo Vector Search (Native)", nativeSearchTime, "ms", "#32ADE6")}
                </View>

                {/* Section 2: Bulk Ingestion */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>BULK INGESTION THROUGHPUT</ThemedText>
                    <ThemedText style={styles.description}>
                        Adding {COUNT} vectors using individual JSI calls vs. batch zero-copy buffer.
                    </ThemedText>
                    {renderMetric("Individual .add()", singleInsertTime, "ms", "#FF9F0A", batchInsertTime)}
                    {renderMetric("Batch .addBatch()", batchInsertTime, "ms", "#AF52DE")}
                </View>

                {/* Section 3: Memory Mastery */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>MEMORY OPTIMIZATION</ThemedText>
                    <ThemedText style={styles.description}>
                        Impact of Int8 Quantization on footprint.
                    </ThemedText>
                    {renderMetric("Full Precision (F32)", f32Memory ? f32Memory / 1024 : null, "KB", "#64D2FF", i8Memory ? i8Memory / 1024 : null)}
                    {renderMetric("Quantized (Int8)", i8Memory ? i8Memory / 1024 : null, "KB", "#34C759")}
                </View>

                <TouchableOpacity
                    style={[styles.runButton, { backgroundColor: theme.tint }]}
                    onPress={runPerformanceRace}
                    disabled={status === 'running'}
                >
                    {status === 'running' ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <ThemedText style={styles.runButtonText}>
                            {status === 'idle' ? 'START BENCHMARKS' : 'RUN AGAIN'}
                        </ThemedText>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <ThemedText style={styles.footerText}>
                        Benchmarks ran locally on this device.
                    </ThemedText>
                </View>

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, paddingTop: 60, gap: 32 },
    header: { alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 32, fontWeight: '900', marginTop: 16 },
    subtitle: { fontSize: 14, opacity: 0.6, marginTop: 4 },

    section: { gap: 12 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#8E8E93', letterSpacing: 1 },
    description: { fontSize: 13, opacity: 0.7, marginBottom: 4 },

    metricCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    metricLabel: { fontSize: 14, fontWeight: '600' },
    metricValue: { fontSize: 18, fontWeight: 'bold', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
    unit: { fontSize: 12, opacity: 0.6, marginLeft: 2 },

    barContainer: {
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        overflow: 'hidden',
    },
    bar: { height: '100%', borderRadius: 2 },

    ratioNote: { fontSize: 10, color: '#FF453A', marginBottom: 8, marginTop: -4 },

    runButton: {
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    runButtonText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

    footer: { alignItems: 'center', marginTop: 10 },
    footerText: { fontSize: 11, opacity: 0.4 },
});
