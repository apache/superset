// @flow
import React from 'react';
import PropTypes from 'prop-types';
import BaseControl from './base-control';

import MapState from '../utils/map-state';
import {LINEAR_TRANSITION_PROPS} from '../utils/map-controller';

import deprecateWarn from '../utils/deprecate-warn';

import type {BaseControlProps} from './base-control';

const noop = () => {};

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
  showCompass: true,
  showZoom: true
});

export type NavigationControlProps = BaseControlProps & {
  className: string,
  onViewStateChange?: Function,
  onViewportChange?: Function,
  showCompass: boolean,
  showZoom: boolean
};

type ViewportProps = {
  longitude: number,
  latitude: number,
  zoom: number,
  pitch: number,
  bearing: number
};

/*
 * PureComponent doesn't update when context changes, so
 * implementing our own shouldComponentUpdate here.
 */
export default class NavigationControl extends BaseControl<
  NavigationControlProps,
  *,
  HTMLDivElement
> {
  static propTypes = propTypes;
  static defaultProps = defaultProps;

  constructor(props: NavigationControlProps) {
    super(props);
    // Check for deprecated props
    deprecateWarn(props);
  }

  _updateViewport(opts: $Shape<ViewportProps>) {
    const {viewport} = this._context;
    const mapState = new MapState(Object.assign({}, viewport, opts));
    const viewState = Object.assign({}, mapState.getViewportProps(), LINEAR_TRANSITION_PROPS);

    const onViewportChange = this.props.onViewportChange || this._context.onViewportChange || noop;
    const onViewStateChange =
      this.props.onViewStateChange || this._context.onViewStateChange || noop;

    // Call new style callback
    onViewStateChange({viewState});

    // Call old style callback
    onViewportChange(viewState);
  }

  _onZoomIn = () => {
    this._updateViewport({zoom: this._context.viewport.zoom + 1});
  };

  _onZoomOut = () => {
    this._updateViewport({zoom: this._context.viewport.zoom - 1});
  };

  _onResetNorth = () => {
    this._updateViewport({bearing: 0, pitch: 0});
  };

  _renderCompass() {
    const {bearing} = this._context.viewport;
    return (
      <span className="mapboxgl-ctrl-compass-arrow" style={{transform: `rotate(${-bearing}deg)`}} />
    );
  }

  _renderButton(type: string, label: string, callback: Function, children: any) {
    return (
      <button
        key={type}
        className={`mapboxgl-ctrl-icon mapboxgl-ctrl-${type}`}
        type="button"
        title={label}
        onClick={callback}
      >
        {children}
      </button>
    );
  }

  _render() {
    const {className, showCompass, showZoom} = this.props;

    return (
      <div className={`mapboxgl-ctrl mapboxgl-ctrl-group ${className}`} ref={this._containerRef}>
        {showZoom && this._renderButton('zoom-in', 'Zoom In', this._onZoomIn)}
        {showZoom && this._renderButton('zoom-out', 'Zoom Out', this._onZoomOut)}
        {showCompass &&
          this._renderButton('compass', 'Reset North', this._onResetNorth, this._renderCompass())}
      </div>
    );
  }
}
