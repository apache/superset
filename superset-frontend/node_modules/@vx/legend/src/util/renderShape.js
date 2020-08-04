import React from 'react';
import ShapeRect from '../shapes/Rect';
import ShapeCircle from '../shapes/Circle';
import valueOrIdentity from './valueOrIdentity';

export default function renderShape({
  shape = 'rect',
  fill = valueOrIdentity,
  size = valueOrIdentity,
  width,
  height,
  label,
  shapeStyle = x => undefined,
}) {
  const props = {
    width,
    height,
    label,
    fill: fill({ ...label }),
    size: size({ ...label }),
    style: shapeStyle({ ...label }),
  };
  if (typeof shape === 'string') {
    if (shape === 'rect') {
      return <ShapeRect {...props} />;
    }
    return <ShapeCircle {...props} />;
  }
  if (React.isValidElement(shape)) {
    return React.cloneElement(shape, props);
  }
  return React.createElement(shape, props);
}
