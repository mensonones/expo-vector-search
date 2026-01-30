import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { VectorIndex } from 'expo-vector-search';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

// List of available skills (tags)
const SKILLS = [
    'React', 'TypeScript', 'Node.js', 'Python',
    'C++', 'Rust', 'Swift', 'Kotlin',
    'SQL', 'GraphQL', 'Docker', 'AWS',
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
    'Alice Engineer', 'Bob Builder', 'Charlie Coder', 'Diana Dev',
    'Evan Expert', 'Fiona Fullstack', 'George Guru', 'Hannah Hacker',
];

const ROLES = [
    'Senior Frontend', 'Backend Lead', 'Systems Architect',
    'Mobile Dev', 'DevOps Engineer',
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
            const idx = new VectorIndex(SKILL_COUNT, { metric: 'jaccard' });
            candidates.forEach((c) => idx.add(c.id, c.skills));
            setIndex(idx);
            setIsReady(true);

            // Set defaults
            const defaults = new Set<number>();
            defaults.add(0); // React
            defaults.add(1); // TS
            setSelectedSkills(defaults);
        }, 500);
    }, []);

    // Real-time Search
    useEffect(() => {
        if (!index || selectedSkills.size === 0) {
            setSearchResults([]);
            return;
        }

        const queryVec = new Float32Array(SKILL_COUNT).fill(0);
        selectedSkills.forEach((idx) => {
            queryVec[idx] = 1;
        });

        const results = index.search(queryVec, 20);

        const mappedResults = results
            .map((res) => {
                const candidate = candidates.find((c) => c.id === res.key);
                if (!candidate) return null;
                return {
                    ...candidate,
                    distance: res.distance,
                    matchScore: Math.max(0, 1 - res.distance),
                };
            })
            .filter((c) => c !== null) as Candidate[];

        setSearchResults(mappedResults);
    }, [selectedSkills, index]);

    const toggleSkill = (idx: number) => {
        Haptics.selectionAsync();
        setSelectedSkills((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    // --- UI Components Copied/Adapted from Debug Screen ---

    const SectionCard = ({ title, icon, children, accentColor }: { title: string; icon: string; children: React.ReactNode; accentColor?: string }) => (
        <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={[styles.sectionHeader, accentColor ? { borderLeftColor: accentColor } : null]}>
                <IconSymbol name={icon as any} size={16} color={accentColor || theme.icon} />
                <ThemedText style={[styles.sectionTitle, accentColor ? { color: accentColor } : null]}>{title}</ThemedText>
            </View>
            {children}
        </View>
    );

    const Pill = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.pill,
                active && { backgroundColor: theme.tint, borderColor: theme.tint },
                !active && { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }
            ]}
        >
            <ThemedText style={[
                styles.pillText,
                active ? { color: isDark ? '#000' : '#FFF' } : { color: theme.text }
            ]}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );

    const CandidateCard = ({ item }: { item: Candidate }) => {
        const score = Math.round((item.matchScore ?? 0) * 100);
        const scoreColor = score > 75 ? '#32D74B' : score > 40 ? '#FF9500' : '#FF453A';

        return (
            <View style={[styles.candidateCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF' }]}>
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
                                    isMatch ? { backgroundColor: theme.tint } : { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
                                ]}
                            >
                                <ThemedText
                                    style={[
                                        styles.skillText,
                                        isMatch ? { color: isDark ? '#000' : '#FFF' } : { color: theme.text, opacity: 0.7 }
                                    ]}
                                >
                                    {SKILLS[sIdx]}
                                </ThemedText>
                            </View>
                        );
                    })}
                </View>
            </View>
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
            {/* Blur Header like Debug Screen */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 0} tint={isDark ? 'dark' : 'light'} style={styles.headerGlass}>
                <View style={styles.headerTop}>
                    <View>
                        <ThemedText style={styles.headerTitle}>SKILL MATCH</ThemedText>
                        <ThemedText style={styles.headerSubtitle}>JACCARD RECRUITER</ThemedText>
                    </View>
                    <View style={styles.statusBadge}>
                        <IconSymbol name="chart.pie.fill" size={14} color="#5856D6" />
                        <ThemedText style={[styles.statusText, { color: '#5856D6' }]}>LIVE INDEX</ThemedText>
                    </View>
                </View>
            </BlurView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <SectionCard title="REQUIREMENTS" icon="gearshape.fill" accentColor="#5856D6">
                    <ThemedText style={styles.helperText}>
                        Select required skills to build the query set. Comparison uses Intersection over Union (IoU).
                    </ThemedText>
                    <View style={styles.pillRow}>
                        {SKILLS.map((skill, idx) => (
                            <Pill
                                key={idx}
                                label={skill}
                                active={selectedSkills.has(idx)}
                                onPress={() => toggleSkill(idx)}
                            />
                        ))}
                    </View>
                </SectionCard>

                <ThemedText style={styles.listLabel}>TOP CANDIDATES</ThemedText>

                {searchResults.map((candidate) => (
                    <CandidateCard key={candidate.id} item={candidate} />
                ))}

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(88, 86, 214, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },

    scrollContent: {
        padding: 16,
        paddingBottom: 120,
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
        marginTop: -4,
        marginBottom: 8,
        lineHeight: 18,
    },

    pillRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
    },

    listLabel: {
        fontSize: 11,
        fontWeight: '700',
        opacity: 0.5,
        letterSpacing: 1.5,
        marginTop: 8,
        marginLeft: 8,
    },

    candidateCard: {
        borderRadius: 16,
        padding: 16,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(120,120,128,0.1)',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(120,120,128,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    avatarText: { fontSize: 18, fontWeight: '800', opacity: 0.7 },
    name: { fontSize: 16, fontWeight: '700' },
    role: { fontSize: 13, opacity: 0.6 },

    scoreBox: { alignItems: 'flex-end', minWidth: 60 },
    scoreVal: { fontSize: 18, fontWeight: '900', fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }) },
    scoreLabel: { fontSize: 9, opacity: 0.5, fontWeight: '700' },

    skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    skillTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    skillText: { fontSize: 10, fontWeight: '600' }
});
