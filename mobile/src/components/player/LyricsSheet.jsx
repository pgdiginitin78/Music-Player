import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CloseIcon, MusicIcon, RefreshIcon } from '../icons/Icons.jsx';
import { fetchLyrics } from '../../services/lyricsService.js';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

export default function LyricsSheet({ isOpen, onClose, currentSong, theme }) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [found, setFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchAbortRef = useRef(null);

  const loadLyrics = async () => {
    if (!currentSong) return;

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setLyrics(null);
    setFound(false);
    setErrorMessage(null);

    try {
      const data = await fetchLyrics(currentSong, controller.signal);
      if (controller.signal.aborted) return;

      if (data.success && data.found && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
        setLyrics(data.lyrics);
        setFound(true);
      } else if (data.success && !data.found) {
        setFound(false);
        setLyrics(null);
      } else {
        setErrorMessage(data.message || 'Unable to load lyrics');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[LYRICS SHEET] Error:', err.message);
      setErrorMessage('Unable to load lyrics');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();

      if (currentSong) loadLyrics();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
    };
  }, [isOpen, currentSong?.id || currentSong?.youtubeVideoId || currentSong?.title]);

  if (!currentSong) return null;

  const thumbnailUri = currentSong.coverImage;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={styles.headerImage}
              />
            ) : (
              <View style={[styles.headerImage, styles.headerPlaceholder]}>
                <MusicIcon size={20} color="#a78bfa" />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {currentSong.title}
              </Text>
              <Text style={styles.headerArtist} numberOfLines={1}>
                {currentSong.artist}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CloseIcon size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme?.accent || '#c4b5fd'} />
            <Text style={styles.loadingText}>Loading lyrics...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              onPress={loadLyrics}
              style={[styles.retryButton, { backgroundColor: theme?.primary || '#7c3aed' }]}
            >
              <RefreshIcon size={16} color="#ffffff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !found || !lyrics || lyrics.length === 0 ? (
          <View style={styles.centerContainer}>
            <MusicIcon size={44} color="rgba(255,255,255,0.2)" />
            <Text style={styles.unavailableTitle}>Lyrics unavailable for this song</Text>
            <Text style={styles.unavailableSubtitle}>
              We couldn't find verified lyrics for "{currentSong.title}".
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.lyricsContent}
            showsVerticalScrollIndicator={false}
          >
            {lyrics.map((line, idx) => (
              <Text key={idx} style={styles.lyricLine}>
                {line}
              </Text>
            ))}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>Verified Song Lyrics</Text>
          <Text style={styles.footerRight}>Audio Engine</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: 'rgba(17, 17, 27, 0.97)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerImage: {
    width: 46,
    height: 46,
    borderRadius: 10,
    marginRight: 12,
  },
  headerPlaceholder: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerArtist: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  errorText: {
    color: '#f87171',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  unavailableTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  unavailableSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
  },
  scrollView: {
    flex: 1,
  },
  lyricsContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 14,
  },
  lyricLine: {
    fontSize: 16,
    fontWeight: '500',
    color: '#e5e7eb',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerLeft: {
    fontSize: 11,
    color: '#6b7280',
  },
  footerRight: {
    fontSize: 11,
    color: '#a78bfa',
    fontFamily: 'monospace',
  },
});
