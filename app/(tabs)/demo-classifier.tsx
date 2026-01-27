import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const VEC_DIM = 64;

type Category = 'Financial' | 'Technical' | 'Sales';

type Ticket = {
    id: number;
    text: string;
    vector: Float32Array;
    predictedCategory?: Category;
    confidence?: number;
};

const CLUSTERS: Record<Category, Float32Array> = {
    'Financial': new Float32Array(VEC_DIM),
    'Technical': new Float32Array(VEC_DIM),
    'Sales': new Float32Array(VEC_DIM),
};

const SAMPLE_TEXTS: Record<Category, string[]> = {
    'Financial': [
        "Credit card billing error",
        "Requesting a refund for my invoice",
        "Invoice not issued",
        "Question about the annual plan",
        "Duplicate payment in the system"
    ],
    'Technical': [
        "App crashes on startup",
        "I can't log in",
        "White screen after update",
        "500 error when saving data",
        "Slow loading times"
    ],
    'Sales': [
        "I want to hire for my company",
        "What is the price for 50 users?",
        "I'd like a product demo",
        "Do you offer discounts for NGOs?",
        "Enterprise plan upgrade"
    ]
};

export default function DemoClassifierScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const isDark = colorScheme === 'dark';

    const [isReady, setIsReady] = useState(false);
    const [index, setIndex] = useState<VectorIndex | null>(null);
    const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
    const [history, setHistory] = useState<Ticket[]>([]);

    const initClassifier = useCallback(() => {
        const idx = new VectorIndex(VEC_DIM);
        const chunk = Math.floor(VEC_DIM / 3);

        fillVector(CLUSTERS['Financial'], 0, chunk);
        fillVector(CLUSTERS['Technical'], chunk, chunk * 2);
        fillVector(CLUSTERS['Sales'], chunk * 2, VEC_DIM);

        idx.add(1, CLUSTERS['Financial']);
        idx.add(2, CLUSTERS['Technical']);
        idx.add(3, CLUSTERS['Sales']);

        setIndex(idx);
        setIsReady(true);
    }, []);

    useEffect(() => {
        setTimeout(initClassifier, 500);
    }, [initClassifier]);

    const fillVector = (vec: Float32Array, start: number, end: number) => {
        for (let i = 0; i < VEC_DIM; i++) {
            if (i >= start && i < end) {
                vec[i] = 0.8 + Math.random() * 0.2;
            } else {
                vec[i] = Math.random() * 0.1;
            }
        }
    };

    const generateTicket = () => {
        if (!index) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const cats: Category[] = ['Financial', 'Technical', 'Sales'];
        const trueCat = cats[Math.floor(Math.random() * cats.length)];
        const texts = SAMPLE_TEXTS[trueCat];
        const text = texts[Math.floor(Math.random() * texts.length)];

        const vec = new Float32Array(VEC_DIM);
        const base = CLUSTERS[trueCat];
        for (let i = 0; i < VEC_DIM; i++) {
            vec[i] = base[i] + (Math.random() * 0.4 - 0.2);
        }

        const ticket: Ticket = { id: Date.now(), text, vector: vec };
        setCurrentTicket(ticket);
        classifyTicket(ticket, index);
    };

    const classifyTicket = (ticket: Ticket, idx: VectorIndex) => {
        const results = idx.search(ticket.vector, 1);

        if (results.length > 0) {
            const best = results[0];
            let cat: Category = 'Financial';
            if (best.key === 2) cat = 'Technical';
            if (best.key === 3) cat = 'Sales';

            const confidence = Math.max(0, 1 - best.distance) * 100;
            const classifiedTicket = { ...ticket, predictedCategory: cat, confidence };

            setCurrentTicket(classifiedTicket);
            setHistory(prev => [classifiedTicket, ...prev].slice(0, 10));
        }
    };

    const getCategoryColor = (cat?: Category) => {
        switch (cat) {
            case 'Financial': return '#34C759';
            case 'Technical': return '#007AFF';
            case 'Sales': return '#FF9500';
            default: return '#8E8E93';
        }
    };

    if (!isReady) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={theme.tint} />
                <ThemedText style={{ marginTop: 20, opacity: 0.5 }}>Configuring neural weights...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <GlassCard style={styles.headerGlass}>
                        <IconSymbol size={42} name="tag.fill" color={theme.text} style={{ opacity: 0.8 }} />
                        <ThemedText type="title" style={styles.title}>Smart Classifier</ThemedText>
                        <ThemedText style={styles.subtitle}>
                            Autonomous ticket triaging via semantics.
                        </ThemedText>
                    </GlassCard>
                </View>

                {/* Generator Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.tint }]}
                        onPress={generateTicket}
                        activeOpacity={0.8}
                    >
                        <ThemedText style={[styles.buttonText, { color: isDark ? '#000' : '#FFF' }]}>
                            INCOMING TICKET
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Current Ticket Result */}
                {currentTicket && (
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionLabel}>ANALYSIS RESULT</ThemedText>
                        <GlassCard style={[styles.resultCard, { borderColor: getCategoryColor(currentTicket.predictedCategory) + '40' }]}>
                            <ThemedText style={styles.label}>Signal Detected:</ThemedText>
                            <ThemedText style={styles.ticketText}>&quot;{currentTicket.text}&quot;</ThemedText>

                            <View style={styles.divider} />

                            <View style={styles.predictionRow}>
                                <View>
                                    <ThemedText style={styles.label}>Classification:</ThemedText>
                                    <ThemedText style={[styles.categoryText, { color: getCategoryColor(currentTicket.predictedCategory) }]}>
                                        {currentTicket.predictedCategory?.toUpperCase()}
                                    </ThemedText>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <ThemedText style={styles.label}>Probability:</ThemedText>
                                    <View style={styles.probContainer}>
                                        <ThemedText style={styles.confidenceText}>
                                            {currentTicket.confidence?.toFixed(1)}%
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        </GlassCard>
                    </View>
                )}

                {/* History */}
                {history.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionLabel}>RECENT COGNITION HISTORY</ThemedText>
                        <View style={styles.historyList}>
                            {history.map((h) => (
                                <GlassCard key={h.id} style={styles.historyItemCard}>
                                    <View style={[styles.statusDot, { backgroundColor: getCategoryColor(h.predictedCategory) }]} />
                                    <ThemedText numberOfLines={1} style={styles.historyHistoryText}>{h.text}</ThemedText>
                                    <ThemedText style={[styles.historyCatText, { color: getCategoryColor(h.predictedCategory) }]}>
                                        {h.predictedCategory}
                                    </ThemedText>
                                </GlassCard>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingTop: 60, gap: 32, paddingBottom: 60 },
    header: { marginBottom: 10 },
    headerGlass: { alignItems: 'center', paddingVertical: 32 },
    title: { marginTop: 16, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { marginTop: 6, opacity: 0.5, textAlign: 'center', fontSize: 16, lineHeight: 22 },

    section: { gap: 12 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8E8E93',
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        marginBottom: 4,
    },

    actionButton: {
        paddingVertical: 20,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.1,
                shadowRadius: 16,
            },
            android: { elevation: 4 }
        })
    },
    buttonText: { fontWeight: '900', fontSize: 16, letterSpacing: 1.5 },

    resultCard: { borderLeftWidth: 4 },
    label: { color: '#8E8E93', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
    ticketText: { fontSize: 18, fontStyle: 'italic', marginBottom: 20, fontWeight: '400', lineHeight: 26 },
    divider: { height: 1, backgroundColor: 'rgba(142, 142, 147, 0.1)', marginBottom: 20 },
    predictionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    categoryText: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    probContainer: { backgroundColor: 'rgba(142, 142, 147, 0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    confidenceText: { fontSize: 20, fontWeight: '800', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },

    historyList: { gap: 10 },
    historyItemCard: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 16 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    historyHistoryText: { flex: 1, fontSize: 14, fontWeight: '500', opacity: 0.7 },
    historyCatText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});
