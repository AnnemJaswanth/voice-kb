'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  registerUser,
  loginUser,
  uploadAudioFile,
  fetchMeWithLearnings,
  deleteLearning,
  setAuthToken,
  getAuthToken,
  getCurrentUser,
  User,
  Learning
} from './utils/api';

export default function Home() {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  
  // Auth Form State
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- Dashboard Data State ---
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedLearningId, setExpandedLearningId] = useState<string | null>(null);

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

  // --- Toast/Notification State ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Check auth on mount
  useEffect(() => {
    const token = getAuthToken();
    const currentUser = getCurrentUser();
    if (token && currentUser) {
      setIsAuthenticated(true);
      setUser(currentUser);
    }
  }, []);

  // Fetch learnings
  const loadLearnings = useCallback(async () => {
    if (!getAuthToken()) return;
    setDataLoading(true);
    try {
      const res = await fetchMeWithLearnings();
      if (res.me) {
        setLearnings(res.me.learnings || []);
        setUser({ id: res.me.id, name: res.me.name, email: res.me.email });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch learnings', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [showToast]);

  // Load learnings once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadLearnings();
    }
  }, [isAuthenticated, loadLearnings]);

  // --- Handle Auth Actions ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || (authTab === 'register' && !authName)) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      if (authTab === 'register') {
        const res = await registerUser(authName, authEmail, authPassword);
        setUser({ id: res.user_id, name: res.name, email: res.email });
        showToast(`Welcome, ${res.name}! Your account is created.`);
      } else {
        const res = await loginUser(authEmail, authPassword);
        setUser({ id: res.user_id, name: res.name, email: res.email });
        showToast(`Welcome back, ${res.name}!`);
      }
      setIsAuthenticated(true);
      // Clean form fields
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setLearnings([]);
    showToast('Logged out successfully');
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
      // Try to use webm or fall back to container supported by browser
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
          // Add to feed
          setLearnings((prev) => [newLearning, ...prev]);
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

  // --- Deletion Handler ---
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning note? This will also remove the audio file.')) {
      return;
    }
    try {
      const deleted = await deleteLearning(id);
      if (deleted) {
        showToast('Learning deleted successfully');
        setLearnings((prev) => prev.filter((item) => item.id !== id));
        if (expandedLearningId === id) {
          setExpandedLearningId(null);
        }
      } else {
        showToast('Failed to delete learning', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting learning', 'error');
    }
  };

  // --- Filters and Formatting ---
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryClass = (category: string | null): string => {
    const cat = (category || 'other').toLowerCase();
    if (cat === 'engineering') return 'cat-engineering';
    if (cat === 'business') return 'cat-business';
    if (cat === 'personal') return 'cat-personal';
    return 'cat-other';
  };

  // Filter learnings
  const filteredLearnings = learnings.filter((item) => {
    // 1. Category Filter
    if (selectedCategory !== 'All') {
      const itemCat = item.category || 'Other';
      if (itemCat.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }
    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchTranscript = item.transcript.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchCategory = (item.category || '').toLowerCase().includes(q);
      return matchTitle || matchTranscript || matchSummary || matchCategory;
    }
    return true;
  });

  // Extract categories dynamically
  const categoriesList = ['All', 'Engineering', 'Business', 'Personal', 'Other'];

  // Parse summary bullet points
  const parseSummaryPoints = (summaryText: string): string[] => {
    if (!summaryText) return [];
    return summaryText
      .split('\n')
      .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  };

  return (
    <>
      {/* Brand Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand">
            <div className="brand-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
              </svg>
            </div>
            <h1 className="brand-logo">voiceKB</h1>
          </div>
          {isAuthenticated && user && (
            <div className="user-profile-menu">
              <div className="user-avatar" title={user.email}>
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', width: 'auto', borderRadius: '8px' }}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        {!isAuthenticated ? (
          /* Authentication Screen */
          <div className="auth-container">
            <div className="auth-card">
              <h2 className="auth-title">Voice Knowledge Base</h2>
              <p className="auth-subtitle">Transform your speech into searchable structured assets</p>
              
              <div className="auth-tabs">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthTab('register')}
                  className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuth}>
                {authTab === 'register' && (
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Jane Doe"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" disabled={authLoading} className="btn">
                  {authLoading ? (
                    <>
                      <div className="spinner"></div>
                      Authenticating...
                    </>
                  ) : authTab === 'register' ? (
                    'Create Account'
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="dashboard-grid">
            
            {/* Sidebar with Recorder */}
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

            {/* Main Learnings Feed */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              
              {/* Search Bar */}
              <div className="search-box-container">
                <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search learnings, transcripts, summaries, or categories..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filters */}
              <div className="filters-wrapper">
                {categoriesList.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`filter-pill ${selectedCategory === category ? 'active' : ''}`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Feed List */}
              <div style={{ flex: 1 }}>
                <div className="feed-header">
                  <h2 className="feed-title">My Learnings</h2>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {filteredLearnings.length} notes found
                  </span>
                </div>

                {dataLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading your notes...</p>
                  </div>
                ) : filteredLearnings.length === 0 ? (
                  /* Empty state */
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <h4 className="empty-state-title">No voice notes yet</h4>
                    <p className="empty-state-desc">
                      {searchQuery || selectedCategory !== 'All' 
                        ? 'No notes match your current search queries or filters.' 
                        : 'Your recordings will appear here. Start speaking by clicking the microphone button!'}
                    </p>
                    {(searchQuery || selectedCategory !== 'All') && (
                      <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', width: 'auto', borderRadius: '10px' }}>
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  /* Feed Cards */
                  filteredLearnings.map((item) => (
                    <div key={item.id} className="learning-card">
                      
                      <div className="card-top">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <span className={`category-tag ${getCategoryClass(item.category)}`}>
                            {item.category || 'Other'}
                          </span>
                          <h3 className="card-title">{item.title}</h3>
                        </div>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="delete-btn-card"
                          title="Delete learning note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>

                      <div className="card-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span>{item.audioDuration ? `${Math.round(parseFloat(item.audioDuration))}s` : 'Unknown'}</span>
                        </div>
                        <div>•</div>
                        <span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Summary Section */}
                      <div className="summary-section">
                        <div className="section-label">Key Summaries</div>
                        <ul className="summary-list">
                          {parseSummaryPoints(item.summary).map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Custom Audio Player wrapper */}
                      {item.audioUrl && (
                        <div className="audio-player-wrapper">
                          <audio controls src={item.audioUrl} className="audio-element">
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}

                      {/* Transcripts toggle section */}
                      <div className="transcript-section">
                        <button
                          onClick={() => setExpandedLearningId(expandedLearningId === item.id ? null : item.id)}
                          className="transcript-toggle-btn"
                        >
                          {expandedLearningId === item.id ? (
                            <>
                              Hide Transcript
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15"></polyline>
                              </svg>
                            </>
                          ) : (
                            <>
                              View Full Transcript
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </>
                          )}
                        </button>
                        {expandedLearningId === item.id && (
                          <div className="transcript-content">
                            {item.transcript || 'No transcript generated.'}
                          </div>
                        )}
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Floating alert toasts */}
      {toast && (
        <div className={`notification ${toast.type}`}>
          <div className="notification-message">{toast.message}</div>
          <button onClick={hideToast} className="notification-close">
            &times;
          </button>
        </div>
      )}
    </>
  );
}
