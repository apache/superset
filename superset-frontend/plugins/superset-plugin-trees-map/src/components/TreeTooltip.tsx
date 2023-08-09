import React, { FC } from 'react';

interface TreeToltipProps {
  selectedObject: any;
  setSelectedObject: (obj: any) => void;
}

const white = '#fff';

export const TreeToltip: FC<TreeToltipProps> = ({
  selectedObject,
  setSelectedObject,
}) => (
  <>
    <div
      style={{
        position: 'absolute',
        left: selectedObject.x,
        top: selectedObject.y,
        backgroundColor: white,
        padding: '10px',
        width: 'auto',
        height: 'auto',
        borderRadius: '5px',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          role="button"
          tabIndex={0}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={() => setSelectedObject(undefined)}
        >
          ✕
        </div>
        <div style={{ padding: '20px' }}>
          <p>
            {selectedObject.object.art_dtsch},{' '}
            {selectedObject.object.standalter} Jahre
          </p>
          <p>Saugspannung (heute): {selectedObject.object.nowcast_value} kPa</p>
          <p>
            {selectedObject.object.strname} {selectedObject.object.hausnr},{' '}
            {selectedObject.object.standortnr}
          </p>
          <p>ID: {selectedObject.object.id}</p>
        </div>
      </div>
    </div>
  </>
);
