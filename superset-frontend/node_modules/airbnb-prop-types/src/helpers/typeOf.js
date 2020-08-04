import React from 'react';

export default function typeOf(child) {
  if (child === null) {
    return 'null';
  }
  if (Array.isArray(child)) {
    return 'array';
  }
  if (typeof child !== 'object') {
    return typeof child;
  }
  if (React.isValidElement(child)) {
    return child.type;
  }
  return child;
}
