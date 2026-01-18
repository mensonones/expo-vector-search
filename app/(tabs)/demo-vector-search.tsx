import { Image } from 'expo-image';
import { VectorIndex } from 'expo-vector-search';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import productChunks from '@/assets/chunks';

// Define the shape of our source data (Products)
type Product = {
    id: string;
    name: string;
    image: string | null;
    vector: number[];
    metadata: {
        type: string;
    };
    // Optional runtime property for filtered results
    _score?: number;
};

const VECTOR_DIMENSION = 768; // CLIP ViT-L/14

export default function VectorSearchScreen() {
    const colorScheme = useColorScheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);

    // Store all products in memory for display mapping
    const allProductsRef = useRef<Product[]>([]);

    // Memoize the vector index instance. We use f32 for maximum precision in the 'magic' demo.
    const vectorIndex = useMemo(() => new VectorIndex(VECTOR_DIMENSION, {
        quantization: 'f32'
    }), []);

    // Initialize the vector store on mount
    useEffect(() => {
        let isActive = true;

        async function init() {
            if (allProductsRef.current.length > 0) {
                if (vectorIndex.count === 0) {
                    allProductsRef.current.forEach((p, i) => {
                        if (p.vector && p.vector.length === VECTOR_DIMENSION) {
                            vectorIndex.add(i, new Float32Array(p.vector));
                        }
                    });
                }
                setLoadedCount(allProductsRef.current.length);
                setResults(allProductsRef.current.slice(0, 20));
                setIsInitializing(false);
                return;
            }

            try {
                let totalLoaded = 0;
                for (const chunk of productChunks) {
                    if (!isActive) break;
                    const products = chunk as unknown as Product[];

                    // Optimized insertion for the demo
                    products.forEach((product) => {
                        if (product.vector?.length === VECTOR_DIMENSION) {
                            vectorIndex.add(totalLoaded, new Float32Array(product.vector));
                            allProductsRef.current.push(product);
                            totalLoaded++;
                        }
                    });

                    if (isActive) setLoadedCount(totalLoaded);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } catch (e) {
                console.error('Failed to initialize vector store:', e);
            } finally {
                if (isActive) {
                    setIsInitializing(false);
                    setResults(allProductsRef.current.slice(0, 20));
                }
            }
        }

        const timer = setTimeout(init, 300);
        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [vectorIndex]);

    const handleSearch = (text: string) => {
        setSearchTerm(text);
        if (!text) {
            setResults(allProductsRef.current.slice(0, 20));
            return;
        }

        const lower = text.toLowerCase();
        const filtered = [];
        for (const p of allProductsRef.current) {
            if (p.name.toLowerCase().includes(lower)) {
                filtered.push(p);
                if (filtered.length >= 50) break;
            }
        }
        setResults(filtered);
    };

    const findSimilar = async (product: Product) => {
        if (!vectorIndex) return;

        setIsSearching(true);
        setSearchTerm(`Similar to: ${product.name}`);

        setTimeout(() => {
            requestAnimationFrame(() => {
                try {
                    const queryVector = new Float32Array(product.vector);
                    const searchResults = vectorIndex.search(queryVector, 50);

                    if (!searchResults || searchResults.length === 0) {
                        setResults([]);
                        return;
                    }

                    const similarProducts = searchResults
                        .map(result => {
                            const original = allProductsRef.current[result.key];
                            return original ? { ...original, _score: result.distance } : null;
                        })
                        .filter(item => item !== null) as Product[];

                    setResults(similarProducts);
                } catch (e) {
                    console.error('Vector search failed', e);
                } finally {
                    setIsSearching(false);
                }
            });
        }, 50);
    };

    const themeColors = Colors[colorScheme ?? 'light'];

    const loadMore = () => {
        if (isSearching || searchTerm !== '') return;
        const currentLength = results.length;
        const total = allProductsRef.current.length;
        if (currentLength >= total) return;

        const nextBatch = allProductsRef.current.slice(currentLength, currentLength + 50);
        setResults(prev => [...prev, ...nextBatch]);
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title">Visual Search</ThemedText>
                <ThemedText style={styles.subtitle}>
                    Find products based on visual patterns and metadata.
                </ThemedText>

                <View style={styles.statsRow}>
                    <IconSymbol name="bolt.fill" size={12} color={themeColors.tint} />
                    <ThemedText style={styles.statsText}>
                        Browsing {loadedCount.toLocaleString()} items instantly
                    </ThemedText>
                </View>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: themeColors.background, borderColor: themeColors.icon + '33' }]}>
                <IconSymbol name="magnifyingglass" size={18} color={themeColors.icon} />
                <TextInput
                    style={[styles.searchInput, { color: themeColors.text }]}
                    placeholder="Search catalog..."
                    placeholderTextColor="#888"
                    value={searchTerm}
                    onChangeText={handleSearch}
                />
                {searchTerm.length > 0 && (
                    <TouchableOpacity onPress={() => handleSearch('')} hitSlop={10}>
                        <IconSymbol name="xmark.circle.fill" size={18} color={themeColors.icon} />
                    </TouchableOpacity>
                )}
            </View>

            {isInitializing && loadedCount < 500 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="small" color={themeColors.tint} />
                    <ThemedText style={{ marginTop: 12, opacity: 0.6 }}>Indexing catalog...</ThemedText>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.item, { borderBottomColor: themeColors.icon + '15' }]}
                            onPress={() => findSimilar(item)}
                        >
                            <Image
                                source={{ uri: item.image ?? undefined }}
                                style={styles.productImage}
                                contentFit="cover"
                                transition={200}
                            />
                            <View style={styles.itemContent}>
                                <ThemedText type="defaultSemiBold" numberOfLines={1}>{item.name}</ThemedText>
                                <ThemedText style={styles.categoryText}>{item.metadata.type}</ThemedText>
                                {item._score !== undefined && (
                                    <View style={styles.matchBadge}>
                                        <ThemedText style={styles.matchText}>
                                            {((1 - item._score) * 100).toFixed(0)}% Match
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                            <IconSymbol name="chevron.right" size={16} color="#ccc" />
                        </TouchableOpacity>
                    )}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <ThemedText style={{ opacity: 0.5 }}>No items found in catalog.</ThemedText>
                        </View>
                    }
                />
            )}

            {isSearching && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <ThemedText style={{ color: '#fff', marginTop: 15, fontWeight: '600' }}>Finding similar items...</ThemedText>
                </View>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
    },
    header: {
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    subtitle: {
        opacity: 0.6,
        fontSize: 15,
        marginTop: 4,
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: 'rgba(0, 122, 255, 0.08)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statsText: {
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 6,
        color: '#007AFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 24,
        marginBottom: 24,
        paddingHorizontal: 12,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
    },
    itemContent: {
        flex: 1,
        marginLeft: 16,
    },
    categoryText: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    matchBadge: {
        marginTop: 6,
        backgroundColor: '#E8F5E9',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    matchText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#2E7D32',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
