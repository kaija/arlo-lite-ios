/**
 * VoiceDictation — on-device speech-to-text component for chat input.
 *
 * Uses `expo-speech-recognition` for on-device STT via iOS SFSpeechRecognizer
 * and Android SpeechRecognizer.
 *
 * Features:
 * - Microphone button to start/stop recording
 * - Visual pulsing indicator while recording
 * - Interim and final transcription results
 * - Permission handling (microphone + speech recognition)
 * - Accessibility labels on all interactive elements
 *
 * Note: Requires an Expo dev client (not Expo Go) for native speech recognition.
 *
 * @module VoiceDictation
 * @requirement 13.3
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { useTheme, Theme } from '@/theme';

export interface VoiceDictationProps {
  /** Called with transcribed text (both interim and final results) */
  onTranscript: (text: string) => void;
  /** Called when a final transcription result is received */
  onFinalTranscript?: (text: string) => void;
  /** Whether the dictation button should be disabled */
  disabled?: boolean;
}

/**
 * Voice dictation button with recording state UI and speech-to-text transcription.
 * Integrates with expo-speech-recognition for on-device STT.
 */
export function VoiceDictation({
  onTranscript,
  onFinalTranscript,
  disabled = false,
}: VoiceDictationProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Start pulse animation when listening
  useEffect(() => {
    if (isListening) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }

    return () => {
      pulseRef.current?.stop();
    };
  }, [isListening, pulseAnim]);

  // Listen for recognition results
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript;
      onTranscript(transcript);
      if (event.isFinal && onFinalTranscript) {
        onFinalTranscript(transcript);
      }
    }
  });

  // Listen for errors
  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (event.error === 'not-allowed') {
      setHasPermission(false);
      showPermissionDeniedAlert();
    }
    // "no-speech" and "aborted" are not real errors from user perspective
  });

  // Listen for end event
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  const showPermissionDeniedAlert = useCallback(() => {
    Alert.alert(
      t('voiceDictation.permissionDeniedTitle'),
      t('voiceDictation.permissionDeniedMessage'),
      [{ text: t('common.confirm'), style: 'default' }],
    );
  }, [t]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    const granted = result.granted;
    setHasPermission(granted);
    return granted;
  }, []);

  const startListening = useCallback(async () => {
    // Check/request permissions first
    if (hasPermission === null || hasPermission === false) {
      const granted = await requestPermissions();
      if (!granted) {
        showPermissionDeniedAlert();
        return;
      }
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: Platform.select({ ios: 'en-US', default: 'en-US' }),
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
      });
      setIsListening(true);
    } catch {
      // If on-device recognition isn't available, try without that requirement
      try {
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: false,
          addsPunctuation: true,
        });
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  }, [hasPermission, requestPermissions, showPermissionDeniedAlert]);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  const handlePress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const buttonLabel = isListening
    ? t('voiceDictation.stopRecording')
    : t('accessibility.voiceInputButton');

  return (
    <View style={styles.container}>
      {isListening && (
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}
      <TouchableOpacity
        style={[
          styles.micButton,
          isListening && styles.micButtonActive,
          disabled && styles.micButtonDisabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isListening }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.micIcon,
            isListening && styles.micIconActive,
            disabled && styles.micIconDisabled,
          ]}
        >
          {isListening ? '\u25A0' : '\uD83C\uDF99'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  };

  const pulseRing: ViewStyle = {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.error,
    opacity: 0.3,
  };

  const micButton: ViewStyle = {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  };

  const micButtonActive: ViewStyle = {
    backgroundColor: theme.colors.error,
  };

  const micButtonDisabled: ViewStyle = {
    opacity: 0.4,
  };

  const micIcon: TextStyle = {
    fontSize: 14,
    color: theme.colors.textSecondary,
  };

  const micIconActive: TextStyle = {
    color: '#FFFFFF',
  };

  const micIconDisabled: TextStyle = {
    opacity: 0.4,
  };

  return StyleSheet.create({
    container,
    pulseRing,
    micButton,
    micButtonActive,
    micButtonDisabled,
    micIcon,
    micIconActive,
    micIconDisabled,
  });
}
