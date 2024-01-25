// DODO was here
import React from 'react';
import PropTypes from 'prop-types';
import { isEqual } from 'lodash';
import { StaticMap } from 'react-map-gl';
import DeckGL from 'deck.gl';
import { styled } from '@superset-ui/core';
import Tooltip from './components/Tooltip';
// DODO changed
// import 'mapbox-gl/dist/mapbox-gl.css';

const TICK = 250; // milliseconds

const propTypes = {
  viewport: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setControlValue: PropTypes.func,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  children: PropTypes.node,
  bottomMargin: PropTypes.number,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  onViewportChange: PropTypes.func,
};
const defaultProps = {
  mapStyle: 'light',
  setControlValue: () => {},
  children: null,
  bottomMargin: 0,
};

export class DeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    this.tick = this.tick.bind(this);
    this.onViewStateChange = this.onViewStateChange.bind(this);
    // This has to be placed after this.tick is bound to this
    this.state = {
      timer: setInterval(this.tick, TICK),
      tooltip: null,
      viewState: props.viewport,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!isEqual(nextProps.viewport, this.props.viewport)) {
      this.setState({ viewState: nextProps.viewport });
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.timer);
  }

  onViewStateChange({ viewState }) {
    this.setState({ viewState, lastUpdate: Date.now() });
  }

  tick() {
    // Rate limiting updating viewport controls as it triggers lotsa renders
    const { lastUpdate } = this.state;
    if (lastUpdate && Date.now() - lastUpdate > TICK) {
      const setCV = this.props.setControlValue;
      if (setCV) {
        setCV('viewport', this.state.viewState);
      }
      this.setState({ lastUpdate: null });
    }
  }

  layers() {
    // Support for layer factory
    if (this.props.layers.some(l => typeof l === 'function')) {
      return this.props.layers.map(l => (typeof l === 'function' ? l() : l));
    }

    return this.props.layers;
  }

  setTooltip = tooltip => {
    this.setState({ tooltip });
  };

  render() {
    const { children, bottomMargin, height, width } = this.props;
    const { viewState, tooltip } = this.state;
    const adjustedHeight = height - bottomMargin;

    const layers = this.layers();

    return (
      <>
        <div style={{ position: 'relative', width, height: adjustedHeight }}>
          <DeckGL
            initWebGLParameters
            controller
            width={width}
            height={adjustedHeight}
            layers={layers}
            viewState={viewState}
            glOptions={{ preserveDrawingBuffer: true }}
            onViewStateChange={this.onViewStateChange}
          >
            <StaticMap
              preserveDrawingBuffer
              mapStyle={this.props.mapStyle}
              mapboxApiAccessToken={this.props.mapboxApiAccessToken}
            />
          </DeckGL>
          {children}
        </div>
        <Tooltip tooltip={tooltip} />
      </>
    );
  }
}

DeckGLContainer.propTypes = propTypes;
DeckGLContainer.defaultProps = defaultProps;

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
