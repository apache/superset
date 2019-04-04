import {createElement} from 'react';
import PropTypes from 'prop-types';
import BaseControl from './base-control';

import MapState from '../utils/map-state';
import {LINEAR_TRANSITION_PROPS} from '../utils/map-controller';

import deprecateWarn from '../utils/deprecate-warn';

const propTypes = Object.assign({}, BaseControl.propTypes, {
  // Custom className
  className: PropTypes.string,
  // Callbacks fired when the user interacted with the map. The object passed to the callbacks
  // contains viewport properties such as `longitude`, `latitude`, `zoom` etc.
  onViewStateChange: PropTypes.func,
  onViewportChange: PropTypes.func,
  // Show/hide compass button
  showCompass: PropTypes.bool,
  // Show/hide zoom buttons
  showZoom: PropTypes.bool
});

const defaultProps = Object.assign({}, BaseControl.defaultProps, {
  className: '',
  onViewStateChange: () => {},
  onViewportChange: () => {},
  showCompass: true,
  showZoom: true
});

/*
 * PureComponent doesn't update when context changes, so
 * implementing our own shouldComponentUpdate here.
 */
export default class NavigationControl extends BaseControl {

  static propTypes = propTypes;
  static defaultProps = defaultProps;

  constructor(props) {
    super(props);
    // Check for deprecated props
    deprecateWarn(props);
  }

  _updateViewport(opts) {
    const {viewport} = this._context;
    const mapState = new MapState(Object.assign({}, viewport, opts));
    const viewState = Object.assign({}, mapState.getViewportProps(), LINEAR_TRANSITION_PROPS);

    // Call new style callback
    this.props.onViewStateChange({viewState});

    // Call old style callback
    this.props.onViewportChange(viewState);
  }

  _onZoomIn = () => {
    this._updateViewport({zoom: this._context.viewport.zoom + 1});
  }

  _onZoomOut = () => {
    this._updateViewport({zoom: this._context.viewport.zoom - 1});
  }

  _onResetNorth = () => {
    this._updateViewport({bearing: 0, pitch: 0});
  }

  _renderCompass() {
    const {bearing} = this._context.viewport;
    return createElement('span', {
      className: 'mapboxgl-ctrl-compass-arrow',
      style: {transform: `rotate(${-bearing}deg)`}
    });
  }

  _renderButton(type, label, callback, children) {
    return createElement('button', {
      key: type,
      className: `mapboxgl-ctrl-icon mapboxgl-ctrl-${type}`,
      type: 'button',
      title: label,
      onClick: callback,
      children
    });
  }

  _render() {
    const {className, showCompass, showZoom} = this.props;

    return createElement('div', {
      className: `mapboxgl-ctrl mapboxgl-ctrl-group ${className}`,
      ref: this._containerRef
    }, [
      showZoom && this._renderButton('zoom-in', 'Zoom In', this._onZoomIn),
      showZoom && this._renderButton('zoom-out', 'Zoom Out', this._onZoomOut),
      showCompass &&
        this._renderButton('compass', 'Reset North', this._onResetNorth, this._renderCompass())
    ]);
  }
}
