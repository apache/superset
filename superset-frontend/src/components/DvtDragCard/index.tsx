import React, { useState } from 'react';
import Icon from '../Icons/Icon';
import {
  StyledDvtCard,
  StyledDvtCardSize,
  StyleddvtCardCard,
  StyleddvtCardIcon,
  StyleddvtCardLabel,
} from './dvt-drag-card.module';

export interface DvtDragCardData {
  label: string;
  value: string;
  icon: string;
}

export interface DvtDragCardProps {
  data: DvtDragCardData[];
}

const DvtDargCard = ({ data }: DvtDragCardProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (draggedIndex !== null) {
      event.preventDefault();
      const updatedData = [...data];
      const draggedCard = updatedData.splice(draggedIndex, 1)[0];
      updatedData.splice(index, 0, draggedCard);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <StyledDvtCard>
      <StyledDvtCardSize>
        Showing {data.length} of {data.length}
      </StyledDvtCardSize>
      {data.map((item, index) => (
        <StyleddvtCardCard
          key={index}
          draggable={true}
          onDragStart={() => handleDragStart(index)}
          onDragOver={e => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        >
          <StyleddvtCardIcon>
            <Icon fileName="email" iconSize="xl" />
          </StyleddvtCardIcon>

          <StyleddvtCardLabel>{item.label}</StyleddvtCardLabel>
        </StyleddvtCardCard>
      ))}
    </StyledDvtCard>
  );
};

export default DvtDargCard;
