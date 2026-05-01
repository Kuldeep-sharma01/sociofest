import { useState, useEffect, useRef } from 'react';

export const useMicVolume = (isActive) => {
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setVolume(0);
      return;
    }

    const startMic = async () => {
      try {
        // Mobile HTTP Safety Check: Prevent crash if accessed via insecure local IP
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn("Microphone access blocked: Requires HTTPS or localhost.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        
        // Fix for suspended contexts (Browser auto-play policies)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateVolume = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Focus exclusively on human voice frequencies (First ~30 bins = 0-2500Hz)
          let sum = 0;
          const activeBins = 30;
          for (let i = 0; i < activeBins; i++) {
            sum += dataArray[i];
          }
          
          // Average the voice frequencies, normalize to 100, and aggressively boost sensitivity (2.5x)
          const rawVolume = Math.min(100, ((sum / activeBins) / 255) * 100 * 2.5);
          
          const now = Date.now();
          if (now - lastUpdateRef.current > 40) { // ~25 FPS
            setVolume(Math.round(rawVolume));
            lastUpdateRef.current = now;
          }
          
          animationRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        console.warn("Volume meter mic access denied or unavailable", err);
      }
    };

    startMic();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(() => {});
    };
  }, [isActive]);

  return volume;
};
