import React, { FC } from 'react';
import { ColorCollection } from '../colors';

const white = '#fff';

export const Legend: FC = () => (
  <>
    <div
      style={{
        padding: '10px',
        position: 'absolute',
        bottom: 5,
        left: 5,
        backgroundColor: white,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
        Wasserversorgung
      </div>
      {Object.keys(ColorCollection).map(key => (
        <div
          key={key}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: '5px',
          }}
        >
          <div
            style={{
              width: '25px',
              height: '25px',
              marginRight: '10px',
              borderRadius: '50%',
              backgroundColor: `rgba(${ColorCollection[
                key as keyof typeof ColorCollection
              ].color.toString()})`,
            }}
          />
          <div>
            {ColorCollection[key as keyof typeof ColorCollection].description}
          </div>
        </div>
      ))}
    </div>
  </>
);
