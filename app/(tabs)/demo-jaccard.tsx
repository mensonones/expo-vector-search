import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

// List of available skills (tags)
const SKILLS = [
    'React',
    'TypeScript',
    'Node.js',
    'Python',
    'C++',
    'Rust',
    'Swift',
    'Kotlin',
    'SQL',
    'GraphQL',
    'Docker',
    'AWS',
];

const SKILL_COUNT = SKILLS.length;

type Candidate = {
    id: number;
    name: string;
    role: string;
    skills: Float32Array; // Binary vector: 1 = has skill, 0 = missing
    skillIndices: number[]; // Helper for UI
    matchScore?: number; // 1 - Jaccard Distance
    distance?: number;
};

// Mock Data Generation
const NAMES = [
    'Alice Engineer',
    'Bob Builder',
    'Charlie Coder',
    'Diana Dev',
    'Evan Expert',
    'Fiona Fullstack',
    'George Guru',
    'Hannah Hacker',
];

const ROLES = [
    'Senior Frontend',
    'Backend Lead',
    'Systems Architect',
    'Mobile Dev',
    'DevOps Engineer',
];

const generateCandidates = (count: number): Candidate[] => {
    return Array.from({ length: count }).map((_, i) => {
        const vector = new Float32Array(SKILL_COUNT).fill(0);
        const skillIndices: number[] = [];
        const skillCount = 3 + Math.floor(Math.random() * 5); // 3-7 skills per person

        for (let k = 0; k < skillCount; k++) {
            const skillIdx = Math.floor(Math.random() * SKILL_COUNT);
            if (vector[skillIdx] === 0) {
                vector[skillIdx] = 1;
                skillIndices.push(skillIdx);
            }
        }

        return {
            id: i + 1,
            name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${i}` : ''),
            role: ROLES[i % ROLES.length],
            skills: vector,
            skillIndices,
        };
    });
};

export default function DemoJaccardScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const isDark = colorScheme === 'dark';

    const [index, setIndex] = useState<VectorIndex | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
    const [searchResults, setSearchResults] = useState<Candidate[]>([]);
    const [candidates] = useState<Candidate[]>(() => generateCandidates(20));

    // Initialize Jaccard Index
    useEffect(() => {
        setTimeout(() => {
            // Jaccard Metric handles binary vectors (sets) natively
            const idx = new VectorIndex(SKILL_COUNT, { metric: 'jaccard' });

            // Index all candidates
            candidates.forEach((c) => {
                idx.add(c.id, c.skills);
            });

            setIndex(idx);
            setIsReady(true);

            // Select some defaults to show initial state
            toggleSkill(0); // React
            toggleSkill(1); // TS
        }, 500);
    }, []);

    // Real-time Search when selection changes
    useEffect(() => {
        if (!index || selectedSkills.size === 0) {
            setSearchResults([]);
            return;
        }

        // specific timeout to wait for React state/render cycle not needed, 
        // but useful if we add debounce. For now, instant.

        // Construct Query Vector
        const queryVec = new Float32Array(SKILL_COUNT).fill(0);
        selectedSkills.forEach((idx) => {
            queryVec[idx] = 1;
        });

        // Search
        // Jaccard Distance = 1 - (Intersection / Union)
        // Lower distance = Higher Similarity
        const results = index.search(queryVec, 20);

        const mappedResults = results
            .map((res) => {
                const candidate = candidates.find((c) => c.id === res.key);
                if (!candidate) return null;
                return {
                    ...candidate,
                    distance: res.distance,
                    matchScore: Math.max(0, 1 - res.distance), // Convert distance to similarity score
                };
            })
            .filter((c) => c !== null) as Candidate[];

        setSearchResults(mappedResults);
    }, [selectedSkills, index]);

    const toggleSkill = (idx: number) => {
        Haptics.selectionAsync();
        setSelectedSkills((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const renderCandidate = ({ item }: { item: Candidate }) => {
        const score = Math.round((item.matchScore ?? 0) * 100);
        const scoreColor = score > 75 ? '#34C759' : score > 40 ? '#FF9500' : '#FF3B30';

        return (
            <GlassCard style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                        <ThemedText style={styles.avatarText}>{item.name.charAt(0)}</ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                        <ThemedText style={styles.name}>{item.name}</ThemedText>
                        <ThemedText style={styles.role}>{item.role}</ThemedText>
                    </View>
                    <View style={styles.scoreBox}>
                        <ThemedText style={[styles.scoreVal, { color: scoreColor }]}>{score}%</ThemedText>
                        <ThemedText style={styles.scoreLabel}>MATCH</ThemedText>
                    </View>
                </View>

                <View style={styles.skillRow}>
                    {item.skillIndices.map((sIdx) => {
                        const isMatch = selectedSkills.has(sIdx);
                        return (
                            <View
                                key={sIdx}
                                style={[
                                    styles.skillTag,
                                    isMatch ? { backgroundColor: theme.tint } : { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }
                                ]}
                            >
                                <ThemedText
                                    style={[
                                        styles.skillText,
                                        isMatch ? { color: '#FFF' } : { color: theme.text, opacity: 0.7 }
                                    ]}
                                >
                                    {SKILLS[sIdx]}
                                </ThemedText>
                            </View>
                        );
                    })}
                </View>
            </GlassCard>
        );
    };

    if (!isReady) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={theme.tint} />
                <ThemedText style={{ marginTop: 20, opacity: 0.5 }}>Indexing Candidates...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <GlassCard style={styles.headerGlass}>
                    <View style={styles.headerRow}>
                        <IconSymbol size={32} name="person.2.crop.square.stack.fill" color={theme.text} />
                        <View>
                            <ThemedText type="title" style={styles.title}>Skill Matcher</ThemedText>
                            <ThemedText style={styles.subtitle}>Jaccard Set Similarity</ThemedText>
                        </View>
                    </View>
                </GlassCard>
            </View>

            <View style={styles.configSection}>
                <ThemedText style={styles.sectionLabel}>REQUIRED SKILLS</ThemedText>
                <View style={styles.chipContainer}>
                    {SKILLS.map((skill, idx) => {
                        const isSelected = selectedSkills.has(idx);
                        return (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.chip,
                                    isSelected ? { backgroundColor: theme.tint, borderColor: theme.tint } : { borderColor: isDark ? '#3A3A3C' : '#C7C7CC' }
                                ]}
                                onPress={() => toggleSkill(idx)}
                                activeOpacity={0.7}
                            >
                                <ThemedText style={[styles.chipText, isSelected && { color: '#FFF', fontWeight: '700' }]}>
                                    {skill}
                                </ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderCandidate}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <ThemedText style={styles.sectionLabel}>TOP CANDIDATES ({searchResults.length})</ThemedText>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 16 },
    headerGlass: { padding: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    title: { fontSize: 22, fontWeight: '900' },
    subtitle: { opacity: 0.6, fontSize: 13 },

    configSection: { paddingHorizontal: 20, marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '700', opacity: 0.5, marginBottom: 8, letterSpacing: 1 },

    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: { fontSize: 13 },

    listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },

    card: { padding: 16, gap: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(120,120,128,0.1)', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '800', opacity: 0.7 },
    name: { fontSize: 16, fontWeight: '700' },
    role: { fontSize: 13, opacity: 0.6 },

    scoreBox: { alignItems: 'flex-end' },
    scoreVal: { fontSize: 18, fontWeight: '900' },
    scoreLabel: { fontSize: 9, opacity: 0.5, fontWeight: '700' },

    skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    skillTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    skillText: { fontSize: 10, fontWeight: '600' }
});

