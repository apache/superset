import React, { useState } from 'react';
import DvtDargCard, { DvtDragCardProps } from './index';

export default {
  title: 'Dvt-Components/DvtDargCard',
  component: DvtDargCard,
};

export const Default = (args: DvtDragCardProps) => {
  const [droppedData, setDroppedData] = useState<DvtDragCardProps | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (droppedData) {
      return;
    }

    const draggedData = JSON.parse(e.dataTransfer.getData('text/plain'));
    setDroppedData(draggedData);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '600px',
      }}
    >
      <DvtDargCard {...args} />

      <div
        id="drop-container"
        style={{
          display: 'flex',
          border: '2px dashed #aaa',
          padding: '10px',
          height: '50px',
          width: '300px',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div
          onClick={() => {
            setDroppedData(null);
          }}
          style={{
            fontWeight: '600',
            fontSize: '15px',
            border: '1px solid #000',
            textAlign: 'center',
            width: '30px',
          }}
        >
          x
        </div>

        {droppedData && (
          <div
            style={{
              marginLeft: '15px',
            }}
          >
            <div>{droppedData.label}</div>
          </div>
        )}
      </div>
    </div>
  );
};

Default.args = {
  label: 'arac',
  value: 'arac',
  icon: 'dvt-hashtag',
};
