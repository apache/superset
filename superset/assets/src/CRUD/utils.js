import React from 'react';

export function recurseReactClone(children, type, propExtender) {
  return React.Children.map(children, (child) => {
    let newChild = child;
    if (child && child.type === type) {
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
