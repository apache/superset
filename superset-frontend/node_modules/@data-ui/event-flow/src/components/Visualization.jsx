import { css, StyleSheet } from 'aphrodite';
import PropTypes from 'prop-types';
import React from 'react';
import SplitPane from 'react-split-pane';

import AggregatePanel, { margin } from './AggregatePanel';
import SingleSequencesPanel from './SingleSequencesPanel';
import { EVENT_COUNT, FILTERED_EVENTS } from '../constants';
import { collectSequencesFromNode } from '../utils/data-utils';
import { graphShape, scaleShape } from '../propShapes';

const styles = StyleSheet.create({
  fillParent: {
    width: '100%',
    height: '100%',
    background: '#fff',
  },

  noPointerEvents: {
    pointerEvents: 'none',
  },
});

const MIN_PANE_SIZE = 10;

const propTypes = {
  graph: graphShape.isRequired,
  xScale: scaleShape.isRequired,
  yScale: scaleShape.isRequired,
  timeScale: scaleShape.isRequired,
  colorScale: scaleShape.isRequired,
  nodeSorter: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  onClickNode: PropTypes.func.isRequired,
};

const defaultProps = {};

class Visualization extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleClickNode = this.handleClickNode.bind(this);
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
    this.onClearSelection = this.onClearSelection.bind(this);

    this.state = {
      paneHeight: props.height - MIN_PANE_SIZE,
      selectedNode: null,
      selectedSequences: null,
      dragging: false,
    };
  }

  componentWillReceiveProps(nextProps) {
    const updateProps = ['graph'];
    if (updateProps.some(key => nextProps[key] !== this.props[key])) {
      this.setState({
        paneHeight: nextProps.height - MIN_PANE_SIZE,
        selectedNode: null,
        selectedSequences: null,
      });
    } else if (nextProps.height !== this.props.height) {
      const { paneHeight } = this.state;
      const { height } = this.props;
      const currDelta = height - paneHeight;
      this.setState({ paneHeight: nextProps.height - currDelta });
    }
  }

  onClearSelection() {
    this.setState({
      selectedNode: null,
      selectedSequences: null,
      paneHeight: this.props.height - MIN_PANE_SIZE,
    });

    this.props.onClickNode(null);
  }

  handleClickNode({ node }) {
    if (node.id === FILTERED_EVENTS) return;

    const { height, graph, onClickNode } = this.props;
    const { selectedNode } = this.state;
    const isSelected = selectedNode && selectedNode.id === node.id;
    const sequences = isSelected ? null : collectSequencesFromNode(node, graph.entityEvents);

    this.setState({
      selectedNode: isSelected ? null : node,
      selectedSequences: sequences,
      paneHeight: isSelected
        ? height - MIN_PANE_SIZE
        : Math.max(
            MIN_PANE_SIZE + 100,
            height - SingleSequencesPanel.getEstimatedHeight(sequences.length),
          ),
    });

    onClickNode(isSelected ? null : node);
  }

  handleDragStart() {
    this.setState({ dragging: true });
  }

  handleDragEnd(paneHeight) {
    this.setState(({ selectedNode, paneHeight: statePaneHeight }) => ({
      dragging: false,
      paneHeight: selectedNode ? paneHeight : statePaneHeight,
    }));
  }

  render() {
    const { graph, xScale, yScale, timeScale, colorScale, nodeSorter, width, height } = this.props;

    const { selectedSequences, selectedNode, paneHeight, dragging } = this.state;

    if (width < 100 || height < 100) return null;

    // if a node is selected, make it the root node + hide others
    const adjustedGraph = selectedNode
      ? {
          ...graph,
          root: {
            ...graph.root,
            [EVENT_COUNT]: selectedNode[EVENT_COUNT],
            children: {
              [selectedNode.id]: selectedNode,
            },
          },
        }
      : graph;

    const adjustedYScale = selectedNode
      ? {
          ...yScale,
          scale: yScale.scale.copy().domain([0, selectedNode[EVENT_COUNT]]),
        }
      : yScale;

    return (
      <div style={{ width, height }}>
        <SplitPane
          split="horizontal"
          size={dragging ? undefined : paneHeight}
          minSize={MIN_PANE_SIZE}
          maxSize={height - MIN_PANE_SIZE}
          onDragStarted={this.handleDragStart}
          onDragFinished={this.handleDragEnd}
        >
          <div className={css(styles.fillParent, dragging && styles.noPointerEvents)}>
            <AggregatePanel
              graph={adjustedGraph}
              xScale={xScale}
              yScale={adjustedYScale}
              timeScale={timeScale}
              colorScale={colorScale}
              onClickNode={this.handleClickNode}
              nodeSorter={nodeSorter}
              width={width}
              height={height}
            />
          </div>
          <div className={css(styles.fillParent)}>
            {selectedSequences && selectedNode && (
              <SingleSequencesPanel
                node={selectedNode}
                sequences={selectedSequences}
                colorScale={colorScale}
                width={width}
                height={height - paneHeight}
                clearSelection={this.onClearSelection}
              />
            )}
          </div>
        </SplitPane>
      </div>
    );
  }
}

Visualization.propTypes = propTypes;
Visualization.defaultProps = defaultProps;

export default Visualization;

export { margin };
