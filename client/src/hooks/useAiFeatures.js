import { useState, useRef, useCallback, useEffect } from 'react';
import { speakText, stopSpeaking } from '@/services/aiClient';
import { generateContent } from '@/services/aiService';

export const useAiFeatures = () => {
  const [speakingState, setSpeakingState] = useState({
    id: null,
    text: "",
    offset: 0,
    charIndex: 0,
    charLength: 0,
  });
  const isCancellingRef = useRef(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const speechRate = parseFloat(localStorage.getItem("aiSpeechRate")) || 1;

  const stopVoice = useCallback(() => {
    stopSpeaking();
    setSpeakingState({ id: null, text: "", offset: 0, charIndex: 0, charLength: 0 });
  }, []);

  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  const speakFromOffset = useCallback((text, id, offset, rate) => {
    const textToSpeak = text.slice(offset);
    speakText(textToSpeak, {
      rate,
      onBoundary: (e) => {
        if (e.name === "word") {
          setSpeakingState((prev) => ({
            ...prev,
            charIndex: offset + e.charIndex,
            charLength: e.charLength,
          }));
        }
      },
      onEnd: () => {
        if (!isCancellingRef.current) {
          setSpeakingState({ id: null, text: "", offset: 0, charIndex: 0, charLength: 0 });
        }
      },
      onError: () => {
        if (!isCancellingRef.current) {
          setSpeakingState({ id: null, text: "", offset: 0, charIndex: 0, charLength: 0 });
        }
      },
    });
  }, []);

  const toggleVoice = useCallback((id, text) => {
    if (speakingState.id === id) {
      stopVoice();
    } else {
      isCancellingRef.current = true;
      stopSpeaking();
      setTimeout(() => {
        isCancellingRef.current = false;
        setSpeakingState({ id, text, offset: 0, charIndex: 0, charLength: 0 });
        speakFromOffset(text, id, 0, speechRate);
      }, 50);
    }
  }, [speakingState.id, speakFromOffset, speechRate, stopVoice]);

  const translateText = async (text, targetLanguage) => {
    setIsTranslating(true);
    try {
      const response = await generateContent({
        prompt: `Translate the following text to ${targetLanguage}. Only return the translation, no extra text:\n\n${text}`,
        contentType: "translation"
      });
      return response.generated_content || response;
    } finally {
      setIsTranslating(false);
    }
  };

  return { speakingState, toggleVoice, stopVoice, isTranslating, translateText };
};