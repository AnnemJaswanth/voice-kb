'use client';

import React, { useEffect, useState } from 'react';
import { Topic, Learning, fetchTopics, fetchTopicLearnings } from '../utils/api';
import LearningCards from './LearningCards';

interface TopicsBrowserProps {
  onOpenSource: (id: string) => void;
  onDeleteLearning: (id: string) => Promise<void>;
}

export default function TopicsBrowser({ onOpenSource, onDeleteLearning }: TopicsBrowserProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicLearnings, setTopicLearnings] = useState<Learning[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const result = await fetchTopics();
      setTopics(result);
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = async (topic: Topic) => {
    setSelectedTopic(topic);
    setTopicLoading(true);
    try {
      const result = await fetchTopicLearnings(topic.id);
      setTopicLearnings(result);
    } catch (err) {
      console.error('Failed to load topic learnings:', err);
    } finally {
      setTopicLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setTopicLearnings([]);
  };

  const getCategoryClass = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('backend') || n.includes('technology') || n.includes('database') || n.includes('server')) return 'cat-backend';
    if (n.includes('ai') || n.includes('machine learning') || n.includes('deep learning') || n.includes('engineering')) return 'cat-ai';
    if (n.includes('psychology') || n.includes('personal') || n.includes('habit') || n.includes('mindset')) return 'cat-psychology';
    if (n.includes('dsa') || n.includes('algorithm') || n.includes('data structure') || n.includes('education')) return 'cat-dsa';
    if (n.includes('business') || n.includes('finance') || n.includes('product')) return 'cat-business';
    return 'cat-other';
  };

  // ── Topic Detail View ──
  if (selectedTopic) {
    return (
      <div className="feed-container-card">
        <div className="feed-controls" style={{ paddingBottom: '0.5rem' }}>
          <button
            onClick={handleBack}
            className="btn btn-outline"
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Topics
          </button>
        </div>

        <div className="feed-body">
          <div className="feed-header" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className={`category-tag ${getCategoryClass(selectedTopic.name)}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
                {selectedTopic.name}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {selectedTopic.learningCount} {selectedTopic.learningCount === 1 ? 'learning' : 'learnings'}
              </span>
            </div>
          </div>

          {topicLoading ? (
            <div className="feed-loading">
              <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
              <p style={{ color: 'var(--text-muted)' }}>Loading learnings...</p>
            </div>
          ) : topicLearnings.length === 0 ? (
            <div className="empty-state">
              <h4 className="empty-state-title">No learnings found</h4>
              <p className="empty-state-desc">This topic has no associated learnings.</p>
            </div>
          ) : (
            <LearningCards learnings={topicLearnings} onDeleteLearning={onDeleteLearning} onOpenSource={onOpenSource} />
          )}
        </div>
      </div>
    );
  }

  // ── Topics Grid View ──
  return (
    <div className="feed-container-card">
      <div className="feed-body">
        <div className="feed-header" style={{ flexShrink: 0 }}>
          <h2 className="feed-title">Topics</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
          </span>
        </div>

        {loading ? (
          <div className="feed-loading">
            <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading topics...</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <h4 className="empty-state-title">No topics yet</h4>
            <p className="empty-state-desc">
              Topics are automatically created when you record new learnings. Start recording to see your topics!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleTopicClick(topic)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  textAlign: 'left',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span
                  className={`category-tag ${getCategoryClass(topic.name)}`}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                >
                  {topic.name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                }}>
                  {topic.name}
                </span>
                <span style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                }}>
                  {topic.learningCount} {topic.learningCount === 1 ? 'learning' : 'learnings'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
