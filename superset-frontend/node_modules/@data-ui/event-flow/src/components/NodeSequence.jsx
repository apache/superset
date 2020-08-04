import { css, StyleSheet } from 'aphrodite';
import React from 'react';
import PropTypes from 'prop-types';

import { nodeShape, scaleShape } from '../propShapes';

const styles = StyleSheet.create({
  container: {
    fontFamily: 'BlinkMacSystemFont,Roboto,Helvetica Neue,sans-serif',
  },

  separator: {
    color: '#484848',
    fontSize: 14,
  },

  node: {
    fontSize: 15,
    fontWeight: 200,
    textTransform: 'uppercase',
  },

  currNode: {
    fontWeight: 700,
    textDecoration: 'underline',
    textDecorationColor: '#484848',
  },
});

const propTypes = {
  nodeArray: PropTypes.arrayOf(nodeShape),
  currNodeIndex: PropTypes.number,
  separator: PropTypes.node,
  colorScale: scaleShape.isRequired,
  maxNameLength: PropTypes.number,
  maxNodeLength: PropTypes.number,
};

const defaultProps = {
  nodeArray: [],
  currNodeIndex: -1,
  separator: ' > ',
  maxNameLength: 10,
  maxNodeLength: 5,
};

function NodeSequence({
  nodeArray,
  currNodeIndex,
  separator,
  colorScale,
  maxNameLength,
  maxNodeLength,
}) {
  let nodes = nodeArray;
  if (nodes.length > maxNodeLength) {
    nodes = [...nodeArray.slice(0, 2), null, ...nodeArray.slice(-(maxNodeLength - 3))];
  }

  return nodeArray.length ? (
    <div className={css(styles.container)}>
      {nodes.map((node, index) => {
        let name;
        if (node) {
          name =
            node.name.length > maxNameLength
              ? `${node.name.slice(0, maxNameLength + 1)}…`
              : node.name;
        } else {
          name = `+${nodeArray.length - nodes.length} more…`;
        }

        return (
          <span key={(node && node.id) || '...'}>
            {index !== 0 && <span className={css(styles.separator)}>{separator}</span>}
            <span
              className={css(styles.node, index === currNodeIndex && styles.currNode)}
              style={{
                color: node && colorScale.scale(colorScale.accessor(node)),
              }}
            >
              {name}
            </span>
          </span>
        );
      })}
    </div>
  ) : null;
}

NodeSequence.propTypes = propTypes;
NodeSequence.defaultProps = defaultProps;

export default NodeSequence;
