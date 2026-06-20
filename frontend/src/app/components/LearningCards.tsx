'use client';

import React from 'react';
import { Learning } from '../utils/api';
import LearningCard from './LearningCard';

interface LearningCardsProps {
  learnings: Learning[];
  onDeleteLearning: (id: string) => Promise<void>;
  onOpenSource: (id: string) => void;
}

export default function LearningCards({ learnings, onDeleteLearning, onOpenSource }: LearningCardsProps) {
  return (
    <div className="learning-cards-container">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {learnings.map((item) => (
          <LearningCard key={item.id} item={item} onDelete={onDeleteLearning} onOpenSource={onOpenSource} />
        ))}
      </div>
    </div>
  );
}
