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
        <ThemedText type="subtitle">What is it?</ThemedText>
        <ThemedText>
          It's an ultra-fast vector search engine for React Native (C++ JSI). It allows you to store and search data based on <ThemedText type="defaultSemiBold">meaning</ThemedText>, not just keywords.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">🔎 Simple Analogy</ThemedText>
        <ThemedText>
          Imagine a library.
        </ThemedText>
        <ThemedText>
          <ThemedText type="defaultSemiBold">Standard Search (SQL):</ThemedText> You ask for a book with "Cat" in the title. The librarian only gives you books that have the exact word "Cat" on the cover.
        </ThemedText>
        <ThemedText>
          <ThemedText type="defaultSemiBold">Vector Search (This Demo):</ThemedText> You ask for "something about fluffy animals". The librarian understands the concept and brings you books about Cats, Dogs, and Rabbits, even if the word "fluffy" isn't in the title.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">🏠 Discover the Power</ThemedText>

        <ThemedText>
          <ThemedText type="defaultSemiBold">✨ Visual Search Tab:</ThemedText>
          {'\n'}Experience the "magic" of finding products by visual similarity. No keywords, just proximity in the vector space.
        </ThemedText>

        <ThemedText>
          <ThemedText type="defaultSemiBold">⚡ Performance Lab Tab:</ThemedText>
          {'\n'}See the benchmarks. Witness the raw speed of C++ JSI vs. traditional JavaScript loops.
        </ThemedText>

        <ThemedText>
          <ThemedText type="defaultSemiBold">🏷️ Classify Tab:</ThemedText>
          {'\n'}See how vector search can categorize text by intent and meaning instantly.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
          Technology: USearch (C++) & JSI. Runs 100% on your device, offline, processing 10k items in less than 1 millisecond.
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
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
