'use client';

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Conversation, ChatMessage } from '../utils/api';

interface ChatCoachProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  chatInput: string;
  chatLoading: boolean;
  onSendMessage: (e: React.FormEvent) => void;
  onChangeChatInput: (val: string) => void;
  onCreateConversation: () => void;
  onChangeActiveConversation: (id: string) => void;
  onOpenSource: (id: string) => void;
}

export default function ChatCoach({
  conversations,
  activeConversationId,
  chatInput,
  chatLoading,
  onSendMessage,
  onChangeChatInput,
  onCreateConversation,
  onChangeActiveConversation,
  onOpenSource,
}: ChatCoachProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConv ? activeConv.messages : [];

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages.length, chatLoading]);

  // Format date for sidebar list items
  const formatConvDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="chat-container-split">
      {/* 1. Left Sidebar: Conversation History List */}
      <div className="chat-sidebar-conversations">
        <div className="sidebar-chat-header">
          <button onClick={onCreateConversation} className="btn" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.2rem' }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>
        </div>

        <div className="conversations-scroll-list">
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
              No chats yet. Click above to start one!
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onChangeActiveConversation(conv.id)}
                className={`conv-list-item ${conv.id === activeConversationId ? 'active' : ''}`}
              >
                <span className="conv-item-title">{conv.title || 'Untitled Chat'}</span>
                <span className="conv-item-date">{formatConvDate(conv.createdAt)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Right: Active Chat Area */}
      <div className="chat-main-area">
        {/* Chat Header */}
        <div className="chat-area-header">
          <div className="chat-area-title">
            {activeConv ? activeConv.title : 'Select or Start a Conversation'}
          </div>
        </div>

        {/* Message History Viewport */}
        <div className="messages-viewport" ref={viewportRef}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                💬
              </div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600 }}>AI Learning Coach</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '340px', lineHeight: 1.5 }}>
                Ask anything about your recorded learnings! The coach will retrieve relevant voice notes and cite them as sources.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className={`message-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                  {/* Markdown rendering */}
                  <div className="markdown-body" style={{ whiteSpace: 'normal' }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Sources / Citations list */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      <span className="sources-label">Cited Sources:</span>
                      {msg.sources.map((src) => (
                        <button
                          key={src.id}
                          onClick={() => onOpenSource(src.id)}
                          className="source-badge"
                          title={`Click to view: ${src.title}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                          </svg>
                          {src.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* AI generating spinner */}
          {chatLoading && (
            <div className="message-row assistant">
              <div className="message-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1.2rem' }}>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2.5px' }}></div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching database & generating coach response...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input row */}
        <div className="chat-input-row">
          <form onSubmit={onSendMessage} className="chat-input-form">
            <input
              type="text"
              placeholder="Ask a question about your learnings... (e.g., 'What did I learn about database indexing?')"
              className="chat-input-field"
              value={chatInput}
              onChange={(e) => onChangeChatInput(e.target.value)}
              disabled={chatLoading}
              required
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={chatLoading || !chatInput.trim()}
              title="Send Message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
