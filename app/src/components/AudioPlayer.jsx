import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import colors from '../theme/colors';

// Pre-generate stable waveform heights once per component instance
// so they don't re-randomize on every render (prevents flickering)
const generateWaveform = () =>
  Array.from({ length: 12 }, () => 8 + Math.floor(Math.random() * 18));

const AudioPlayer = ({ audioUrl, isUser }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  // Stable waveform — generated once per mount, not per render
  const waveHeights = useMemo(() => generateWaveform(), [audioUrl]);

  // Unload sound when component unmounts OR audioUrl changes
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  // Reset player if the URL changes (different message)
  useEffect(() => {
    if (sound) {
      sound.unloadAsync().catch(() => {});
      setSound(null);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
  }, [audioUrl]);

  const handlePlayPause = async () => {
    if (isLoading || !audioUrl) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        setIsLoading(true);
        // Ensure audio mode is set for playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis || 0);
          setDuration(status.durationMillis || 0);
          if (status.didJustFinish) {
            setIsPlaying(false);
            newSound.setPositionAsync(0);
          }
        });

        setSound(newSound);
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('AudioPlayer error:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;
  const activeColor = isUser ? '#000000' : '#FFFFFF';
  const dimColor = isUser ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playButton, { borderColor: activeColor }]}
        onPress={handlePlayPause}
        disabled={isLoading}
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={activeColor} />
        ) : (
          <Text style={[styles.playIcon, { color: activeColor }]}>
            {isPlaying ? '⏸' : '▶'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Waveform with playback progress overlay */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {waveHeights.map((h, idx) => {
            const barProgress = (idx + 1) / waveHeights.length;
            const isActive = barProgress <= progress;
            return (
              <View
                key={idx}
                style={[
                  styles.waveBar,
                  {
                    height: h,
                    backgroundColor: isActive ? activeColor : dimColor,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.timeText, { color: dimColor }]}>
          {duration > 0
            ? `${formatTime(position)} / ${formatTime(duration)}`
            : '🎙 Voice'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minWidth: 180,
    maxWidth: 260,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  playIcon: {
    fontSize: 14,
    marginLeft: 2,
  },
  waveformContainer: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
    marginBottom: 3,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 3,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default AudioPlayer;
