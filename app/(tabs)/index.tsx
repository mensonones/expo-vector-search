import { Image } from 'expo-image';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { GlassCard } from '@/components/glass-card';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

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
        {/* Hero Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>v0.2.0</ThemedText>
          </View>
          <ThemedText type="title" style={styles.headerTitle}>Expo Vector Search</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            The next generation of on-device semantic intelligence.
          </ThemedText>
        </View>

        {/* Feature Cards */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>CORE CONCEPT</ThemedText>
          <GlassCard>
            <IconSymbol name="brain.fill" size={24} color={theme.tint} />
            <ThemedText type="subtitle" style={styles.cardTitle}>Beyond Keywords</ThemedText>
            <ThemedText style={styles.cardBody}>
              Traditional databases search for <ThemedText type="defaultSemiBold">exact matches</ThemedText>.
              Vector engines search for <ThemedText type="defaultSemiBold">intent and meaning</ThemedText>.
            </ThemedText>
          </GlassCard>
        </View>

        {/* Analogy Carousel-like list */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>INTUITIVE ANALOGIES</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            <GlassCard style={styles.carouselCard}>
              <IconSymbol name="book.fill" size={24} color="#FF9F0A" />
              <ThemedText type="defaultSemiBold" style={styles.analogyTitle}>The Librarian</ThemedText>
              <ThemedText style={styles.analogyText}>
                Finds &quot;books about hot celestial bodies&quot; even if the title doesn&apos;t say &quot;Sun&quot;.
              </ThemedText>
            </GlassCard>

            <GlassCard style={styles.carouselCard}>
              <IconSymbol name="music.note" size={24} color="#AF52DE" />
              <ThemedText type="defaultSemiBold" style={styles.analogyTitle}>Music Curator</ThemedText>
              <ThemedText style={styles.analogyText}>
                Matches the &quot;melancholy vibe&quot; of a song across different genres.
              </ThemedText>
            </GlassCard>

            <GlassCard style={styles.carouselCard}>
              <IconSymbol name="cart.fill" size={24} color="#32ADE6" />
              <ThemedText type="defaultSemiBold" style={styles.analogyTitle}>Personal Shopper</ThemedText>
              <ThemedText style={styles.analogyText}>
                Matches your photo to a specific floral pattern in the inventory.
              </ThemedText>
            </GlassCard>
          </ScrollView>
        </View>

        {/* Use Cases */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>REAL-WORLD POWERS</ThemedText>

          <FeatureItem
            icon="photo.stack"
            title="Intelligent Gallery"
            description="Find 'sunset at the beach' without any manual tagging."
            color="#34C759"
          />
          <FeatureItem
            icon="shield.lefthalf.filled"
            title="Smarter Moderation"
            description="Detect toxic intent, even with clever misspellings."
            color="#FF3B30"
          />
          <FeatureItem
            icon="cpu"
            title="Offline Local RAG"
            description="Private AI knowledge bases directly on the device."
            color="#5856D6"
          />
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <View style={styles.divider} />
          <ThemedText style={styles.footerText}>
            Powered by USearch (C++ JSI). 100% On-Device.
          </ThemedText>
          <ThemedText style={styles.footerDetail}>
            10k items indexed in &lt;1ms. Zero-copy JSI architecture.
          </ThemedText>
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

function FeatureItem({ icon, title, description, color }: any) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.iconContainer, { backgroundColor: color + '12' }]}>
        <IconSymbol name={icon} size={20} color={color} />
      </View>
      <View style={styles.featureContent}>
        <ThemedText type="defaultSemiBold" style={styles.featureTitle}>{title}</ThemedText>
        <ThemedText style={styles.featureDescription}>{description}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    height: '100%',
    width: '100%',
  },
  contentContainer: {
    padding: 24,
    gap: 32,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 2.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  glassCardContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.04,
        shadowRadius: 20,
      },
      android: {
        elevation: 0,
      }
    })
  },
  glassCardInner: {
    width: '100%',
  },
  glassCardContent: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 28,
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  cardBody: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
    fontWeight: '400',
  },
  carousel: {
    gap: 16,
    paddingRight: 24,
  },
  carouselCard: {
    width: 260,
  },
  analogyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  analogyText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    fontWeight: '400',
  },
  featureItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 6,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    opacity: 0.5,
    lineHeight: 18,
  },
  footer: {
    marginTop: 24,
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
  footerDetail: {
    fontSize: 10,
    opacity: 0.2,
  }
});
