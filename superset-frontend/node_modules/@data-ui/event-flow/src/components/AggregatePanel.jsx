import { Group } from '@vx/group';
import React from 'react';
import { RectClipPath } from '@vx/clip-path';
import PropTypes from 'prop-types';

import { event as d3Event, select as d3Select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';

import { graphShape, scaleShape } from '../propShapes';

import { CLIP_ID } from '../constants';
import FilteredEventsPattern from './FilteredEventsPattern';
import NodeDetails from './NodeDetails';
import SubTree from './SubTree';
import Tooltip from './Tooltip';
import XAxis from './XAxis';
import YAxis from './YAxis';
import ZeroLine from './ZeroLine';

export const margin = {
  top: XAxis.height + 16,
  right: 32,
  bottom: 32,
  left: YAxis.width,
};

const ZOOM_SCALE_EXTENT = [1, 40];

const propTypes = {
  graph: graphShape.isRequired,
  xScale: scaleShape.isRequired,
  yScale: scaleShape.isRequired,
  timeScale: scaleShape.isRequired,
  colorScale: scaleShape.isRequired,
  nodeSorter: PropTypes.func.isRequired,

  onClickNode: PropTypes.func,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};

const defaultProps = {
  onClickNode: () => {},
};

class AggregatePanel extends React.PureComponent {
  static clearedState() {
    return {
      xScaleZoomed: null,
      yScaleZoomed: null,
      viewTransform: null,
      tooltip: null,
    };
  }

  constructor(props) {
    super(props);

    this.resetZoom = this.resetZoom.bind(this);
    this.panOrZoom = this.panOrZoom.bind(this);
    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);

    this.zoom = d3Zoom()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .on('zoom', this.panOrZoom);

    this.state = {
      ...AggregatePanel.clearedState(),
    };
  }

  componentDidMount() {
    this.zoom(d3Select(this.svg)); // this attaches all zoom-related listeners to the view ref
    this.resetZoom();
  }

  componentWillReceiveProps(nextProps) {
    if (Object.keys(nextProps).some(prop => nextProps[prop] !== this.props[prop])) {
      this.resetZoom(nextProps);
      this.setState({ ...AggregatePanel.clearedState() });
    }
  }

  handleMouseOver({ node, link, coords }) {
    const { xScale, yScale } = this.props;
    const { xScaleZoomed, yScaleZoomed } = this.state;
    this.setState({
      tooltip: {
        node: node || link.target,
        left: xScaleZoomed ? xScaleZoomed(xScale.scale.invert(coords.x)) : coords.x,
        top: yScaleZoomed ? yScaleZoomed(yScale.scale.invert(coords.y)) : coords.y,
      },
    });
  }

  handleMouseOut() {
    this.setState({ tooltip: null });
  }

  resetZoom(props) {
    const innerWidth = (props || this.props).width - margin.left - margin.right;
    const innerHeight = (props || this.props).height - margin.top - margin.bottom;

    this.zoom.translateExtent([[0, 0], [innerWidth, innerHeight]]);
    this.zoom.extent([[0, 0], [innerWidth, innerHeight]]);

    if (this.svg) {
      this.zoom.transform(d3Select(this.svg), zoomIdentity);
    }
  }

  panOrZoom() {
    const { xScale, yScale } = this.props;
    const { viewTransform: currViewTransform } = this.state;

    const viewTransform = d3Event.transform.toString();

    if (viewTransform !== currViewTransform) {
      this.setState({
        xScaleZoomed: d3Event.transform.rescaleX(xScale.scale),
        yScaleZoomed: d3Event.transform.rescaleY(yScale.scale),
        viewTransform,
        tooltip: null,
      });
    }
  }

  render() {
    const {
      graph,
      width,
      height,
      xScale,
      yScale,
      timeScale,
      colorScale,
      onClickNode,
      nodeSorter,
    } = this.props;

    const { xScaleZoomed, yScaleZoomed, viewTransform, tooltip } = this.state;

    const innerWidth = Math.max(...xScale.scale.range());
    const innerHeight = Math.max(...yScale.scale.range());

    return (
      <div style={{ position: 'relative', width, height }}>
        <svg
          role="img"
          aria-label="Aggregated events"
          width={width}
          height={height - 5}
          ref={ref => {
            this.svg = ref;
          }}
          style={{ cursor: 'move' }}
        >
          <Group top={margin.top} left={margin.left}>
            <RectClipPath
              id={CLIP_ID}
              x={-2}
              y={0}
              width={innerWidth + margin.right + 2}
              height={innerHeight}
            />
            <FilteredEventsPattern />
            <YAxis
              scale={yScaleZoomed || yScale.scale}
              label={yScale.label}
              labelOffset={margin.left * 0.6}
              width={innerWidth}
            />
            <g clipPath={`url(#${CLIP_ID})`}>
              <g transform={viewTransform}>
                <SubTree
                  nodes={graph.root.children}
                  xScale={xScale.scale}
                  yScale={yScale.scale}
                  colorScale={colorScale.scale}
                  getX={xScale.accessor}
                  getY={yScale.accessor}
                  getColor={colorScale.accessor}
                  onFocus={this.handleMouseOver}
                  onBlur={this.handleMouseOut}
                  onMouseOver={this.handleMouseOver}
                  onMouseOut={this.handleMouseOut}
                  onClick={onClickNode}
                  nodeSorter={nodeSorter}
                />
                <ZeroLine xScale={xScale.scale} yScale={yScale.scale} />
              </g>
            </g>
            <XAxis
              scale={xScaleZoomed || xScale.scale}
              label={xScale.label}
              labelOffset={margin.top * 0.6}
              height={innerHeight}
              tickFormat={xScale.format}
            />
          </Group>
        </svg>
        {tooltip && (
          <Tooltip left={tooltip.left + margin.left} top={tooltip.top + margin.top}>
            <NodeDetails
              node={tooltip.node}
              root={graph.root}
              colorScale={colorScale}
              timeScale={timeScale}
            />
          </Tooltip>
        )}
      </div>
    );
  }
}

AggregatePanel.propTypes = propTypes;
AggregatePanel.defaultProps = defaultProps;

export default AggregatePanel;
