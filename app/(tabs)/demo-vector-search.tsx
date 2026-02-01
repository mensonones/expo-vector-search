import { Image } from 'expo-image';
import { VectorIndex } from 'expo-vector-search';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Product, useVectorCatalog } from '@/hooks/useVectorCatalog';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16 padding on sides + 16 gap
const ITEM_HEIGHT = COLUMN_WIDTH + 85; // Image + fixed content height

const ProductCard = React.memo(({ item, onPress, themeColors }: { item: Product; onPress: (p: Product) => void; themeColors: any }) => (
    <TouchableOpacity
        style={styles.gridCard}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
    >
        <View style={[styles.productItem, { backgroundColor: themeColors.background, borderColor: themeColors.icon + '20' }]}>
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: item.image ?? undefined }}
                    style={styles.productImage}
                    contentFit="cover"
                    transition={200}
                />
                {item._score !== undefined && (
                    <View style={styles.floatingMatch}>
                        <ThemedText style={styles.matchText}>
                            {((1 - item._score) * 100).toFixed(0)}%
                        </ThemedText>
                    </View>
                )}
            </View>
            <View style={styles.itemContent}>
                <ThemedText style={styles.productName} numberOfLines={1}>{item.name}</ThemedText>
                <ThemedText style={styles.categoryText}>{item.metadata.type}</ThemedText>
            </View>
        </View>
    </TouchableOpacity>
));
ProductCard.displayName = 'ProductCard';

export default function VectorSearchScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const themeColors = Colors[colorScheme];
    const isDark = colorScheme === 'dark';

    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [simdBackend, setSimdBackend] = useState<string>('-');

    useEffect(() => {
        try {
            const idx = new VectorIndex(1);
            setSimdBackend(idx.isa || 'unknown');
        } catch (e) {
            setSimdBackend('n/a');
        }
    }, []);

    const { isInitializing, loadedCount, allProductsRef, vectorIndex, progress } = useVectorCatalog();
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isInitializing && allProductsRef.current.length > 0 && searchTerm === '') {
            setResults(allProductsRef.current.slice(0, 20));
        }
    }, [isInitializing, searchTerm, allProductsRef]);

    const handleSearch = (text: string) => {
        setSearchTerm(text);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(() => {
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
        }, 300);
    };

    const findSimilar = React.useCallback(async (product: Product) => {
        if (!vectorIndex) return;
        setIsSearching(true);
        setSearchTerm(`Similar to: ${product.name}`);

        setTimeout(() => {
            requestAnimationFrame(() => {
                try {
                    let queryVector: Float32Array | null | undefined = null;
                    if (product.vector) queryVector = new Float32Array(product.vector);

                    if (!queryVector) {
                        const key = allProductsRef.current.indexOf(product);
                        if (key !== -1) queryVector = vectorIndex.getItemVector(key);
                    }

                    if (!queryVector) {
                        setResults([]);
                        setIsSearching(false);
                        return;
                    }

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
    }, [vectorIndex, allProductsRef]);

    const loadMore = () => {
        if (isSearching || searchTerm !== '') return;
        const currentLength = results.length;
        const total = allProductsRef.current.length;
        if (currentLength >= total) return;
        const nextBatch = allProductsRef.current.slice(currentLength, currentLength + 50);
        setResults(prev => [...prev, ...nextBatch]);
    };

    const renderItem = React.useCallback(({ item }: { item: Product }) => (
        <ProductCard item={item} onPress={findSimilar} themeColors={themeColors} />
    ), [findSimilar, themeColors]);

    const getItemLayout = React.useCallback((_: any, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * Math.floor(index / 2),
        index,
    }), []);

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>Visual Search</ThemedText>
                <ThemedText style={styles.subtitle}>
                    Find patterns • {simdBackend.toUpperCase()}
                </ThemedText>

                <View style={[styles.statsBadge, (isInitializing || vectorIndex?.isIndexing) && { backgroundColor: '#FF950015' }]}>
                    <IconSymbol
                        name={(isInitializing || vectorIndex?.isIndexing) ? "clock.fill" : "bolt.fill"}
                        size={12}
                        color={(isInitializing || vectorIndex?.isIndexing) ? "#FF9500" : "#007AFF"}
                    />
                    <ThemedText style={[styles.statsText, (isInitializing || vectorIndex?.isIndexing) && { color: '#FF9500' }]}>
                        {(isInitializing || vectorIndex?.isIndexing)
                            ? `INDEXING ${progress.toFixed(0)}%`
                            : `${loadedCount.toLocaleString()} ITEMS INDEXED`}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.searchBarWrapper}>
                <GlassCard style={styles.searchGlass}>
                    <View style={styles.searchInner}>
                        <IconSymbol name="magnifyingglass" size={18} color={isDark ? '#FFF' : '#000'} style={{ opacity: 0.5 }} />
                        <TextInput
                            style={[styles.searchInput, { color: themeColors.text }]}
                            placeholder="Try 'Red Sneakers' or 'Floral'..."
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                            value={searchTerm}
                            onChangeText={handleSearch}
                        />
                        {searchTerm.length > 0 && (
                            <TouchableOpacity onPress={() => handleSearch('')} hitSlop={10}>
                                <IconSymbol name="xmark.circle.fill" size={18} color={themeColors.icon} />
                            </TouchableOpacity>
                        )}
                    </View>
                </GlassCard>
            </View>

            {isInitializing && loadedCount < 9000 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="small" color={themeColors.tint} />
                    <ThemedText style={{ marginTop: 16, fontWeight: '700', fontSize: 18 }}>{progress.toFixed(0)}%</ThemedText>
                    <ThemedText style={{ marginTop: 8, opacity: 0.5 }}>Loading neural database...</ThemedText>
                </View>
            ) : (
                <FlatList
                    key="grid"
                    data={results}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    getItemLayout={getItemLayout}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={21}
                    removeClippedSubviews={false}
                    updateCellsBatchingPeriod={100}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <ThemedText style={{ opacity: 0.4 }}>No matches found</ThemedText>
                        </View>
                    }
                />
            )}

            {isSearching && (
                <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={themeColors.tint} />
                    <ThemedText style={styles.loadingText}>Analyzing visual patterns...</ThemedText>
                </BlurView>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    header: { paddingHorizontal: 24, marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { opacity: 0.5, fontSize: 16, marginTop: 4, lineHeight: 22 },
    statsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: '#007AFF10',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    statsText: { fontSize: 10, fontWeight: '800', marginLeft: 6, color: '#007AFF', letterSpacing: 1 },

    searchBarWrapper: { paddingHorizontal: 24, marginBottom: 24 },
    searchGlass: { padding: 0, borderRadius: 16 },
    searchInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '500' },

    listContent: { paddingHorizontal: 16, paddingBottom: 60, gap: 16 },
    columnWrapper: { justifyContent: 'space-between', gap: 16 },

    gridCard: { flex: 0.5, marginBottom: 8 },
    productItem: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
    imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: 'rgba(0,0,0,0.03)' },
    productImage: { width: '100%', height: '100%' },

    itemContent: { padding: 10, gap: 2 },
    productName: { fontSize: 13, fontWeight: '700' },
    categoryText: { fontSize: 10, opacity: 0.4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

    floatingMatch: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(52, 199, 89, 0.9)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6
    },
    matchText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    loadingText: { marginTop: 20, fontWeight: '700', fontSize: 16, opacity: 0.8 },
});
