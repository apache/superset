import React from 'react';

export function recurseReactClone(children, type, propExtender) {
  /**
   * Clones a React component's children, and injects new props
   * where the type specified is matched.
   */
  return React.Children.map(children, (child) => {
    let newChild = child;
    if (child && child.type.name === type.name) {
      newChild = React.cloneElement(child, propExtender(child));
    }
    if (newChild && newChild.props.children) {
      newChild = React.cloneElement(newChild, {
        children: recurseReactClone(newChild.props.children, type, propExtender),
      });
    }
    return newChild;
  });
}
