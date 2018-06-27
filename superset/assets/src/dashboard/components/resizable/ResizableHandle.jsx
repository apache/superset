import React from 'react';

export function BottomRightResizeHandle() {
  return <div className="resize-handle resize-handle--bottom-right" />;
}

export function RightResizeHandle() {
  return <div className="resize-handle resize-handle--right" />;
}

export function BottomResizeHandle() {
  return <div className="resize-handle resize-handle--bottom" />;
}

export default {
  right: RightResizeHandle,
  bottom: BottomResizeHandle,
  bottomRight: BottomRightResizeHandle,
};
