import React from 'react';
import PropTypes from 'prop-types';
import MapGL from 'react-map-gl';
import DeckGL from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const TICK = 1000;  // milliseconds

const propTypes = {
  viewport: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setControlValue: PropTypes.func,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  onViewportChange: PropTypes.func,
};
const defaultProps = {
  mapStyle: 'light',
  onViewportChange: () => {},
  setControlValue: () => {},
};

export default class DeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      previousViewport: props.viewport,
      timer: setInterval(this.tick, TICK),
    };
    this.tick = this.tick.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
  }
  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.viewport !== prevState.viewport) {
      return {
        viewport: { ...nextProps.viewport },
        previousViewport: prevState.viewport,
      };
    }
    return null;
  }
  componentWillUnmount() {
    clearInterval(this.state.timer);
  }
  onViewportChange(viewport) {
    const vp = Object.assign({}, viewport);
    // delete vp.width;
    // delete vp.height;
    const newVp = { ...this.state.previousViewport, ...vp };

    // this.setState(() => ({ viewport: newVp }));
    this.props.onViewportChange(newVp);
  }
  tick() {
    // Limiting updating viewport controls through Redux at most 1*sec
    if (this.state && this.state.previousViewport !== this.props.viewport) {
      const setCV = this.props.setControlValue;
      const vp = this.props.viewport;
      if (setCV) {
        setCV('viewport', vp);
      }
      this.setState(() => ({ previousViewport: this.props.viewport }));
    }
  }
  layers() {
    // Support for layer factory
    if (this.props.layers.some(l => typeof l === 'function')) {
      return this.props.layers.map(l => typeof l === 'function' ? l() : l);
    }
    return this.props.layers;
  }
  render() {
    const { viewport } = this.props;
    return (
      <MapGL
        {...viewport}
        mapStyle={this.props.mapStyle}
        onViewportChange={this.onViewportChange}
        mapboxApiAccessToken={this.props.mapboxApiAccessToken}
      >
        <DeckGL
          {...viewport}
          layers={this.layers()}
          initWebGLParameters
        />
      </MapGL>
    );
  }
}

DeckGLContainer.propTypes = propTypes;
DeckGLContainer.defaultProps = defaultProps;
