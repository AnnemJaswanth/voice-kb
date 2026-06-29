'use client';

import React, { useEffect, useState } from 'react';
import { Learning, RelatedLearning, fetchRelatedLearnings } from '../utils/api';

interface SourceNoteModalProps {
  learning: Learning | null;
  onClose: () => void;
  onOpenSource?: (id: string) => void;
}

export default function SourceNoteModal({ learning, onClose, onOpenSource }: SourceNoteModalProps) {
  const [relatedLearnings, setRelatedLearnings] = useState<RelatedLearning[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  useEffect(() => {
    if (learning) {
      loadRelated(learning.id);
    }
  }, [learning]);

  const loadRelated = async (id: string) => {
    setRelatedLoading(true);
    try {
      const result = await fetchRelatedLearnings(id);
      setRelatedLearnings(result);
    } catch (err) {
      console.error('Failed to load related learnings:', err);
    } finally {
      setRelatedLoading(false);
    }
  };

  if (!learning) return null;

  // Helper to parse summary bullets
  const parseSummaryPoints = (text: string): string[] => {
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  };

  const getCategoryClass = (category: string | null): string => {
    const cat = (category || 'other').toLowerCase();
    if (cat === 'backend' || cat === 'technology') return 'cat-backend';
    if (cat === 'ai' || cat === 'engineering') return 'cat-ai';
    if (cat === 'psychology' || cat === 'personal') return 'cat-psychology';
    if (cat === 'dsa' || cat === 'education' || cat === 'science') return 'cat-dsa';
    return 'cat-other';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Source Learning Details</h3>
          <button onClick={onClose} className="modal-close-btn" title="Close modal">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Header Card Meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span className={`category-tag ${getCategoryClass(learning.category)}`} style={{ alignSelf: 'flex-start' }}>
              {learning.category || 'Other'}
            </span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
              {learning.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>{learning.audioDuration ? `${Math.round(parseFloat(learning.audioDuration))}s` : 'Unknown'}</span>
              <span>•</span>
              <span>{new Date(learning.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Topics */}
          {learning.topics && learning.topics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
              {learning.topics.map((topic, i) => (
                <span key={i} style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '100px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: 'rgba(139, 92, 246, 0.12)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                }}>
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Audio Player */}
          {learning.audioUrl && (
            <div className="audio-player-wrapper">
              <audio controls src={learning.audioUrl} className="audio-element">
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Summary Section */}
          <div className="summary-section">
            <div className="section-label">Key Summaries</div>
            <ul className="summary-list">
              {parseSummaryPoints(learning.summary).map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>

          {/* Concepts Section */}
          {learning.keyConcepts && parseSummaryPoints(learning.keyConcepts).length > 0 && (
            <div className="concepts-section">
              <div className="section-label">Key Concepts</div>
              <ul className="concepts-list">
                {parseSummaryPoints(learning.keyConcepts).map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items Section */}
          {learning.actionItems && parseSummaryPoints(learning.actionItems).length > 0 && (
            <div className="action-section">
              <div className="section-label">Action Items</div>
              <ul className="action-list">
                {parseSummaryPoints(learning.actionItems).map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Transcript */}
          <div className="transcript-section">
            <div className="section-label">Full Transcript</div>
            <div className="transcript-content" style={{ maxHeight: '150px', display: 'block' }}>
              {learning.transcript || 'No transcript generated.'}
            </div>
          </div>

          {/* Related Learnings */}
          <div style={{ marginTop: '1rem' }}>
            <div className="section-label">Related Learnings</div>
            {relatedLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Finding related notes...</span>
              </div>
            ) : relatedLearnings.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                No related learnings found.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {relatedLearnings.map((rl) => (
                  <button
                    key={rl.id}
                    onClick={() => onOpenSource && onOpenSource(rl.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      width: '100%',
                      color: 'var(--text-main)',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rl.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rl.category}</span>
                    </div>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: rl.similarity > 75 ? 'var(--primary)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {rl.similarity}% Match
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
