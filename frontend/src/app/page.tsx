'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  registerUser,
  loginUser,
  fetchMeWithLearnings,
  deleteLearning,
  setAuthToken,
  getAuthToken,
  getCurrentUser,
  User,
  Learning,
  fetchConversations,
  createConversation,
  sendMessage,
  Conversation,
  ChatMessage
} from './utils/api';

// Components
import ChatCoach from './components/ChatCoach';
import SourceNoteModal from './components/SourceNoteModal';
import AuthScreen from './components/AuthScreen';
import SidebarRecorder from './components/SidebarRecorder';
import LearningFeed from './components/LearningFeed';
import TopicsBrowser from './components/TopicsBrowser';

export default function Home() {
  const hasFetchedRef = useRef(false);

  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // --- Dashboard Data State ---
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // --- Toast/Notification State ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Tab State ---
  const [activeTab, setActiveTab] = useState<'feed' | 'chat' | 'topics'>('feed');

  // --- Chat State ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [sourceModalLearning, setSourceModalLearning] = useState<Learning | null>(null);

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

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const res = await fetchConversations();
      setConversations(res);
      if (res.length > 0 && !activeConversationId) {
        setActiveConversationId(res[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations', err);
    }
  }, [activeConversationId]);

  // Handle new conversation creation
  const handleCreateConversation = async () => {
    try {
      const newConv = await createConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      showToast('New chat conversation created');
    } catch (err: any) {
      showToast(err.message || 'Failed to create conversation', 'error');
    }
  };

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    let targetConvId = activeConversationId;
    
    if (!targetConvId) {
      try {
        const newConv = await createConversation();
        setConversations([newConv]);
        targetConvId = newConv.id;
        setActiveConversationId(newConv.id);
      } catch (err: any) {
        showToast(err.message || 'Failed to create conversation', 'error');
        return;
      }
    }

    const currentInput = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    const tempUserMsg: ChatMessage = {
      id: 'temp-user-' + Date.now(),
      conversationId: targetConvId,
      role: 'user',
      content: currentInput,
      sources: [],
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === targetConvId) {
          return {
            ...c,
            messages: [...c.messages, tempUserMsg],
          };
        }
        return c;
      })
    );

    try {
      const assistantMsg = await sendMessage(targetConvId, currentInput);
      
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === targetConvId) {
            const actualMessages = c.messages.filter((m) => !m.id.startsWith('temp-user-'));
            const userMsgFromBackend: ChatMessage = {
              id: 'user-' + Date.now(),
              conversationId: targetConvId!,
              role: 'user',
              content: currentInput,
              sources: [],
              createdAt: new Date().toISOString(),
            };
            return {
              ...c,
              messages: [...actualMessages, userMsgFromBackend, assistantMsg],
            };
          }
          return c;
        })
      );
      
      const refreshedConvs = await fetchConversations();
      setConversations(refreshedConvs);

    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error');
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === targetConvId) {
            return {
              ...c,
              messages: c.messages.filter((m) => !m.id.startsWith('temp-user-')),
            };
          }
          return c;
        })
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleOpenSourceModal = (sourceId: string) => {
    const found = learnings.find((l) => l.id === sourceId);
    if (found) {
      setSourceModalLearning(found);
    } else {
      showToast('Source learning details not found in local feed.', 'error');
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    const currentUser = getCurrentUser();
    if (token && currentUser) {
      setIsAuthenticated(true);
      setUser(currentUser);
    }
  }, []);

  const loadLearnings = useCallback(async () => {
    if (!getAuthToken()) return;
    setDataLoading(true);
    try {
      const res = await fetchMeWithLearnings();
      if (res.me) {
        setLearnings(res.me.learnings || []);
        setUser({ id: res.me.id, name: res.me.name, email: res.me.email });
      } else {
        setAuthToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setLearnings([]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch learnings', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadLearnings();
      loadConversations();
    }
  }, [isAuthenticated, loadLearnings, loadConversations]);

  const handleAuth = async (isRegister: boolean, name: string, email: string, pass: string) => {
    if (!email || !pass || (isRegister && !name)) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      if (isRegister) {
        const res = await registerUser(name, email, pass);
        setUser({ id: res.user_id, name: res.name, email: res.email });
        showToast(`Welcome, ${res.name}! Your account is created.`);
      } else {
        const res = await loginUser(email, pass);
        setUser({ id: res.user_id, name: res.name, email: res.email });
        showToast(`Welcome back, ${res.name}!`);
      }
      setIsAuthenticated(true);
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
    hasFetchedRef.current = false;
    showToast('Logged out successfully');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning note? This will also remove the audio file.')) {
      return;
    }
    try {
      const deleted = await deleteLearning(id);
      if (deleted) {
        showToast('Learning deleted successfully');
        setLearnings((prev) => prev.filter((item) => item.id !== id));
      } else {
        showToast('Failed to delete learning', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting learning', 'error');
    }
  };

  const handleRecordingComplete = (newLearning: Learning) => {
    setLearnings((prev) => [newLearning, ...prev]);
  };

  return (
    <>
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

      <main className="container pt-10 pb-6 md:pt-16 md:pb-8">
        {!isAuthenticated ? (
          <AuthScreen onAuth={handleAuth} isLoading={authLoading} />
        ) : (
          <div className="dashboard-grid">
            
            <SidebarRecorder 
              onRecordingComplete={handleRecordingComplete} 
              showToast={showToast} 
            />

            <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3 dashboard-main-panel">
              
              <div className="tabs-nav shrink-0">
                <button
                  onClick={() => setActiveTab('feed')}
                  className={`tab-nav-btn ${activeTab === 'feed' ? 'active' : ''}`}
                >
                  My Notes Feed
                </button>
                <button
                  onClick={() => setActiveTab('topics')}
                  className={`tab-nav-btn ${activeTab === 'topics' ? 'active' : ''}`}
                >
                  Topics
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`tab-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
                >
                  AI Chat Coach
                </button>
              </div>

              {activeTab === 'feed' ? (
                <LearningFeed 
                  learnings={learnings} 
                  dataLoading={dataLoading} 
                  onDeleteLearning={handleDelete} 
                  onOpenSource={handleOpenSourceModal}
                />
              ) : activeTab === 'topics' ? (
                <TopicsBrowser
                  onOpenSource={handleOpenSourceModal}
                  onDeleteLearning={handleDelete}
                />
              ) : (
                <ChatCoach
                  conversations={conversations}
                  activeConversationId={activeConversationId}
                  chatInput={chatInput}
                  chatLoading={chatLoading}
                  onSendMessage={handleSendMessage}
                  onChangeChatInput={setChatInput}
                  onCreateConversation={handleCreateConversation}
                  onChangeActiveConversation={setActiveConversationId}
                  onOpenSource={handleOpenSourceModal}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Global Notifications & Modals */}
      {toast && (
        <div className={`notification ${toast.type}`}>
          <div className="notification-message">{toast.message}</div>
          <button onClick={hideToast} className="notification-close">×</button>
        </div>
      )}

      {sourceModalLearning && (
        <SourceNoteModal
          learning={sourceModalLearning}
          onClose={() => setSourceModalLearning(null)}
          onOpenSource={handleOpenSourceModal}
        />
      )}
    </>
  );
}
