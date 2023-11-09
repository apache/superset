import React from 'react';
import { StyledDvtCard } from './dvt-card.module';

export interface DvtCardProps {
  title: string;
}

const DvtCard: React.FC<DvtCardProps> = ({ title }) => (
  <StyledDvtCard>{title}</StyledDvtCard>
);

export default DvtCard;
