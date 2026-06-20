'use client';

import React, { useState } from 'react';
import { Learning } from '../utils/api';

interface LearningCardProps {
  item: Learning;
  onDelete: (id: string) => void;
  onOpenSource: (id: string) => void;
}

export default function LearningCard({ item, onDelete, onOpenSource }: LearningCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getCategoryClass = (category: string | null): string => {
    const cat = (category || 'other').toLowerCase();
    if (cat === 'backend' || cat === 'technology') return 'cat-backend';
    if (cat === 'ai' || cat === 'engineering') return 'cat-ai';
    if (cat === 'psychology' || cat === 'personal') return 'cat-psychology';
    if (cat === 'dsa' || cat === 'education' || cat === 'science') return 'cat-dsa';
    return 'cat-other';
  };

  const parseSummaryPoints = (summaryText: string): string[] => {
    if (!summaryText) return [];
    return summaryText
      .split('\n')
      .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  };

  return (
    <div className="learning-card" onClick={() => onOpenSource(item.id)} style={{ cursor: 'pointer' }}>
      <div className="card-top">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span className={`category-tag ${getCategoryClass(item.category)}`}>
            {item.category || 'Other'}
          </span>
          <h3 className="card-title">{item.title}</h3>
        </div>
        <button
          onClick={() => onDelete(item.id)}
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

      {/* Key Concepts Section */}
      {item.keyConcepts && parseSummaryPoints(item.keyConcepts).length > 0 && (
        <div className="concepts-section">
          <div className="section-label">Key Concepts</div>
          <ul className="concepts-list">
            {parseSummaryPoints(item.keyConcepts).map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items Section */}
      {item.actionItems && parseSummaryPoints(item.actionItems).length > 0 && (
        <div className="action-section">
          <div className="section-label">Action Items</div>
          <ul className="action-list">
            {parseSummaryPoints(item.actionItems).map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

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
          onClick={() => setIsExpanded(!isExpanded)}
          className="transcript-toggle-btn"
        >
          {isExpanded ? (
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
        {isExpanded && (
          <div className="transcript-content">
            {item.transcript || 'No transcript generated.'}
          </div>
        )}
      </div>
    </div>
  );
}
