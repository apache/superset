import React from 'react';
import JSONNestedNode from './JSONNestedNode';

// Returns the "n Items" string for this node,
// generating and caching it if it hasn't been created yet.
function createItemString(data, limit) {
  let count = 0;
  let hasMore = false;
  if (Number.isSafeInteger(data.size)) {
    count = data.size;
  } else {
    // eslint-disable-next-line no-unused-vars
    for (const entry of data) {
      if (limit && count + 1 > limit) {
        hasMore = true;
        break;
      }
      count += 1;
    }
  }
  return `${hasMore ? '>' : ''}${count} ${count !== 1 ? 'entries' : 'entry'}`;
}

// Configures <JSONNestedNode> to render an iterable
export default function JSONIterableNode({ ...props }) {
  return (
    <JSONNestedNode
      {...props}
      nodeType="Iterable"
      nodeTypeIndicator="()"
      createItemString={createItemString}
    />
  );
}
