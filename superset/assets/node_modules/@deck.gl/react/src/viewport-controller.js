import {Component, createElement} from 'react';
import PropTypes from 'prop-types';

import {EventManager} from 'mjolnir.js';
import {MapController as ViewportControls} from '@deck.gl/core';

import CURSOR from './utils/cursors';

const propTypes = {
  viewportState: PropTypes.func,
  state: PropTypes.object,

  /** Viewport props */
  /** The width of the map. */
  width: PropTypes.number.isRequired,
  /** The height of the map. */
  height: PropTypes.number.isRequired,
  /** The longitude of the center of the map. */
  longitude: PropTypes.number.isRequired,
  /** The latitude of the center of the map. */
  latitude: PropTypes.number.isRequired,
  /** The tile zoom level of the map. */
  zoom: PropTypes.number.isRequired,
  /** Specify the bearing of the viewport */
  bearing: PropTypes.number,
  /** Specify the pitch of the viewport */
  pitch: PropTypes.number,
  /** Altitude of the viewport camera. Default 1.5 "screen heights" */
  // Note: Non-public API, see https://github.com/mapbox/mapbox-gl-js/issues/1137
  altitude: PropTypes.number,
  // Camera position for FirstPersonViewport
  position: PropTypes.array,

  /** Viewport constraints */
  // Max zoom level
  maxZoom: PropTypes.number,
  // Min zoom level
  minZoom: PropTypes.number,
  // Max pitch in degrees
  maxPitch: PropTypes.number,
  // Min pitch in degrees
  minPitch: PropTypes.number,

  /**
   * `onViewportChange` callback is fired when the user interacted with the
   * map. The object passed to the callback contains viewport properties
   * such as `longitude`, `latitude`, `zoom` etc.
   */
  onViewportChange: PropTypes.func,

  /** Viewport transition **/
  // transition duration for viewport change
  transitionDuration: PropTypes.number,
  // an instance of ViewportTransitionInterpolator, can be used to perform custom transitions.
  transitionInterpolator: PropTypes.object,
  // type of interruption of current transition on update.
  transitionInterruption: PropTypes.number,
  // easing function
  transitionEasing: PropTypes.func,
  // transition status update functions
  onTransitionStart: PropTypes.func,
  onTransitionInterrupt: PropTypes.func,
  onTransitionEnd: PropTypes.func,

  /** Enables control event handling */
  // Scroll to zoom
  scrollZoom: PropTypes.bool,
  // Drag to pan
  dragPan: PropTypes.bool,
  // Drag to rotate
  dragRotate: PropTypes.bool,
  // Double click to zoom
  doubleClickZoom: PropTypes.bool,
  // Pinch to zoom / rotate
  touchZoomRotate: PropTypes.bool,

  /** Accessor that returns a cursor style to show interactive state */
  getCursor: PropTypes.func,

  // A map control instance to replace the default map controls
  // The object must expose one property: `events` as an array of subscribed
  // event names; and two methods: `setState(state)` and `handle(event)`
  controls: PropTypes.shape({
    events: PropTypes.arrayOf(PropTypes.string),
    handleEvent: PropTypes.func
  })
};

const getDefaultCursor = ({isDragging}) => (isDragging ? CURSOR.GRABBING : CURSOR.GRAB);

const defaultProps = {
  onViewportChange: null,

  scrollZoom: true,
  dragPan: true,
  dragRotate: true,
  doubleClickZoom: true,
  touchZoomRotate: true,

  getCursor: getDefaultCursor
};

export default class ViewportController extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isDragging: false // Whether the cursor is down
    };
  }

  componentDidMount() {
    this._eventManager = new EventManager(this.eventCanvas);

    // If props.controls is not provided, fallback to default MapControls instance
    // Cannot use defaultProps here because it needs to be per map instance
    this._controls = this.props.controls || new ViewportControls(this.props.viewportState);

    this._controls.setOptions(
      Object.assign({}, this.props, {
        onStateChange: this._onInteractiveStateChange.bind(this),
        eventManager: this._eventManager
      })
    );
  }

  componentWillUpdate(nextProps) {
    if (this._controls) {
      this._controls.setOptions(nextProps);
    }
  }

  componentWillUnmount() {
    this._eventManager.destroy();
  }

  _onInteractiveStateChange({isDragging = false}) {
    if (isDragging !== this.state.isDragging) {
      this.setState({isDragging});
    }
  }

  render() {
    const {width, height, getCursor} = this.props;

    const eventCanvasStyle = {
      width,
      height,
      position: 'relative',
      cursor: getCursor(this.state)
    };

    return createElement(
      'div',
      {
        key: 'map-controls',
        ref: c => (this.eventCanvas = c),
        style: eventCanvasStyle
      },
      this.props.children
    );
  }
}

ViewportController.displayName = 'ViewportController';
ViewportController.propTypes = propTypes;
ViewportController.defaultProps = defaultProps;
