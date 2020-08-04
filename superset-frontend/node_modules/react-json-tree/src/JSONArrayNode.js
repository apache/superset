import React from 'react';
import PropTypes from 'prop-types';
import JSONNestedNode from './JSONNestedNode';

// Returns the "n Items" string for this node,
// generating and caching it if it hasn't been created yet.
function createItemString(data) {
  return `${data.length} ${data.length !== 1 ? 'items' : 'item'}`;
}

// Configures <JSONNestedNode> to render an Array
const JSONArrayNode = ({ data, ...props }) => (
  <JSONNestedNode
    {...props}
    data={data}
    nodeType="Array"
    nodeTypeIndicator="[]"
    createItemString={createItemString}
    expandable={data.length > 0}
  />
);

JSONArrayNode.propTypes = {
  data: PropTypes.array
};

export default JSONArrayNode;
