import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Expo Vector Search</ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">What is Vector Search?</ThemedText>
        <ThemedText>
          Traditional databases search for <ThemedText type="defaultSemiBold">exact matches</ThemedText>. Vector search engines search for <ThemedText type="defaultSemiBold">semantic meaning</ThemedText>.
          By converting data (images, text, audio) into mathematical coordinates (vectors), we can find items that are "close" to each other in concept, not just in spelling.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">🔎 Intuitive Analogies</ThemedText>

        <ThemedView style={styles.analogyBox}>
          <ThemedText type="defaultSemiBold">📚 The Librarian</ThemedText>
          <ThemedText style={styles.analogyText}>
            Instead of searching for a book with "Sun" in the title, you ask for "something about hot celestial bodies." The librarian understands the <ThemedText type="defaultSemiBold">concept</ThemedText> and finds books about Stars, Galaxies, and Solar Energy.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.analogyBox}>
          <ThemedText type="defaultSemiBold">🎵 The Music Curator (Spotify)</ThemedText>
          <ThemedText style={styles.analogyText}>
            You like a song with a "heavy bass and melancholy vocals." Vector search finds other songs with a similar "vibe" even if they are from different genres or have different instruments.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.analogyBox}>
          <ThemedText type="defaultSemiBold">🛍️ The Personal Shopper</ThemedText>
          <ThemedText style={styles.analogyText}>
            You take a photo of a red dress with a specific floral pattern. The system finds "mathematically similar" clothes in the inventory instantly, without needing a human to tag them.
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">🚀 Real-World Examples</ThemedText>

        <ThemedText>
          <ThemedText type="defaultSemiBold">📸 Intelligent Gallery:</ThemedText> Find all your "sunset at the beach" photos without any manual tagging.
        </ThemedText>

        <ThemedText>
          <ThemedText type="defaultSemiBold">🛡️ Content Moderation:</ThemedText> Detect toxic messages or harmful images by their intent, even if they use clever misspellings.
        </ThemedText>

        <ThemedText>
          <ThemedText type="defaultSemiBold">🤖 Local RAG:</ThemedText> Provide private, offline AI knowledge bases for your users by searching through your own documentation locally.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
          Powered by USearch (C++ JSI). 100% On-Device. Processing 10k items in &lt;1ms.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  analogyBox: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#A1CEDC',
    marginBottom: 4,
  },
  analogyText: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
