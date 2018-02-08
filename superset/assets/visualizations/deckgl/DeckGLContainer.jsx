import React from 'react';
import PropTypes from 'prop-types';
import MapGL from 'react-map-gl';
import DeckGL from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const propTypes = {
  viewport: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setControlValue: PropTypes.func.isRequired,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  onViewportChange: PropTypes.func,
  renderFrequency: PropTypes.number,
  overlayContent: PropTypes.func,
  animate: PropTypes.bool,
};
const defaultProps = {
  mapStyle: 'light',
  onViewportChange: () => {},
  overlayContent: () => {},
  renderFrequency: 30,
  animate: false,
};

export default class DeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      viewport: props.viewport,
    };
    this.viewportUpdateTick = this.viewportUpdateTick.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    this.renderTick = this.renderTick.bind(this);
  }
  componentWillMount() {
    const viewportUpdateTimer = setInterval(this.viewportUpdateTick, 1000);
    this.setState(() => ({ viewportUpdateTimer }));
    if (this.props.animate) {
      this.setRenderTimer();
    }
  }
  componentWillReceiveProps(nextProps) {
    this.setState(() => ({
      viewport: { ...nextProps.viewport },
      previousViewport: this.state.viewport,
    }));
    if (nextProps.animate) {
      this.setRenderTimer();
    } else {
      this.unsetRenderTimer();
    }
  }
  componentWillUnmount() {
    clearInterval(this.state.timer);
  }
  onViewportChange(viewport) {
    const vp = Object.assign({}, viewport);
    delete vp.width;
    delete vp.height;
    const newVp = { ...this.state.viewport, ...vp };

    this.setState(() => ({ viewport: newVp }));
    this.props.onViewportChange(newVp);
  }
  setRenderTimer() {
    if (!this.state.renderTimer) {
      const renderTimer = setInterval(this.renderTick, this.props.renderFrequency);
      this.setState(() => ({ renderTimer }));
    }
  }
  unsetRenderTimer() {
    if (this.state.renderTimer) {
      clearInterval(this.state.renderTimer);
      this.setState({ renderTimer: null });
    }
  }
  viewportUpdateTick() {
    // Limiting updating viewport controls through Redux at most 1*sec
    if (this.state.previousViewport !== this.state.viewport) {
      const setCV = this.props.setControlValue;
      const vp = this.state.viewport;
      if (setCV) {
        setCV('viewport', vp);
      }
      this.setState(() => ({ previousViewport: this.state.viewport }));
    }
  }
  layers() {
    // Support for layer factory
    if (this.props.layers.some(l => typeof l === 'function')) {
      return this.props.layers.map(l => typeof l === 'function' ? l() : l);
    }
    return this.props.layers;
  }
  renderTick() {
    this.setState({ dttm: Date.now() });
  }
  renderOverlay() {
    const content = this.props.overlayContent();
    if (content) {
      return (
        <div style={{
          position: 'absolute',
          top: 5,
          padding: 5,
          left: 15,
          zIndex: 1000,
          fontSize: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
        }}
        >
          {content}
        </div>
      );
    }
    return null;
  }
  render() {
    const { viewport } = this.state;

    return (
      <div>
        {this.renderOverlay()}
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
      </div>
    );
  }
}

DeckGLContainer.propTypes = propTypes;
DeckGLContainer.defaultProps = defaultProps;
