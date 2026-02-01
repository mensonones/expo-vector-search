
import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

const HASH_BITS = 64;

type FileSignature = {
    id: string;
    name: string;
    hash: Float32Array; // Simulating binary vector with 0s and 1s
    displayHash: string;
    timestamp: number;
    status: 'unique' | 'duplicate' | 'similar';
    distance?: number;
};

// Simulate generating a perceptual hash or binary signature
const generateRandomHash = (): Float32Array => {
    const hash = new Float32Array(HASH_BITS);
    for (let i = 0; i < HASH_BITS; i++) {
        hash[i] = Math.random() > 0.5 ? 1 : 0;
    }
    return hash;
};

const hashToHex = (hash: Float32Array): string => {
    let hex = '';
    let byte = 0;
    for (let i = 0; i < HASH_BITS; i++) {
        if (hash[i] === 1) {
            byte |= 1 << (i % 8);
        }
        if ((i + 1) % 8 === 0) {
            hex += byte.toString(16).padStart(2, '0');
            byte = 0;
        }
    }
    return hex.toUpperCase();
};

export default function DemoHammingScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const isDark = colorScheme === 'dark';

    const [isReady, setIsReady] = useState(false);
    const [index, setIndex] = useState<VectorIndex | null>(null);
    const [files, setFiles] = useState<FileSignature[]>([]);
    const [scannedCount, setScannedCount] = useState(0);
    const [simdBackend, setSimdBackend] = useState<string>('-');

    useEffect(() => {
        try {
            const idx = new VectorIndex(1);
            setSimdBackend(idx.isa || 'unknown');
        } catch (e) {
            setSimdBackend('n/a');
        }
    }, []);

    // Initialize Index
    useEffect(() => {
        setTimeout(() => {
            // Using Hamming Metric for Binary Variants
            const idx = new VectorIndex(HASH_BITS, { metric: 'hamming' });
            setIndex(idx);
            setIsReady(true);
        }, 500);
    }, []);

    const scanNewFile = useCallback(() => {
        if (!index) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const newId = scannedCount + 1;

        // 20% chance to generate a near-duplicate of an existing file
        let vec: Float32Array;
        let isForcedDup = false;

        if (files.length > 0 && Math.random() < 0.3) {
            const existing = files[Math.floor(Math.random() * files.length)];
            vec = new Float32Array(existing.hash);
            // Flip 1-3 bits to simulate minor alteration or keep identical
            const flips = Math.floor(Math.random() * 3);
            for (let k = 0; k < flips; k++) {
                const bit = Math.floor(Math.random() * HASH_BITS);
                vec[bit] = vec[bit] === 1 ? 0 : 1;
            }
            isForcedDup = true;
        } else {
            vec = generateRandomHash();
        }

        // Search for duplicates/similars
        // Hamming distance: number of differing bits.
        // 0 = Exact Match
        // < 5 = Near Duplicate
        const results = index.search(vec, 1);

        let status: FileSignature['status'] = 'unique';
        let distance: number | undefined;

        if (results.length > 0) {
            const best = results[0];
            distance = best.distance;

            if (distance === 0) {
                status = 'duplicate';
            } else if (distance <= 5) {
                status = 'similar';
            }
        }

        // Add to Index if Unique (or we want to track all versions)
        // For this demo, we add everything to show the library growing
        index.add(newId, vec);

        const newFile: FileSignature = {
            id: newId.toString(),
            name: `File_SCAN_${newId.toString().padStart(4, '0')}.dat`,
            hash: vec,
            displayHash: hashToHex(vec),
            timestamp: Date.now(),
            status,
            distance
        };

        setFiles(prev => [newFile, ...prev]);
        setScannedCount(c => c + 1);

    }, [index, scannedCount, files]);

    const getStatusColor = (status: FileSignature['status']) => {
        switch (status) {
            case 'unique': return '#34C759'; // Green
            case 'duplicate': return '#FF3B30'; // Red
            case 'similar': return '#FF9500'; // Orange
        }
    };

    const renderItem = ({ item }: { item: FileSignature }) => (
        <GlassCard style={styles.fileCard}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <IconSymbol
                        name={item.status === 'unique' ? "checkmark.shield.fill" : item.status === 'duplicate' ? "exclamationmark.triangle.fill" : "doc.on.doc.fill"}
                        size={20}
                        color={getStatusColor(item.status)}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <ThemedText style={styles.fileName}>{item.name}</ThemedText>
                    <ThemedText style={styles.hashText}>{item.displayHash}</ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                        <ThemedText style={styles.badgeText}>{item.status.toUpperCase()}</ThemedText>
                    </View>
                    {item.distance !== undefined && item.status !== 'unique' && (
                        <ThemedText style={styles.distText}>Dist: {item.distance}</ThemedText>
                    )}
                </View>
            </View>
        </GlassCard>
    );

    if (!isReady) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={theme.tint} />
                <ThemedText style={{ marginTop: 20, opacity: 0.5 }}>Initializing Hamming Index...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <GlassCard style={styles.headerGlass}>
                    <IconSymbol size={42} name="doc.text.magnifyingglass" color={theme.text} style={{ opacity: 0.8 }} />
                    <ThemedText type="title" style={styles.title}>Deduplicator</ThemedText>
                    <ThemedText style={styles.subtitle}>
                        Hamming Metric • {simdBackend.toUpperCase()}
                    </ThemedText>
                </GlassCard>
            </View>

            <View style={styles.actionSection}>
                <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: theme.tint }]}
                    onPress={scanNewFile}
                    activeOpacity={0.8}
                >
                    <IconSymbol name="qrcode.viewfinder" size={24} color={isDark ? "#000" : "#FFF"} />
                    <ThemedText style={[styles.scanButtonText, { color: isDark ? '#000' : '#FFF' }]}>
                        SCAN NEW FILE
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <FlatList
                data={files}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    files.length > 0 ? <ThemedText style={styles.sectionLabel}>SCAN LOG ({files.length})</ThemedText> : null
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    headerGlass: { alignItems: 'center', paddingVertical: 24 },
    title: { marginTop: 12, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { marginTop: 4, opacity: 0.5, fontSize: 14 },

    actionSection: { paddingHorizontal: 20, marginBottom: 20 },
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    scanButtonText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },

    listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8E8E93',
        letterSpacing: 1.5,
        marginBottom: 8,
        marginLeft: 4
    },

    fileCard: { padding: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    fileName: { fontSize: 15, fontWeight: '700' },
    hashText: { fontSize: 10, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), opacity: 0.5, marginTop: 4 },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    distText: { fontSize: 9, opacity: 0.6, marginTop: 4, textAlign: 'right', fontWeight: '700' }
});
