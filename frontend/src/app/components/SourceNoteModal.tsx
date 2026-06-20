'use client';

import React from 'react';
import { Learning } from '../utils/api';

interface SourceNoteModalProps {
  learning: Learning | null;
  onClose: () => void;
}

export default function SourceNoteModal({ learning, onClose }: SourceNoteModalProps) {
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
        </div>
      </div>
    </div>
  );
}
