import React from 'react';

export default function ShapeRect({ fill, width, height, style }) {
  return (
    <div
      style={{
        width,
        height,
        background: fill,
        style,
      }}
    />
  );
}
