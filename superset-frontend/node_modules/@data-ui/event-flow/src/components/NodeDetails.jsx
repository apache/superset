import React from 'react';

import { nodeShape, scaleShape } from '../propShapes';
import { ancestorsFromNode } from '../utils/graph-utils';
import { oneDecimal } from '../utils/scale-utils';

import { ELAPSED_MS_ROOT, ELAPSED_MS, EVENT_COUNT } from '../constants';

import NodeSequence from './NodeSequence';

const propTypes = {
  node: nodeShape,
  root: nodeShape,
  timeScale: scaleShape.isRequired,
  colorScale: scaleShape.isRequired,
};

const defaultProps = {
  node: null,
  root: null,
};

function NodeDetails({ node, root, timeScale, colorScale }) {
  if (!node || !root) return null;

  const sequence = ancestorsFromNode(node);
  const hasNegativeDepth = sequence[0].depth < 0 || sequence[sequence.length - 1].depth < 0;
  const currNodeIndex = hasNegativeDepth ? 0 : sequence.length - 1;
  const separator = hasNegativeDepth ? ' < ' : ' > ';
  const subSequenceIndex = hasNegativeDepth ? [0, 2] : [-2];
  if (hasNegativeDepth) sequence.reverse();

  const Sequence = (
    <NodeSequence
      nodeArray={sequence}
      currNodeIndex={currNodeIndex}
      separator={separator}
      colorScale={colorScale}
    />
  );

  const SubSequence =
    sequence.length <= 2 ? null : (
      <NodeSequence
        nodeArray={sequence.slice(...subSequenceIndex)}
        currNodeIndex={hasNegativeDepth ? 0 : 1}
        separator={separator}
        colorScale={colorScale}
      />
    );

  const currNode = sequence[currNodeIndex];
  const nodeEvents = currNode[EVENT_COUNT];
  const percentOfPrev = `${oneDecimal(
    (nodeEvents / (currNode.parent || currNode)[EVENT_COUNT]) * 100,
  )}%`;
  const percentOfRoot = `${oneDecimal((nodeEvents / root[EVENT_COUNT]) * 100)}%`;

  const elapsedToNode = timeScale.format(currNode[ELAPSED_MS]);
  const elapsedToRoot = timeScale.format(currNode[ELAPSED_MS_ROOT]);

  return (
    <div>
      {SubSequence}
      {SubSequence && (
        <div>
          <div>
            <strong>{nodeEvents}</strong> events
          </div>
          <div>
            <strong>{elapsedToNode}</strong> mean elapsed time
          </div>
          <div>
            <strong>{percentOfPrev}</strong> of previous
          </div>
          <br />
        </div>
      )}

      {Sequence}
      <div>
        {!SubSequence && (
          <div>
            <strong>{nodeEvents}</strong> events
          </div>
        )}
        {!SubSequence && currNode.depth !== 0 && (
          <div>
            <strong>{percentOfPrev}</strong> of previous
          </div>
        )}
        <div>
          <strong>{percentOfRoot}</strong> of root
        </div>
        <div>
          <strong>{elapsedToRoot}</strong> mean elapsed time to root
        </div>
      </div>
    </div>
  );
}

NodeDetails.propTypes = propTypes;
NodeDetails.defaultProps = defaultProps;

export default NodeDetails;
