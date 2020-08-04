import React from 'react';

export default function renderableChildren(childrenProp) {
  return React.Children.toArray(childrenProp).filter((child) => child === 0 || child);
}
