import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useEffect, useState } from 'react';
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
    const [f32Time, setF32Time] = useState<number | null>(null);
    const [i8Time, setI8Time] = useState<number | null>(null);
    const [simdBackend, setSimdBackend] = useState<string>('-');

    useEffect(() => {
        try {
            const idx = new VectorIndex(1);
            setSimdBackend(idx.isa || 'unknown');
        } catch (e) {
            setSimdBackend('n/a');
        }
    }, []);

    const DIMENSIONS = 128;
    const COUNT = 1000;

    const MEM_COUNT = 10000;
    const MEM_DIMS = 384;

    const runPerformanceRace = async () => {
        const waitForIndexing = async (index: VectorIndex) => {
            while (index.isIndexing) {
                await new Promise(r => setTimeout(r, 50));
            }
        };

        setStatus('running');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setF32Memory(null);
        setI8Memory(null);
        setF32Time(null);
        setI8Time(null);

        await new Promise(r => setTimeout(r, 100));

        const vectors = Array.from({ length: COUNT }, () =>
            new Float32Array(DIMENSIONS).map(() => Math.random())
        );
        const query = new Float32Array(DIMENSIONS).map(() => Math.random());

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

        try {
            const nativeIndex = new VectorIndex(DIMENSIONS);
            for (let i = 0; i < COUNT; i++) nativeIndex.add(i, vectors[i]);

            const nativeStart = performance.now();
            nativeIndex.search(query, 1);
            const nativeEnd = performance.now();
            setNativeSearchTime(nativeEnd - nativeStart);

            nativeIndex.delete();
        } catch (e: any) {
            setNativeSearchTime(null);
            alert(`Native Benchmark Error: ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 50));

        try {
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
            await waitForIndexing(batchIndex);
            const endBatch = performance.now();
            setBatchInsertTime(endBatch - startBatch);
            batchIndex.delete();
        } catch { }

        await new Promise(r => setTimeout(r, 50));

        try {
            const memKeys = new Int32Array(MEM_COUNT).map((_, i) => i);
            const singleVec = new Float32Array(MEM_DIMS).fill(0.123);
            const memChunk = new Float32Array(MEM_COUNT * MEM_DIMS);
            for (let i = 0; i < MEM_COUNT; i++) {
                memChunk.set(singleVec, i * MEM_DIMS);
            }

            const f32Idx = new VectorIndex(MEM_DIMS, { quantization: 'f32' });
            const startF32 = performance.now();
            f32Idx.addBatch(memKeys, memChunk);
            await waitForIndexing(f32Idx);
            const endF32 = performance.now();
            setF32Memory(f32Idx.memoryUsage);
            setF32Time(endF32 - startF32);
            f32Idx.delete();

            const i8Idx = new VectorIndex(MEM_DIMS, { quantization: 'i8' });
            const startI8 = performance.now();
            i8Idx.addBatch(memKeys, memChunk);
            await waitForIndexing(i8Idx);
            const endI8 = performance.now();
            setI8Memory(i8Idx.memoryUsage);
            setI8Time(endI8 - startI8);
            i8Idx.delete();
        } catch { }

        setStatus('completed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const renderMetric = (label: string, value: string | number | null, unit: string, color: string, compareValue?: number | null, secondaryValue?: number | null) => {
        const isSlower = compareValue && typeof value === 'number' && value > compareValue;
        const ratio = compareValue && typeof value === 'number' ? (value / compareValue).toFixed(1) : null;

        return (
            <GlassCard style={styles.metricCard}>
                <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel}>{label}</ThemedText>
                    <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={[styles.metricValue, { color }]}>
                            {value !== null ? (typeof value === 'number' ? value.toFixed(2) : value) : '--'}
                            <ThemedText style={styles.unit}>{unit}</ThemedText>
                        </ThemedText>
                        {secondaryValue !== null && secondaryValue !== undefined && (
                            <ThemedText style={styles.secondaryTime}>
                                {secondaryValue.toFixed(0)} ms
                            </ThemedText>
                        )}
                    </View>
                </View>
                {ratio && isSlower && (
                    <ThemedText style={styles.ratioNote}>
                        {ratio}x slower than native
                    </ThemedText>
                )}
                <View style={[styles.barContainer, { backgroundColor: color + '15' }]}>
                    <View style={[styles.bar, {
                        width: value ? '100%' : '0%',
                        backgroundColor: color,
                        opacity: isSlower ? 0.4 : 1
                    }]} />
                </View>
            </GlassCard>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <IconSymbol name="sparkles" size={32} color={theme.tint} />
                    </View>
                    <ThemedText type="title" style={styles.title}>Performance Lab</ThemedText>
                    <ThemedText style={styles.subtitle}>Scientific benchmarking • {simdBackend.toUpperCase()}</ThemedText>
                </View>

                {/* Section 1: Search Race */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionLabel}>JS VS. NATIVE ENGINE RACE</ThemedText>
                    <ThemedText style={styles.description}>
                        Searching {COUNT} vectors ({DIMENSIONS} dims) for candidates.
                    </ThemedText>
                    {renderMetric("JavaScript (Runtime loop)", jsSearchTime, "ms", "#FF453A", nativeSearchTime)}
                    {renderMetric("Expo Vector Search (Native)", nativeSearchTime, "ms", "#32ADE6")}
                </View>

                {/* Section 2: Bulk Ingestion */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionLabel}>BULK INGESTION THROUGHPUT</ThemedText>
                    <ThemedText style={styles.description}>
                        Comparing individual JSI calls vs. batch zero-copy buffer.
                    </ThemedText>
                    {renderMetric("Individual .add()", singleInsertTime, "ms", "#FF9F0A", batchInsertTime)}
                    {renderMetric("Batch .addBatch()", batchInsertTime, "ms", "#AF52DE")}
                </View>

                {/* Section 3: Memory Mastery */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <ThemedText style={styles.sectionLabel}>MEMORY OPTIMIZATION</ThemedText>
                        {f32Memory && i8Memory && (
                            <View style={styles.savingsBadge}>
                                <ThemedText style={styles.savingsText}>
                                    -{(((f32Memory - i8Memory) / f32Memory) * 100).toFixed(0)}% RAM
                                </ThemedText>
                            </View>
                        )}
                    </View>
                    <ThemedText style={styles.description}>
                        Comparing {MEM_COUNT.toLocaleString()} vectors ({MEM_DIMS} dims) footprint.
                    </ThemedText>
                    {renderMetric("Full Precision (F32)", f32Memory ? f32Memory / 1024 : null, "KB", "#64D2FF", i8Memory ? i8Memory / 1024 : null, f32Time)}
                    {renderMetric("Quantized (Int8)", i8Memory ? i8Memory / 1024 : null, "KB", "#34C759", null, i8Time)}

                    {i8Memory && (
                        <ThemedText style={styles.hintText}>
                            💡 Int8 reduces RAM usage by up to 75% for raw vector data.
                        </ThemedText>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.runButton, { backgroundColor: theme.tint }]}
                    onPress={runPerformanceRace}
                    disabled={status === 'running'}
                    activeOpacity={0.8}
                >
                    {status === 'running' ? (
                        <ActivityIndicator color={colorScheme === 'dark' ? '#000' : '#fff'} />
                    ) : (
                        <ThemedText style={[styles.runButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>
                            {status === 'idle' ? 'START BENCHMARKS' : 'REFRESH RESULTS'}
                        </ThemedText>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <ThemedText style={styles.footerText}>
                        All benchmarks are executed native-side.
                    </ThemedText>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, paddingTop: 60, gap: 32, paddingBottom: 60 },
    header: { alignItems: 'center', marginBottom: 10 },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#007AFF12',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { fontSize: 16, opacity: 0.5, marginTop: 4, fontWeight: '400' },

    section: { gap: 12 },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8E8E93',
        letterSpacing: 2.5,
        textTransform: 'uppercase',
    },
    description: { fontSize: 14, opacity: 0.5, marginBottom: 4, lineHeight: 20 },

    savingsBadge: {
        backgroundColor: '#34C75915',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    savingsText: {
        color: '#34C759',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    hintText: {
        fontSize: 12,
        opacity: 0.4,
        fontStyle: 'italic',
        marginTop: 4,
    },

    metricCard: {
        padding: 0, // Reset for GlassCard
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    metricLabel: { fontSize: 15, fontWeight: '600', opacity: 0.9 },
    metricValue: { fontSize: 20, fontWeight: '700', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
    secondaryTime: { fontSize: 11, opacity: 0.4, fontWeight: '500' },
    unit: { fontSize: 12, opacity: 0.6, marginLeft: 2 },

    barContainer: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    bar: { height: '100%', borderRadius: 3 },

    ratioNote: { fontSize: 11, color: '#FF453A', marginBottom: 10, marginTop: -4, fontWeight: '500' },

    runButton: {
        paddingVertical: 20,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#007AFF',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
            },
            android: {
                elevation: 4,
            }
        })
    },
    runButtonText: { fontWeight: '800', fontSize: 16, letterSpacing: 1 },

    footer: { alignItems: 'center', marginTop: 10 },
    footerText: { fontSize: 12, opacity: 0.3 },
});
