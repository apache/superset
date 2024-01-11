import React from 'react';
import Icon from '../Icons/Icon';
import {
  StyledDvtCard,
  StyledDvtCardCard,
  StyledDvtCardIcon,
  StyledDvtCardLabel,
} from './dvt-drag-card.module';

export interface DvtDragCardProps {
  label: string;
  value: string;
  icon: string;
}

const DvtDargCard = ({ label, value, icon }: DvtDragCardProps) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ label, value, icon }),
    );
  };
  
  return (
    <StyledDvtCard>
      <StyledDvtCardCard draggable={true} onDragStart={handleDragStart}>
        <StyledDvtCardIcon>
          <Icon fileName={icon} iconSize="xl" />
        </StyledDvtCardIcon>

        <StyledDvtCardLabel>{label}</StyledDvtCardLabel>
      </StyledDvtCardCard>
    </StyledDvtCard>
  );
};

export default DvtDargCard;
