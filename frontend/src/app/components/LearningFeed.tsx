'use client';

import React, { useEffect, useState } from 'react';
import { Learning } from '../utils/api';
import LearningCards from './LearningCards';

interface LearningFeedProps {
  learnings: Learning[];
  dataLoading: boolean;
  onDeleteLearning: (id: string) => Promise<void>;
  onOpenSource: (id: string) => void;
}

export default function LearningFeed({ learnings, dataLoading, onDeleteLearning, onOpenSource }: LearningFeedProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const categoriesList = ['All', 'Backend', 'AI', 'Psychology', 'DSA', 'Other'];
  const pageSize = 4;

  const filteredLearnings = learnings.filter((item) => {
    // 1. Category Filter
    if (selectedCategory !== 'All') {
      const itemCat = item.category || 'Other';
      let mappedCat = 'Other';
      const c = itemCat.toLowerCase();
      if (c === 'backend' || c === 'technology') mappedCat = 'Backend';
      else if (c === 'ai' || c === 'engineering') mappedCat = 'AI';
      else if (c === 'psychology' || c === 'personal') mappedCat = 'Psychology';
      else if (c === 'dsa' || c === 'education' || c === 'science') mappedCat = 'DSA';
      
      if (mappedCat.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }
    // 2. Date Filter
    if (selectedDateFilter !== 'All') {
      const noteDate = new Date(item.createdAt);
      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (selectedDateFilter === 'Today') {
        if (noteDate < todayStart) return false;
      } else if (selectedDateFilter === 'Yesterday') {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        if (noteDate < yesterdayStart || noteDate >= todayStart) return false;
      } else if (selectedDateFilter === 'Last 7 Days') {
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (noteDate < sevenDaysAgo) return false;
      } else if (selectedDateFilter === 'Last 30 Days') {
        const thirtyDaysAgo = new Date(todayStart);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (noteDate < thirtyDaysAgo) return false;
      }
    }
    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchTranscript = item.transcript.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchCategory = (item.category || '').toLowerCase().includes(q);
      const matchConcepts = (item.keyConcepts || '').toLowerCase().includes(q);
      const matchAction = (item.actionItems || '').toLowerCase().includes(q);
      return matchTitle || matchTranscript || matchSummary || matchCategory || matchConcepts || matchAction;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLearnings.length / pageSize));
  const visibleLearnings = filteredLearnings.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRecord = filteredLearnings.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, filteredLearnings.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedDateFilter]);

  const goToPreviousPage = () => setCurrentPage((page) => Math.max(1, page - 1));
  const goToNextPage = () => setCurrentPage((page) => Math.min(totalPages, page + 1));

  return (
    <div className="feed-container-card">
      {/* Search & Date Filter Row - Inside card */}
      <div className="feed-controls">
        <div className="search-filter-row">
          <div className="search-box-container" style={{ flex: 1, marginBottom: 0 }}>
            <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search learnings, transcripts, summaries, concepts, or actions..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="date-filter-container">
            <select
              className="date-filter-select"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
            </select>
          </div>
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
      </div>

      <div className="feed-body">
          <div className="feed-header" style={{ flexShrink: 0 }}>
            <h2 className="feed-title">My Learnings</h2>
            {filteredLearnings.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="btn btn-outline"
                  style={{ width: 'auto', padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {startRecord}-{endRecord} ({filteredLearnings.length} records)
                </span>
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="btn btn-outline"
                  style={{ width: 'auto', padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {dataLoading ? (
            <div className="feed-loading">
              <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
              <p style={{ color: 'var(--text-muted)' }}>Loading your notes...</p>
            </div>
          ) : filteredLearnings.length === 0 ? (
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
              {(searchQuery || selectedCategory !== 'All' || selectedDateFilter !== 'All') && (
                <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedDateFilter('All'); }} className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', width: 'auto', borderRadius: '10px' }}>
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <LearningCards learnings={visibleLearnings} onDeleteLearning={onDeleteLearning} onOpenSource={onOpenSource} />
          )}
        </div>
      </div>
  );
}
