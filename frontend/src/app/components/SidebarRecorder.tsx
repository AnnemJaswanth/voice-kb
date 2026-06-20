'use client';

import React, { useState, useRef } from 'react';
import { uploadAudioFile, Learning } from '../utils/api';

interface SidebarRecorderProps {
  onRecordingComplete: (newLearning: Learning) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function SidebarRecorder({ onRecordingComplete, showToast }: SidebarRecorderProps) {
  // --- Voice Recorder State ---
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  
  // Recorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerBarsRef = useRef<HTMLDivElement[]>([]);
  const recognitionRef = useRef<any>(null);

  // --- Filters and Formatting ---
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Web Audio Visualizer Loop ---
  const updateVisualizer = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const bars = visualizerBarsRef.current;
    if (bars && bars.length > 0) {
      const step = Math.floor(bufferLength / bars.length);
      for (let i = 0; i < bars.length; i++) {
        const value = dataArray[i * step] || 0;
        // Map 0-255 frequency amplitude to 4px - 32px height
        const height = 4 + (value / 255) * 28;
        if (bars[i]) {
          bars[i].style.height = `${height}px`;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  // --- Recording Start / Stop ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setLiveTranscript('');
      let localTranscript = '';

      // Initialize SpeechRecognition if supported
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let accumulated = '';
          for (let i = 0; i < event.results.length; ++i) {
            accumulated += event.results[i][0].transcript + ' ';
          }
          localTranscript = accumulated.trim();
          setLiveTranscript(localTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      // 1. Media Recorder setup
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Let browser decide
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clean up tracks
        stream.getTracks().forEach((track) => track.stop());

        // Stop SpeechRecognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // ignore
          }
          recognitionRef.current = null;
        }

        // Process audio chunks into blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        // Upload audio
        setUploading(true);
        showToast('Processing audio with Gemini AI...');
        try {
          const newLearning = await uploadAudioFile(audioBlob, `recording_${Date.now()}.webm`, localTranscript);
          showToast('Voice learning transcribed & summarized!');
          onRecordingComplete(newLearning);
        } catch (err: any) {
          showToast(err.message || 'Failed to upload or summarize audio', 'error');
        } finally {
          setUploading(false);
          setLiveTranscript('');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Get audio data slices every 250ms

      // 2. Web Audio Analyser setup for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Smaller buffer size for visualizer
      source.connect(analyser);

      audioCtxRef.current = audioContext;
      analyserRef.current = analyser;

      // Start duration timer
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      setIsRecording(true);
      // Start visualization loop
      animationFrameRef.current = requestAnimationFrame(updateVisualizer);

    } catch (err: any) {
      showToast('Could not access microphone. Please grant permission.', 'error');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop SpeechRecognition immediately if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Clean up timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Clean up Web Audio
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    analyserRef.current = null;

    // Reset visualizer bars
    visualizerBarsRef.current.forEach((bar) => {
      if (bar) bar.style.height = '4px';
    });
  };

  return (
    <div className="sidebar-panel">
      <div className="panel-card">
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Capture Learning
        </h3>
        
        <div className="recorder-wrapper">
          <div className="record-btn-container">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={uploading}
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                  <line x1="12" x2="12" y1="19" y2="22"></line>
                </svg>
              )}
            </button>
            <div className="pulse-ring"></div>
          </div>

          <div className="record-status">
            {uploading ? 'Processing note...' : isRecording ? 'Recording microphone...' : 'Ready to capture'}
          </div>

          <div className="record-timer">
            {isRecording ? formatTime(recordingDuration) : '00:00'}
          </div>

          {/* Waveform Visualizer */}
          <div className={`wave-visualizer ${isRecording ? 'recording' : ''}`}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  if (el) visualizerBarsRef.current[i] = el;
                }}
                className="wave-bar"
              ></div>
            ))}
          </div>

          {isRecording && liveTranscript && (
            <div style={{
              marginTop: '1rem',
              padding: '0.8rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.85)',
              fontStyle: 'italic',
              maxHeight: '100px',
              overflowY: 'auto',
              width: '100%',
              textAlign: 'left',
              borderLeft: '3px solid rgba(139, 92, 246, 0.5)'
            }}>
              <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgb(167, 139, 250)', marginBottom: '0.2rem', fontStyle: 'normal' }}>Live Transcript:</strong>
              {liveTranscript}...
            </div>
          )}

          {uploading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', width: '100%', marginTop: '0.5rem' }}>
              <div className="spinner"></div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                Gemini is generating title, category, verbatim transcript, and structured learning summaries...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tips / Info */}
      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>How it works</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Simply tap the microphone to start speaking. Record your thoughts, notes, study reminders, or meeting points.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '0.5rem' }}>
          Once stopped, the audio is uploaded and analyzed using Gemini's native audio capabilities to construct structured notes.
        </p>
      </div>
    </div>
  );
}
