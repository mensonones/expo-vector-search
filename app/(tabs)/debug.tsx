import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVectorCatalog } from '@/hooks/useVectorCatalog';
import { SearchResult } from 'expo-vector-search/src/ExpoVectorSearch.types';

type LogEntry = {
    id: string;
    timestamp: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
};

const METRICS = ['l2sq', 'cos', 'ip'] as const;
const QUANTIZATIONS = ['f32', 'f16', 'i8'] as const;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DebugScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const themeColors = Colors[colorScheme];

    const { vectorIndex, loadedCount, isInitializing, resetIndex, indexOptions } = useVectorCatalog();

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [batchSize, setBatchSize] = useState<1000 | 10000>(1000);
    const [inspectKey, setInspectKey] = useState('0');
    const [vectorData, setVectorData] = useState<Float32Array | null>(null);

    // Search Config
    const [searchK, setSearchK] = useState('10');
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

    // Filtered Search
    const [filterStart, setFilterStart] = useState('0');
    const [filterEnd, setFilterEnd] = useState('100');
    const [filteredResults, setFilteredResults] = useState<SearchResult[] | null>(null);

    // CRUD Operations
    const [removeKey, setRemoveKey] = useState('');
    const [updateKey, setUpdateKey] = useState('');

    // Persistence
    const [savedPath, setSavedPath] = useState<string | null>(null);

    const flatListRef = useRef<FlatList>(null);
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true })
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
                Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false })
            ])
        ).start();
    }, [pulseAnim, glowAnim]);

    const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLogs(prev => [{
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            message,
            type
        }, ...prev].slice(0, 50)); // Keep last 50 logs
    };

    // === CONFIGURATION ACTIONS ===
    const changeMetric = (metric: (typeof METRICS)[number]) => {
        if (metric === indexOptions.metric) return;
        addLog(`Switching distance metric to ${metric.toUpperCase()}...`, 'info');
        resetIndex({ ...indexOptions, metric });
    };

    const changeQuantization = (quant: (typeof QUANTIZATIONS)[number]) => {
        if (quant === indexOptions.quantization) return;
        const prevMem = vectorIndex?.memoryUsage || 0;
        addLog(`Switching quantization to ${quant.toUpperCase()}...`, 'info');
        resetIndex({ ...indexOptions, quantization: quant });
        setTimeout(() => {
            const newMem = vectorIndex?.memoryUsage || 0;
            const savings = prevMem > 0 ? ((1 - newMem / prevMem) * 100).toFixed(1) : 0;
            if (prevMem > 0) {
                addLog(`Memory: ${(newMem / 1024 / 1024).toFixed(2)}MB (${savings}% savings)`, 'success');
            }
        }, 500);
    };

    // === BENCHMARK ===
    const runBenchmark = () => {
        if (!vectorIndex) return;
        const DIM = vectorIndex.dimensions;
        addLog(`Generating ${batchSize.toLocaleString()} vectors (${DIM}D)...`, 'info');

        setTimeout(() => {
            const keys = new Int32Array(batchSize);
            const vectors = new Float32Array(batchSize * DIM);

            for (let i = 0; i < batchSize; i++) {
                keys[i] = 300000 + i;
                for (let j = 0; j < DIM; j++) {
                    vectors[i * DIM + j] = Math.random();
                }
            }

            const start = performance.now();
            try {
                vectorIndex.addBatch(keys, vectors);
                const duration = performance.now() - start;
                const itemsPerSec = (batchSize / (duration / 1000)).toFixed(0);
                addLog(`✓ ${batchSize / 1000}k items in ${duration.toFixed(0)}ms (${itemsPerSec}/sec)`, 'success');
            } catch (e: unknown) {
                addLog(`Benchmark Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
            }
        }, 100);
    };

    // === BASIC SEARCH ===
    const runSearch = () => {
        if (!vectorIndex || vectorIndex.count === 0) {
            addLog('Index not ready', 'error');
            return;
        }
        const k = parseInt(searchK, 10) || 10;
        const dim = vectorIndex.dimensions;

        let queryVector: Float32Array;
        const vec0 = vectorIndex.getItemVector(0);

        if (vec0) {
            queryVector = vec0;
            addLog(`Querying neighbors of ID:0 (k=${k})...`, 'info');
        } else {
            queryVector = new Float32Array(dim);
            for (let i = 0; i < dim; i++) queryVector[i] = Math.random();
            addLog(`Querying random vector (k=${k})...`, 'info');
        }

        try {
            const start = performance.now();
            const results = vectorIndex.search(queryVector, k);
            const duration = (performance.now() - start).toFixed(2);
            setSearchResults(results);
            addLog(`✓ Found ${results.length} results in ${duration}ms`, 'success');
        } catch (e: unknown) {
            addLog(`Search Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };

    // === FILTERED SEARCH ===
    const runFilteredSearch = () => {
        if (!vectorIndex || vectorIndex.count === 0) {
            addLog('Index not ready', 'error');
            return;
        }
        const start = parseInt(filterStart, 10) || 0;
        const end = parseInt(filterEnd, 10) || 100;

        if (end <= start) {
            addLog('Invalid range: end must be > start', 'error');
            return;
        }

        const allowedKeys = new Int32Array(end - start);
        for (let i = 0; i < allowedKeys.length; i++) {
            allowedKeys[i] = start + i;
        }

        const dim = vectorIndex.dimensions;
        const queryVector = new Float32Array(dim);
        for (let i = 0; i < dim; i++) queryVector[i] = Math.random();

        addLog(`Filtered search: IDs ${start}-${end} (${allowedKeys.length} allowed)...`, 'info');

        try {
            const startTime = performance.now();
            // Using type assertion as the hook doesn't expose SearchOptions type
            const results = (vectorIndex as any).search(queryVector, 10, { allowedKeys });
            const duration = (performance.now() - startTime).toFixed(2);
            setFilteredResults(results);
            addLog(`✓ Filtered: ${results.length} results in ${duration}ms`, 'success');
        } catch (e: unknown) {
            addLog(`Filtered Search Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };

    // === CRUD OPERATIONS ===
    const handleRemove = () => {
        const key = parseInt(removeKey, 10);
        if (isNaN(key)) {
            addLog('Invalid key format', 'error');
            return;
        }

        // Debug: Check if method exists
        const hasRemove = typeof (vectorIndex as any)?.remove === 'function';
        addLog(`remove method exists: ${hasRemove}`, 'info');

        try {
            if (!hasRemove) {
                addLog('remove() not available on this VectorIndex', 'warning');
                return;
            }
            (vectorIndex as any).remove(key);
            addLog(`✓ Removed ID:${key}`, 'success');
            setRemoveKey('');
        } catch (e: unknown) {
            addLog(`Remove failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };

    const handleUpdate = () => {
        const key = parseInt(updateKey, 10);
        if (isNaN(key) || !vectorIndex) {
            addLog('Invalid key or index not ready', 'error');
            return;
        }

        // Debug: Check if method exists
        const hasUpdate = typeof (vectorIndex as any).update === 'function';
        addLog(`update method exists: ${hasUpdate}`, 'info');

        const dim = vectorIndex.dimensions;
        const newVector = new Float32Array(dim);
        for (let i = 0; i < dim; i++) newVector[i] = Math.random();

        try {
            if (!hasUpdate) {
                addLog('update() not available on this VectorIndex', 'warning');
                return;
            }
            (vectorIndex as any).update(key, newVector);
            addLog(`✓ Updated ID:${key} with random vector`, 'success');
            setUpdateKey('');
        } catch (e: unknown) {
            addLog(`Update failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };

    // === PERSISTENCE ===
    const handleSave = async () => {
        if (!vectorIndex) return;
        try {
            const file = new File(Paths.document, 'vector_index.usearch');
            vectorIndex.save(file.uri);
            setSavedPath(file.uri);
            addLog(`✓ Saved to ${file.name}`, 'success');
        } catch (e: unknown) {
            addLog(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };

    const handleLoad = async () => {
        if (!vectorIndex || !savedPath) {
            addLog('No saved index found', 'warning');
            return;
        }
        try {
            const file = new File(savedPath);
            if (!file.exists) {
                addLog('Saved file not found', 'error');
                return;
            }
            vectorIndex.load(savedPath);
            addLog(`✓ Loaded index (${vectorIndex.count} items)`, 'success');
        } catch (e: unknown) {
            addLog(`Load failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };

    // === VECTOR INSPECTOR ===
    const inspectVector = () => {
        const key = parseInt(inspectKey, 10);
        if (isNaN(key)) return;
        try {
            const vec = vectorIndex?.getItemVector(key);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            setVectorData(vec || null);
            if (vec) addLog(`Inspected ID:${key} (${vec.length}D)`, 'success');
            else addLog(`ID:${key} not found`, 'error');
        } catch {
            addLog(`Inspect failed`, 'error');
        }
    };

    // --- UI Components ---

    const StatusOrb = () => (
        <View style={styles.orbContainer}>
            <Animated.View style={[styles.orbCore, {
                backgroundColor: isInitializing ? '#FFD60A' : '#32D74B',
                opacity: pulseAnim,
                transform: [{ scale: pulseAnim }]
            }]} />
            <View style={[styles.orbSolid, { backgroundColor: isInitializing ? '#FFD60A' : '#32D74B' }]} />
        </View>
    );

    const Pill = ({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.pill,
                active && { backgroundColor: themeColors.tint, borderColor: themeColors.tint },
                disabled && { opacity: 0.3 }
            ]}
        >
            <ThemedText style={[styles.pillText, active && { color: isDark ? '#000' : '#FFF' }]}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );

    const SectionCard = ({ title, icon, children, accentColor }: { title: string; icon: string; children: React.ReactNode; accentColor?: string }) => (
        <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={[styles.sectionHeader, accentColor ? { borderLeftColor: accentColor } : null]}>
                <IconSymbol name={icon as any} size={16} color={accentColor || themeColors.icon} />
                <ThemedText style={[styles.sectionTitle, accentColor ? { color: accentColor } : null]}>{title}</ThemedText>
            </View>
            {children}
        </View>
    );

    const MiniInput = ({ value, onChangeText, placeholder, width = 60 }: { value: string; onChangeText: (t: string) => void; placeholder: string; width?: number }) => (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            keyboardType="numeric"
            style={[styles.miniInput, { width, backgroundColor: isDark ? '#000' : '#FFF', color: themeColors.text }]}
            placeholderTextColor={themeColors.icon}
        />
    );

    const ActionButton = ({ label, onPress, variant = 'primary', icon, accentColor }: { label: string; onPress: () => void; variant?: 'primary' | 'danger' | 'secondary'; icon?: string; accentColor?: string }) => {
        const bgColor = variant === 'danger' ? '#FF453A' :
            variant === 'secondary' ? (isDark ? '#2C2C2E' : '#E5E5EA') :
                (accentColor || '#34C759');
        const textColor = variant === 'secondary' ? themeColors.text : '#FFF';

        return (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: bgColor }]} onPress={onPress}>
                {icon && <IconSymbol name={icon as any} size={14} color={textColor} />}
                <ThemedText style={[styles.actionButtonText, { color: textColor }]}>{label}</ThemedText>
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 0} tint={isDark ? 'dark' : 'light'} style={styles.headerGlass}>
                <View style={styles.headerTop}>
                    <View>
                        <ThemedText style={styles.headerTitle}>VECTOR CORE</ThemedText>
                        <ThemedText style={styles.headerSubtitle}>NATIVE DEBUGGER v2</ThemedText>
                    </View>
                    <View style={styles.statusBadge}>
                        <ThemedText style={styles.statusText}>{isInitializing ? 'INDEXING' : 'ONLINE'}</ThemedText>
                        <StatusOrb />
                    </View>
                </View>

                {/* Quick Stats */}
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <ThemedText style={styles.statLabel}>ITEMS</ThemedText>
                        <ThemedText style={styles.statValue}>{loadedCount.toLocaleString()}</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                        <ThemedText style={styles.statLabel}>DIMS</ThemedText>
                        <ThemedText style={styles.statValue}>{vectorIndex?.dimensions || '-'}</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                        <ThemedText style={styles.statLabel}>MEM</ThemedText>
                        <ThemedText style={styles.statValue}>
                            {(vectorIndex?.memoryUsage || 0) / 1024 / 1024 < 1
                                ? '<1 MB'
                                : `${((vectorIndex?.memoryUsage || 0) / 1024 / 1024).toFixed(1)} MB`}
                        </ThemedText>
                    </View>
                    <View style={styles.statItem}>
                        <ThemedText style={styles.statLabel}>QUANT</ThemedText>
                        <ThemedText style={[styles.statValue, { color: themeColors.tint }]}>
                            {(indexOptions?.quantization || 'f32').toUpperCase()}
                        </ThemedText>
                    </View>
                    <View style={styles.statItem}>
                        <ThemedText style={styles.statLabel}>SIMD</ThemedText>
                        <ThemedText style={[styles.statValue, { color: '#32D74B' }]}>
                            {(vectorIndex?.isa || '-').toUpperCase()}
                        </ThemedText>
                    </View>
                </View>
            </BlurView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Quantization Section */}
                <SectionCard title="QUANTIZATION" icon="cpu.fill" accentColor="#AF52DE">
                    <ThemedText style={styles.helperText}>
                        Lower precision = smaller memory footprint
                    </ThemedText>
                    <View style={styles.pillRow}>
                        {QUANTIZATIONS.map(q => (
                            <Pill
                                key={q}
                                label={q.toUpperCase()}
                                active={(indexOptions?.quantization || 'f32') === q}
                                onPress={() => changeQuantization(q)}
                            />
                        ))}
                    </View>
                </SectionCard>

                {/* Distance Metric Section */}
                <SectionCard title="DISTANCE METRIC" icon="ruler.fill" accentColor="#FF9500">
                    <View style={styles.pillRow}>
                        {METRICS.map(m => (
                            <Pill
                                key={m}
                                label={m.toUpperCase()}
                                active={(indexOptions?.metric || 'l2sq') === m}
                                onPress={() => changeMetric(m)}
                            />
                        ))}
                    </View>
                </SectionCard>

                {/* Benchmark Section */}
                <SectionCard title="BATCH BENCHMARK" icon="bolt.fill" accentColor="#FFD60A">
                    <View style={styles.rowBetween}>
                        <View style={styles.pillRow}>
                            {[1000, 10000].map(s => (
                                <Pill
                                    key={s}
                                    label={`${s / 1000}k`}
                                    active={batchSize === s}
                                    onPress={() => setBatchSize(s as 1000 | 10000)}
                                />
                            ))}
                        </View>
                        <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#FFD60A' }]} onPress={runBenchmark}>
                            <IconSymbol name="play.fill" size={16} color="#000" />
                        </TouchableOpacity>
                    </View>
                </SectionCard>

                {/* Search Sandbox */}
                <SectionCard title="SEARCH SANDBOX" icon="magnifyingglass" accentColor="#007AFF">
                    <View style={styles.terminalRow}>
                        <ThemedText style={styles.prompt}>{'>'} query(k=</ThemedText>
                        <MiniInput value={searchK} onChangeText={setSearchK} placeholder="10" width={50} />
                        <ThemedText style={styles.prompt}>)</ThemedText>
                        <TouchableOpacity style={styles.runLink} onPress={runSearch}>
                            <ThemedText style={[styles.runText, { color: '#007AFF' }]}>EXECUTE</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {searchResults && (
                        <View style={styles.resultsGrid}>
                            {searchResults.slice(0, 6).map((res, i) => (
                                <View key={i} style={[styles.resultCard, { backgroundColor: isDark ? '#000' : '#FFF' }]}>
                                    <ThemedText style={styles.resId}>#{res.key}</ThemedText>
                                    <ThemedText style={styles.resDist}>{res.distance.toFixed(4)}</ThemedText>
                                    <View style={[styles.distBar, { width: `${Math.max(5, Math.min(100, (1 - res.distance) * 100))}%`, backgroundColor: '#007AFF' }]} />
                                </View>
                            ))}
                        </View>
                    )}
                </SectionCard>

                {/* Filtered Search */}
                <SectionCard title="FILTERED SEARCH" icon="line.3.horizontal.decrease.circle.fill" accentColor="#5856D6">
                    <ThemedText style={styles.helperText}>
                        Test allowedKeys filter (search within ID range)
                    </ThemedText>
                    <View style={styles.rowBetween}>
                        <View style={styles.rangeInputs}>
                            <ThemedText style={styles.rangeLabel}>IDs:</ThemedText>
                            <MiniInput value={filterStart} onChangeText={setFilterStart} placeholder="0" />
                            <ThemedText style={styles.rangeLabel}>to</ThemedText>
                            <MiniInput value={filterEnd} onChangeText={setFilterEnd} placeholder="100" />
                        </View>
                        <ActionButton label="RUN" onPress={runFilteredSearch} />
                    </View>

                    {filteredResults && (
                        <View style={styles.resultsMini}>
                            {filteredResults.slice(0, 4).map((res, i) => (
                                <View key={i} style={[styles.miniResultCard, { backgroundColor: isDark ? '#000' : '#FFF' }]}>
                                    <ThemedText style={styles.miniResultText}>#{res.key}: {res.distance.toFixed(4)}</ThemedText>
                                </View>
                            ))}
                        </View>
                    )}
                </SectionCard>

                {/* CRUD Operations */}
                <SectionCard title="CRUD OPERATIONS" icon="pencil.and.outline" accentColor="#FF453A">
                    <View style={styles.crudRow}>
                        <View style={styles.crudItem}>
                            <ThemedText style={styles.crudLabel}>Remove</ThemedText>
                            <View style={styles.crudInputRow}>
                                <MiniInput value={removeKey} onChangeText={setRemoveKey} placeholder="ID" width={70} />
                                <ActionButton label="DELETE" onPress={handleRemove} variant="danger" />
                            </View>
                        </View>
                        <View style={styles.crudDivider} />
                        <View style={styles.crudItem}>
                            <ThemedText style={styles.crudLabel}>Update</ThemedText>
                            <View style={styles.crudInputRow}>
                                <MiniInput value={updateKey} onChangeText={setUpdateKey} placeholder="ID" width={70} />
                                <ActionButton label="UPDATE" onPress={handleUpdate} variant="secondary" />
                            </View>
                        </View>
                    </View>
                </SectionCard>

                {/* Persistence */}
                <SectionCard title="PERSISTENCE" icon="externaldrive.fill" accentColor="#34C759">
                    <ThemedText style={styles.helperText}>
                        Save/Load index to device storage
                    </ThemedText>
                    <View style={styles.persistRow}>
                        <ActionButton label="SAVE" onPress={handleSave} icon="square.and.arrow.down" />
                        <ActionButton label="LOAD" onPress={handleLoad} variant="secondary" icon="square.and.arrow.up" />
                    </View>
                    {savedPath && (
                        <View style={styles.savedPathBadge}>
                            <IconSymbol name="checkmark.circle.fill" size={12} color="#34C759" />
                            <ThemedText style={styles.savedPathText}>{savedPath.split('/').pop()}</ThemedText>
                        </View>
                    )}
                </SectionCard>

                {/* Vector Inspector */}
                <SectionCard title="VECTOR INSPECTOR" icon="eye.fill" accentColor="#00C7BE">
                    <View style={styles.searchRow}>
                        <TextInput
                            placeholder="ID..."
                            value={inspectKey}
                            onChangeText={setInspectKey}
                            style={[styles.searchInput, { backgroundColor: isDark ? '#000' : '#FFF', color: themeColors.text }]}
                            placeholderTextColor={themeColors.icon}
                            keyboardType="numeric"
                        />
                        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: '#00C7BE' }]} onPress={inspectVector}>
                            <IconSymbol name="magnifyingglass" size={18} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {vectorData && (
                        <View style={styles.dnaStrip}>
                            {Array.from(vectorData.slice(0, 64)).map((v, i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: (SCREEN_WIDTH - 80) / 16,
                                        height: 12,
                                        backgroundColor: '#00C7BE',
                                        opacity: Math.abs(v),
                                        margin: 1,
                                        borderRadius: 2
                                    }}
                                />
                            ))}
                        </View>
                    )}
                </SectionCard>

            </ScrollView>

            {/* Terminal Log Overlay */}
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={[styles.logDrawer, Platform.OS !== 'ios' && { backgroundColor: '#1C1C1E' }]}>
                <View style={styles.logHeader}>
                    <ThemedText style={styles.logTitle}>SYSTEM LOGS</ThemedText>
                    <TouchableOpacity onPress={() => setLogs([])}>
                        <IconSymbol name="trash" size={14} color="#8E8E93" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    ref={flatListRef}
                    data={logs}
                    keyExtractor={i => i.id}
                    contentContainerStyle={{ paddingTop: 8 }}
                    renderItem={({ item }) => (
                        <ThemedText style={styles.logLine}>
                            <ThemedText style={{ color: '#8E8E93' }}>{new Date(item.timestamp).toLocaleTimeString().split(' ')[0]}</ThemedText>
                            {'  '}
                            <ThemedText style={{
                                color: item.type === 'error' ? '#FF453A' :
                                    item.type === 'success' ? '#32D74B' :
                                        item.type === 'warning' ? '#FFD60A' : '#FFF',
                                fontWeight: item.type === 'info' ? '400' : '600'
                            }}>
                                {item.message}
                            </ThemedText>
                        </ThemedText>
                    )}
                />
            </BlurView>
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
        marginBottom: 20,
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(120,120,128,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    orbContainer: { width: 10, height: 10, justifyContent: 'center', alignItems: 'center' },
    orbCore: { width: 20, height: 20, borderRadius: 10, position: 'absolute' },
    orbSolid: { width: 8, height: 8, borderRadius: 4 },

    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.4,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    },

    scrollContent: {
        padding: 16,
        paddingBottom: 220,
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
        fontSize: 12,
        opacity: 0.5,
        marginTop: -4,
    },

    pillRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(120,120,128,0.3)',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
    },

    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    runBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },

    terminalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.08)',
        padding: 12,
        borderRadius: 12,
        gap: 4,
    },
    prompt: {
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        fontSize: 14,
        opacity: 0.6,
    },
    miniInput: {
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        fontSize: 14,
        fontWeight: '700',
        padding: 6,
        borderRadius: 6,
        textAlign: 'center',
    },
    runLink: {
        marginLeft: 'auto',
    },
    runText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },

    resultsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    resultCard: {
        width: '31%',
        padding: 8,
        borderRadius: 8,
        gap: 4,
    },
    resId: {
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.5,
    },
    resDist: {
        fontSize: 12,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        fontWeight: '600',
    },
    distBar: {
        height: 3,
        borderRadius: 2,
        marginTop: 2,
    },

    rangeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rangeLabel: {
        fontSize: 12,
        opacity: 0.6,
    },

    resultsMini: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    miniResultCard: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    miniResultText: {
        fontSize: 11,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        fontWeight: '600',
    },

    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    actionButtonText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    crudRow: {
        flexDirection: 'row',
        gap: 12,
    },
    crudItem: {
        flex: 1,
        gap: 8,
    },
    crudLabel: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.7,
    },
    crudInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    crudDivider: {
        width: 1,
        backgroundColor: 'rgba(120,120,128,0.2)',
    },

    persistRow: {
        flexDirection: 'row',
        gap: 12,
    },
    savedPathBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    savedPathText: {
        fontSize: 11,
        opacity: 0.6,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    },

    searchRow: {
        flexDirection: 'row',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        fontWeight: '600',
    },
    searchBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dnaStrip: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },

    logDrawer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 180,
        padding: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    logTitle: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    logLine: {
        fontSize: 11,
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
        marginBottom: 6,
    },

    comingSoonBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        borderRadius: 12,
    },
    comingSoonTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    comingSoonText: {
        fontSize: 12,
        opacity: 0.6,
    },
});
