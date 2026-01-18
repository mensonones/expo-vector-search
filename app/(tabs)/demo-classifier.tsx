import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const VEC_DIM = 64;

type Category = 'Financial' | 'Technical' | 'Sales';

type Ticket = {
    id: number;
    text: string;
    vector: Float32Array;
    predictedCategory?: Category;
    confidence?: number;
};

// Centroids for our simulated clusters
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

    const [isReady, setIsReady] = useState(false);
    const [index, setIndex] = useState<VectorIndex | null>(null);
    const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
    const [history, setHistory] = useState<Ticket[]>([]);

    useEffect(() => {
        setTimeout(initClassifier, 500);
    }, []);

    const initClassifier = () => {
        const idx = new VectorIndex(VEC_DIM);

        // 1. Initialize Cluster Centroids (randomly strictly separated)
        // Financial: Focus on first 1/3 of dim
        // Technical: Focus on second 1/3
        // Sales: Focus on last 1/3
        const chunk = Math.floor(VEC_DIM / 3);

        fillVector(CLUSTERS['Financial'], 0, chunk);
        fillVector(CLUSTERS['Technical'], chunk, chunk * 2);
        fillVector(CLUSTERS['Sales'], chunk * 2, VEC_DIM);

        // 2. Index the Centroids (These act as our "Knowledge Base")
        idx.add(1, CLUSTERS['Financial']); // ID 1 = Financial
        idx.add(2, CLUSTERS['Technical']); // ID 2 = Technical
        idx.add(3, CLUSTERS['Sales']);     // ID 3 = Sales

        setIndex(idx);
        setIsReady(true);
    };

    const fillVector = (vec: Float32Array, start: number, end: number) => {
        for (let i = 0; i < VEC_DIM; i++) {
            // High value in "sector", low noise elsewhere
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

        // Pick a ground truth category randomly
        const cats: Category[] = ['Financial', 'Technical', 'Sales'];
        const trueCat = cats[Math.floor(Math.random() * cats.length)];

        // Pick random text
        const texts = SAMPLE_TEXTS[trueCat];
        const text = texts[Math.floor(Math.random() * texts.length)];

        // Generate vector based on true category (add some noise to simulate reality)
        const vec = new Float32Array(VEC_DIM);
        const base = CLUSTERS[trueCat];
        for (let i = 0; i < VEC_DIM; i++) {
            vec[i] = base[i] + (Math.random() * 0.4 - 0.2); // +/- 0.2 noise
        }

        const ticket: Ticket = {
            id: Date.now(),
            text,
            vector: vec
        };

        setCurrentTicket(ticket);
        classifyTicket(ticket, index);
    };

    const classifyTicket = (ticket: Ticket, idx: VectorIndex) => {
        // Search for nearest centroid
        // We only have 3 items in index (the centroids), so k=1 gives the best match
        const start = performance.now();
        const results = idx.search(ticket.vector, 1);
        const end = performance.now();

        if (results.length > 0) {
            const best = results[0];
            let cat: Category = 'Financial';
            if (best.key === 2) cat = 'Technical';
            if (best.key === 3) cat = 'Sales';

            // Distance 0 = 100%, Distance 1+ = 0%
            // Simple confidence metric simulation
            const confidence = Math.max(0, 1 - best.distance) * 100;

            const classifiedTicket = {
                ...ticket,
                predictedCategory: cat,
                confidence
            };

            setCurrentTicket(classifiedTicket);
            setHistory(prev => [classifiedTicket, ...prev].slice(0, 10)); // Keep last 10
        }
    };

    const getCategoryColor = (cat?: Category) => {
        switch (cat) {
            case 'Financial': return '#34C759'; // Green
            case 'Technical': return '#007AFF'; // Blue
            case 'Sales': return '#FF9500'; // Orange
            default: return '#8E8E93'; // Gray
        }
    };

    if (!isReady) {
        return (
            <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
                <ActivityIndicator size="large" color={theme.tint} />
                <ThemedText>Training model...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.icon }]}>
                    <IconSymbol size={48} name="tag.fill" color={theme.text} />
                    <ThemedText type="title" style={styles.title}>Smart Classifier</ThemedText>
                    <ThemedText style={styles.subtitle}>
                        Automatic support ticket triaging using vector similarity.
                    </ThemedText>
                </View>

                {/* Generator Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.tint }]}
                        onPress={generateTicket}
                        activeOpacity={0.8}
                    >
                        <ThemedText style={styles.buttonText}>RECEIVE NEW TICKET</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Current Ticket Result */}
                {currentTicket && (
                    <View style={[styles.resultCard, { backgroundColor: '#1E1E1E', borderColor: getCategoryColor(currentTicket.predictedCategory), borderWidth: 2 }]}>
                        <ThemedText style={styles.label}>User Message:</ThemedText>
                        <ThemedText style={styles.ticketText}>"{currentTicket.text}"</ThemedText>

                        <View style={styles.divider} />

                        <View style={styles.predictionRow}>
                            <View>
                                <ThemedText style={styles.label}>Classification:</ThemedText>
                                <ThemedText style={[styles.categoryText, { color: getCategoryColor(currentTicket.predictedCategory) }]}>
                                    {currentTicket.predictedCategory?.toUpperCase()}
                                </ThemedText>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <ThemedText style={styles.label}>Confidence:</ThemedText>
                                <ThemedText style={styles.confidenceText}>
                                    {currentTicket.confidence?.toFixed(1)}%
                                </ThemedText>
                            </View>
                        </View>
                    </View>
                )}

                {/* History */}
                {history.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={{ marginBottom: 10 }}>Recent History</ThemedText>
                        {history.map((h) => (
                            <View key={h.id} style={[styles.historyItem, { borderLeftColor: getCategoryColor(h.predictedCategory) }]}>
                                <ThemedText numberOfLines={1} style={{ flex: 1, color: '#ccc' }}>{h.text}</ThemedText>
                                <ThemedText style={{ fontSize: 10, color: getCategoryColor(h.predictedCategory), fontWeight: 'bold' }}>
                                    {h.predictedCategory}
                                </ThemedText>
                            </View>
                        ))}
                    </View>
                )}


            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 60,
        gap: 30,
    },
    card: {
        alignItems: 'center',
        padding: 30,
        borderRadius: 20,
        borderWidth: 1,
        opacity: 0.9,
    },
    title: {
        marginTop: 15,
        fontSize: 24,
        color: '#fff',
        textAlign: 'center'
    },
    subtitle: {
        marginTop: 5,
        opacity: 0.7,
        textAlign: 'center',
        color: '#fff',
        fontSize: 14
    },
    section: {
        gap: 10,
    },
    actionButton: {
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 1,
    },
    resultCard: {
        padding: 20,
        borderRadius: 15,
    },
    label: {
        color: '#666',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    ticketText: {
        color: '#fff',
        fontSize: 16,
        fontStyle: 'italic',
        marginBottom: 15,
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginBottom: 15,
    },
    predictionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    categoryText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    confidenceText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    historyItem: {
        flexDirection: 'row',
        backgroundColor: '#1E1E1E',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        alignItems: 'center',
        gap: 10,
    },
});
