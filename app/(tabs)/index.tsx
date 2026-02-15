import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { VectorIndex } from 'expo-vector-search';
import { useEffect, useState } from 'react';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const [simdBackend, setSimdBackend] = useState<string>('checking...');

  useEffect(() => {
    try {
      const idx = new VectorIndex(1);
      setSimdBackend(idx.isa || 'unknown');
      // We don't necessarily need to delete() for this tiny check,
      // but good practice if we were allocating strictly.
      // idx.delete();
    } catch (e) {
      setSimdBackend('n/a');
    }
  }, []);

  const SectionCard = ({ title, icon, children, accentColor }: { title: string; icon: string; children: React.ReactNode; accentColor?: string }) => (
    <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
      <View style={[styles.sectionHeader, accentColor ? { borderLeftColor: accentColor } : null]}>
        <IconSymbol name={icon as any} size={16} color={accentColor || theme.icon} />
        <ThemedText style={[styles.sectionTitle, accentColor ? { color: accentColor } : null]}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/hero_modern.jpg')}
          style={styles.heroImage}
        />
      }>

      <ThemedView style={styles.contentContainer}>
        {/* Header Section */}
        <View style={styles.titleSection}>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>v0.5.1 • {simdBackend.toUpperCase()}</ThemedText>
          </View>
          <ThemedText type="title" style={styles.headerTitle}>Distance Metrics</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Understanding how vector search engines measure similarity.
          </ThemedText>
        </View>

        {/* Introduction */}
        <View style={styles.section}>
          <ThemedText style={styles.introText}>
            The choice of distance metric fundamentally changes how &quot;similarity&quot; is defined.
            Select the metric that matches your data type and use case.
          </ThemedText>
        </View>

        {/* L2 Squared Card */}
        <SectionCard title="EUCIDEAN DISTANCE (L2)" icon="ruler.fill" accentColor="#32D74B">
          <ThemedText style={styles.metricDesc}>
            Measures the straight-line distance between two points in space.
          </ThemedText>
          <View style={styles.useCaseBox}>
            <ThemedText type="defaultSemiBold" style={styles.useCaseTitle}>BEST FOR:</ThemedText>
            <ThemedText style={styles.useCaseText}>• Geolocation (finding nearest coffee shop)</ThemedText>
            <ThemedText style={styles.useCaseText}>• Computer Vision (color matching)</ThemedText>
            <ThemedText style={styles.useCaseText}>• Physical dimensions comparison</ThemedText>
          </View>
          <View style={[styles.technicalTag, { backgroundColor: '#32D74B20' }]}>
            <ThemedText style={[styles.technicalText, { color: '#32D74B' }]}>CODE: l2sq</ThemedText>
          </View>
        </SectionCard>

        {/* Cosine Card */}
        <SectionCard title="COSINE SIMILARITY" icon="arrow.triangle.branch" accentColor="#FF9500">
          <ThemedText style={styles.metricDesc}>
            Measures the cosine of the angle between two vectors. Focuses on orientation, not magnitude.
          </ThemedText>
          <View style={styles.useCaseBox}>
            <ThemedText type="defaultSemiBold" style={styles.useCaseTitle}>BEST FOR:</ThemedText>
            <ThemedText style={styles.useCaseText}>• NLP & Text Embeddings (LLMs)</ThemedText>
            <ThemedText style={styles.useCaseText}>• Semantic Search</ThemedText>
            <ThemedText style={styles.useCaseText}>• Document Classification</ThemedText>
          </View>
          <View style={[styles.technicalTag, { backgroundColor: '#FF950020' }]}>
            <ThemedText style={[styles.technicalText, { color: '#FF9500' }]}>CODE: cos</ThemedText>
          </View>
        </SectionCard>

        {/* Inner Product Card */}
        <SectionCard title="INNER PRODUCT" icon="dot.square.fill" accentColor="#00C7BE">
          <ThemedText style={styles.metricDesc}>
            Projection of one vector onto another. Magnitude and angle both matter.
          </ThemedText>
          <View style={styles.useCaseBox}>
            <ThemedText type="defaultSemiBold" style={styles.useCaseTitle}>BEST FOR:</ThemedText>
            <ThemedText style={styles.useCaseText}>• Recommender Systems</ThemedText>
            <ThemedText style={styles.useCaseText}>• Matrix Factorization</ThemedText>
            <ThemedText style={styles.useCaseText}>• User-Item Interaction Scoring</ThemedText>
          </View>
          <View style={[styles.technicalTag, { backgroundColor: '#00C7BE20' }]}>
            <ThemedText style={[styles.technicalText, { color: '#00C7BE' }]}>CODE: ip</ThemedText>
          </View>
        </SectionCard>

        {/* Hamming Card */}
        <SectionCard title="HAMMING DISTANCE" icon="cpu" accentColor="#AF52DE">
          <ThemedText style={styles.metricDesc}>
            Counts the number of positions at which the corresponding bits are different.
          </ThemedText>
          <View style={styles.useCaseBox}>
            <ThemedText type="defaultSemiBold" style={styles.useCaseTitle}>BEST FOR:</ThemedText>
            <ThemedText style={styles.useCaseText}>• Binary Vectors / Hashing</ThemedText>
            <ThemedText style={styles.useCaseText}>• Duplicate Detection (Perceptual Hash)</ThemedText>
            <ThemedText style={styles.useCaseText}>• Gene Sequence Comparison</ThemedText>
          </View>
          <View style={[styles.technicalTag, { backgroundColor: '#AF52DE20' }]}>
            <ThemedText style={[styles.technicalText, { color: '#AF52DE' }]}>CODE: hamming</ThemedText>
          </View>
        </SectionCard>

        {/* Jaccard Card */}
        <SectionCard title="JACCARD INDEX" icon="chart.pie.fill" accentColor="#5856D6">
          <ThemedText style={styles.metricDesc}>
            Measures similarity between finite sample sets (Intersection over Union).
          </ThemedText>
          <View style={styles.useCaseBox}>
            <ThemedText type="defaultSemiBold" style={styles.useCaseTitle}>BEST FOR:</ThemedText>
            <ThemedText style={styles.useCaseText}>• Recommendation Engines (Product Sets)</ThemedText>
            <ThemedText style={styles.useCaseText}>• Object Detection (Bounding Boxes)</ThemedText>
            <ThemedText style={styles.useCaseText}>• Molecular Fingerprinting</ThemedText>
          </View>
          <View style={[styles.technicalTag, { backgroundColor: '#5856D620' }]}>
            <ThemedText style={[styles.technicalText, { color: '#5856D6' }]}>CODE: jaccard</ThemedText>
          </View>
        </SectionCard>

        {/* Footer info */}
        <View style={styles.footer}>
          <View style={styles.divider} />
          <ThemedText style={styles.footerText}>
            Powered by USearch (C++ JSI).
          </ThemedText>
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    height: '100%',
    width: '100%',
  },
  contentContainer: {
    padding: 24,
    gap: 24,
    paddingBottom: 60,
  },
  titleSection: {
    marginTop: 8,
  },
  badge: {
    backgroundColor: '#007AFF12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    color: '#007AFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 17,
    opacity: 0.5,
    marginTop: 8,
    lineHeight: 24,
    fontWeight: '400',
  },
  section: {
    gap: 16,
  },
  introText: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  metricDesc: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
  useCaseBox: {
    backgroundColor: 'rgba(120,120,128,0.06)',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  useCaseTitle: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  useCaseText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },
  technicalTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  technicalText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
  },


  footer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    height: 1,
    width: 40,
    backgroundColor: '#8E8E93',
    opacity: 0.1,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.4,
  },
});
