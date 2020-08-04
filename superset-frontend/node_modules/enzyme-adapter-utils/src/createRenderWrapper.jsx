import React from 'react';

export default function createRenderWrapper(node, context, childContextTypes) {
  class ContextWrapper extends React.Component {
    getChildContext() {
      return context;
    }

    render() {
      return node;
    }
  }
  ContextWrapper.childContextTypes = childContextTypes;
  return ContextWrapper;
}
