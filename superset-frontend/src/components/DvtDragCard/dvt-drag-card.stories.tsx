import React, { useState } from 'react';
import DvtDargCard, { DvtDragCardProps } from './index';

export default {
  title: 'Dvt-Components/DvtDargCard',
  component: DvtDargCard,
};

export const Default = (args: DvtDragCardProps) => {
  const [droppedData, setDroppedData] = useState<any | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (droppedData) {
      return;
    }

    const draggedData = JSON.parse(e.dataTransfer.getData('drag-drop'));
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
            <div>{droppedData.name}</div>
          </div>
        )}
      </div>
    </div>
  );
};

Default.args = {
  label: 'arac',
  value: { id: 1, name: 'arac' },
  icon: 'dvt-hashtag',
};
