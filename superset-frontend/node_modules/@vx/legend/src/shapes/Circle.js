import React from 'react';
import { Group } from '@vx/group';

export default function ShapeCircle({ fill, width, height, style }) {
  if (typeof width === 'string') width = 0;
  if (typeof height === 'string') height = 0;
  const size = Math.max(width, height);
  const radius = size / 2;
  return (
    <svg width={size} height={size}>
      <Group top={radius} left={radius}>
        <circle r={radius} fill={fill} style={style} />
      </Group>
    </svg>
  );
}
