import React from 'react';
import PropTypes from 'prop-types';
import JSONNestedNode from './JSONNestedNode';

// Returns the "n Items" string for this node,
// generating and caching it if it hasn't been created yet.
function createItemString(data) {
  const len = Object.getOwnPropertyNames(data).length;
  return `${len} ${len !== 1 ? 'keys' : 'key'}`;
}

// Configures <JSONNestedNode> to render an Object
const JSONObjectNode = ({ data, ...props }) => (
  <JSONNestedNode
    {...props}
    data={data}
    nodeType="Object"
    nodeTypeIndicator={props.nodeType === 'Error' ? 'Error()' : '{}'}
    createItemString={createItemString}
    expandable={Object.getOwnPropertyNames(data).length > 0}
  />
);

JSONObjectNode.propTypes = {
  data: PropTypes.object,
  nodeType: PropTypes.string
};

export default JSONObjectNode;
