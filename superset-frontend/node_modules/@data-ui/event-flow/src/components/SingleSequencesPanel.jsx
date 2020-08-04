import { Button } from '@data-ui/forms';
import { css, StyleSheet } from 'aphrodite';
import PropTypes from 'prop-types';
import React from 'react';

import NodeSequence from './NodeSequence';
import SequenceVisualization, { margin } from './SequenceVisualization';

import { computeTimeScaleForSequences, computeEntityNameScale } from '../utils/scale-utils';
import { ancestorsFromNode } from '../utils/graph-utils';
import { datumShape, scaleShape, nodeShape } from '../propShapes';
import { unit } from '../theme';

const styles = StyleSheet.create({
  container: {
    fontFamily: 'BlinkMacSystemFont,Roboto,Helvetica Neue,sans-serif', // @todo port to withStyles
    background: '#fff',
    width: '100%',
    borderTop: '1px solid #ddd',
    overflowY: 'auto',
    overflowX: 'hidden',
    dipslay: 'flex',
    flexDirection: 'column',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  nodeSequence: {
    paddingTop: Number(unit),
    paddingLeft: Number(unit),
    flexGrow: 1,
    flexWrap: 'wrap',
  },

  controls: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    flexShrink: 0,
    fontWeight: 200,
    marginLeft: Number(unit),
  },

  checkbox: {
    marginRight: Number(unit),
  },
});

const propTypes = {
  sequences: PropTypes.arrayOf(PropTypes.arrayOf(datumShape)),
  node: nodeShape.isRequired,
  clearSelection: PropTypes.func.isRequired,
  colorScale: scaleShape.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};

const defaultProps = {
  sequences: [],
};

class SingleSequencePanel extends React.PureComponent {
  constructor(props) {
    super(props);
    const { sequences, width } = props;
    const innerWidth = width - margin.left - margin.right;

    this.state = {
      xScale: computeTimeScaleForSequences(sequences, innerWidth),
      yScale: computeEntityNameScale(sequences),
    };
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.sequences &&
      (this.props.sequences !== nextProps.sequences || this.width !== nextProps.width)
    ) {
      const { sequences, width } = nextProps;
      const innerWidth = width - margin.left - margin.right;
      this.setState({
        xScale: computeTimeScaleForSequences(sequences, innerWidth),
        yScale: computeEntityNameScale(sequences),
      });
    }
  }

  // given a sequence count, returns an estimate of the panel height
  static getEstimatedHeight(numSequences) {
    return numSequences * 30 + margin.top + 75;
  }

  render() {
    const { node, sequences, colorScale, clearSelection, height } = this.props;
    const { xScale, yScale } = this.state;
    const hasSequences = sequences && sequences.length > 0;
    const nodeSequence = ancestorsFromNode(node);

    if (!hasSequences || !node) {
      return null;
    }

    return (
      <div className={css(styles.container)} style={{ height }}>
        <div className={css(styles.header)}>
          <div className={css(styles.nodeSequence)}>
            <NodeSequence
              nodeArray={node.depth < 0 ? nodeSequence.reverse() : nodeSequence}
              separator={node.depth < 0 ? ' < ' : ' > '}
              colorScale={colorScale}
            />
          </div>
          <div className={css(styles.controls)}>
            <Button onClick={clearSelection} disabled={!hasSequences} small>
              Clear Selection ({sequences.length})
            </Button>
          </div>
        </div>
        <SequenceVisualization
          sequences={sequences}
          xScale={xScale}
          yScale={yScale}
          colorScale={colorScale}
          emphasisIndex={node.depth}
        />
      </div>
    );
  }
}

SingleSequencePanel.propTypes = propTypes;
SingleSequencePanel.defaultProps = defaultProps;

export default SingleSequencePanel;
