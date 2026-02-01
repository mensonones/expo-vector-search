import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BlurView } from 'expo-blur';
import { VectorIndex } from 'expo-vector-search';
import React, { useEffect, useState } from 'react';
import {
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

const DIMENSIONS = 3;

// Define simple 3D vectors for easy manual verification
const VECTORS = {
    ORIGIN: new Float32Array([0, 0, 0]),
    X_AXIS: new Float32Array([1, 0, 0]),
    Y_AXIS: new Float32Array([0, 1, 0]),
    Z_AXIS: new Float32Array([0, 0, 1]),
    ONES: new Float32Array([1, 1, 1]),
    HALF: new Float32Array([0.5, 0.5, 0.5]),
    OPPOSITE: new Float32Array([-1, 0, 0]),
};

type MetricResult = {
    metric: string;
    results: { label: string; key: number; distance: number }[];
};

export default function TestMetricsScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const themeColors = Colors[colorScheme];

    const [results, setResults] = useState<MetricResult[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [simdBackend, setSimdBackend] = useState<string>('-');

    useEffect(() => {
        try {
            const idx = new VectorIndex(1);
            setSimdBackend(idx.isa || 'unknown');
        } catch (e) {
            setSimdBackend('n/a');
        }
    }, []);

    const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

    const runTest = async () => {
        setIsRunning(true);
        setResults([]);
        setLogs([]);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        // Small delay to allow UI to update
        setTimeout(() => {
            addLog('Starting Distance Metric Comparison...');

            const metrics = ['cos', 'l2sq', 'ip', 'jaccard'] as const;
            const testResults: MetricResult[] = [];

            try {
                metrics.forEach((metric) => {
                    addLog(`Testing metric: ${metric.toUpperCase()}...`);
                    const index = new VectorIndex(DIMENSIONS, { metric });

                    // Add vectors
                    index.add(1, VECTORS.X_AXIS);
                    index.add(2, VECTORS.Y_AXIS);
                    index.add(3, VECTORS.Z_AXIS);
                    index.add(4, VECTORS.ONES);
                    index.add(5, VECTORS.HALF);
                    index.add(6, VECTORS.OPPOSITE);

                    // Search using X_AXIS as query
                    const queryVector = VECTORS.X_AXIS;
                    const searchResults = index.search(queryVector, 6);

                    const formattedResults = searchResults.map((res) => {
                        let label = 'Unknown';
                        if (res.key === 1) label = 'X_AXIS (Self)';
                        if (res.key === 2) label = 'Y_AXIS';
                        if (res.key === 3) label = 'Z_AXIS';
                        if (res.key === 4) label = 'ONES';
                        if (res.key === 5) label = 'HALF';
                        if (res.key === 6) label = 'OPPOSITE';

                        return {
                            label,
                            key: res.key,
                            distance: res.distance,
                        };
                    });

                    testResults.push({
                        metric,
                        results: formattedResults,
                    });
                });

                setResults(testResults);
                addLog('Test Complete!');
            } catch (e) {
                addLog(`Error: ${e}`);
            } finally {
                setIsRunning(false);
            }
        }, 100);
    };

    const SectionCard = ({ title, icon, children, accentColor }: { title: string; icon: string; children: React.ReactNode; accentColor?: string }) => (
        <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={[styles.sectionHeader, accentColor ? { borderLeftColor: accentColor } : null]}>
                <IconSymbol name={icon as any} size={16} color={accentColor || themeColors.icon} />
                <ThemedText style={[styles.sectionTitle, accentColor ? { color: accentColor } : null]}>{title}</ThemedText>
            </View>
            {children}
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 0} tint={isDark ? 'dark' : 'light'} style={styles.headerGlass}>
                <View style={styles.headerTop}>
                    <View>
                        <ThemedText style={styles.headerTitle}>METRIC LAB</ThemedText>
                        <ThemedText style={styles.headerSubtitle}>COMPARE DISTANCES • {simdBackend.toUpperCase()}</ThemedText>
                    </View>
                    <TouchableOpacity
                        style={[styles.runBtn, { backgroundColor: isRunning ? themeColors.icon : '#007AFF' }]}
                        onPress={runTest}
                        disabled={isRunning}
                    >
                        <IconSymbol name={isRunning ? "hourglass" : "play.fill"} size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </BlurView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <SectionCard title="TEST CONFIGURATION" icon="gearshape.fill" accentColor="#AF52DE">
                    <ThemedText style={styles.helperText}>
                        Compares how distinct metrics calculate distance between a Query Vector (X-Axis) and various reference vectors.
                    </ThemedText>
                    <View style={styles.vectorInfo}>
                        <ThemedText style={styles.vectorLabel}>Query:</ThemedText>
                        <ThemedText style={styles.vectorValue}>[1, 0, 0]</ThemedText>
                    </View>
                </SectionCard>

                {results.map((res, idx) => (
                    <SectionCard
                        key={idx}
                        title={`METRIC: ${res.metric.toUpperCase()}`}
                        icon="ruler.fill"
                        accentColor={
                            res.metric === 'cos' ? '#FF9500' :
                                res.metric === 'l2sq' ? '#32D74B' :
                                    res.metric === 'ip' ? '#00C7BE' :
                                        '#5856D6' // jaccard (Indigo)
                        }
                    >
                        {res.results.map((r, rIdx) => (
                            <View key={rIdx} style={styles.resultRow}>
                                <ThemedText style={styles.resultLabel}>{r.label}</ThemedText>
                                <ThemedText style={styles.resultValue}>{r.distance.toFixed(6)}</ThemedText>
                                <View style={[
                                    styles.distBar,
                                    {
                                        width: `${Math.min(100, (r.distance / 2) * 100)}%`, // Normalize rough visual
                                        backgroundColor:
                                            res.metric === 'cos' ? '#FF9500' :
                                                res.metric === 'l2sq' ? '#32D74B' :
                                                    res.metric === 'ip' ? '#00C7BE' :
                                                        '#5856D6',
                                        opacity: 0.3
                                    }
                                ]} />
                            </View>
                        ))}
                    </SectionCard>
                ))}

                {logs.length > 0 && (
                    <SectionCard title="EXECUTION LOGS" icon="list.bullet.rectangle.portrait.fill" accentColor="#8E8E93">
                        {logs.map((log, i) => (
                            <ThemedText key={i} style={styles.logText}>{'>'} {log}</ThemedText>
                        ))}
                    </SectionCard>
                )}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerGlass: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(120,120,128,0.2)',
        zIndex: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.5,
        letterSpacing: 2,
    },
    runBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
        gap: 16,
    },
    sectionCard: {
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
        paddingLeft: 8,
        marginLeft: -8,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.5,
        opacity: 0.6,
    },
    helperText: {
        fontSize: 13,
        opacity: 0.6,
        lineHeight: 18,
    },
    vectorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(120,120,128,0.1)',
        padding: 8,
        borderRadius: 8,
        alignSelf: 'flex-start'
    },
    vectorLabel: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.6
    },
    vectorValue: {
        fontSize: 12,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        fontWeight: '600'
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(120,120,128,0.1)',
        position: 'relative',
        overflow: 'hidden',
    },
    resultLabel: {
        fontSize: 13,
        fontWeight: '500',
        zIndex: 1,
    },
    resultValue: {
        fontSize: 13,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        zIndex: 1,
    },
    distBar: {
        position: 'absolute',
        left: 0,
        top: 4,
        bottom: 4,
        borderRadius: 4,
    },
    logText: {
        fontSize: 11,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        opacity: 0.7,
        marginBottom: 2
    }
});
