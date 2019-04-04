// @flow
import {PureComponent, createElement, createContext, createRef} from 'react';
import PropTypes from 'prop-types';

import StaticMap from './static-map';
import {MAPBOX_LIMITS} from '../utils/map-state';
import WebMercatorViewport from 'viewport-mercator-project';

import TransitionManager from '../utils/transition-manager';

import {EventManager} from 'mjolnir.js';
import MapController from '../utils/map-controller';
import deprecateWarn from '../utils/deprecate-warn';

import type {ViewState} from '../mapbox/mapbox';
import type {StaticMapProps} from './static-map';
import type {MjolnirEvent} from 'mjolnir.js';

export const InteractiveContext = createContext({
  eventManager: null,
  isDragging: false
});

const propTypes = Object.assign({}, StaticMap.propTypes, {
  // Additional props on top of StaticMap

  /** Viewport constraints */
  // Max zoom level
  maxZoom: PropTypes.number,
  // Min zoom level
  minZoom: PropTypes.number,
  // Max pitch in degrees
  maxPitch: PropTypes.number,
  // Min pitch in degrees
  minPitch: PropTypes.number,

  // Callbacks fired when the user interacted with the map. The object passed to the callbacks
  // contains viewport properties such as `longitude`, `latitude`, `zoom` etc.
  onViewStateChange: PropTypes.func,
  onViewportChange: PropTypes.func,
  onInteractionStateChange: PropTypes.func,

  /** Viewport transition **/
  // transition duration for viewport change
  transitionDuration: PropTypes.number,
  // TransitionInterpolator instance, can be used to perform custom transitions.
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
  // Multitouch zoom
  touchZoom: PropTypes.bool,
  // Multitouch rotate
  touchRotate: PropTypes.bool,
  // Keyboard
  keyboard: PropTypes.bool,

  /** Event callbacks */
  onHover: PropTypes.func,
  onClick: PropTypes.func,
  onDblClick: PropTypes.func,
  onContextMenu: PropTypes.func,
  onMouseDown: PropTypes.func,
  onMouseMove: PropTypes.func,
  onMouseUp: PropTypes.func,
  onTouchStart: PropTypes.func,
  onTouchMove: PropTypes.func,
  onTouchEnd: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onMouseOut: PropTypes.func,
  onWheel: PropTypes.func,

  /** Custom touch-action CSS for the event canvas. Defaults to 'none' */
  touchAction: PropTypes.string,

  /** Radius to detect features around a clicked point. Defaults to 0. */
  clickRadius: PropTypes.number,

  /** List of layers that are interactive */
  interactiveLayerIds: PropTypes.array,

  /** Accessor that returns a cursor style to show interactive state */
  getCursor: PropTypes.func,

  // A map control instance to replace the default map controller
  // The object must expose a method: `setOptions(opts)`
  controller: PropTypes.instanceOf(MapController)
});

const getDefaultCursor = ({isDragging, isHovering}) => isDragging ?
  'grabbing' :
  (isHovering ? 'pointer' : 'grab');

const defaultProps = Object.assign({},
  StaticMap.defaultProps, MAPBOX_LIMITS, TransitionManager.defaultProps,
  {
    onViewStateChange: null,
    onViewportChange: null,
    onClick: null,
    onHover: null,
    onContextMenu: event => event.preventDefault(),

    scrollZoom: true,
    dragPan: true,
    dragRotate: true,
    doubleClickZoom: true,
    touchZoom: true,
    touchRotate: false,
    keyboard: true,

    touchAction: 'none',
    clickRadius: 0,
    getCursor: getDefaultCursor
  }
);

type InteractionState = {
  isDragging: boolean,
};

type MapEvent = MjolnirEvent & {
  point: Array<number>,
  lngLat: Array<number>,
  features: ?Array<any>
};

type InteractiveMapProps = StaticMapProps & {
  onViewStateChange: Function,
  onViewportChange: Function,
  onInteractionStateChange: Function,
  onHover: Function,
  onClick: Function,
  onDblClick: Function,
  onContextMenu: Function,
  onMouseDown: Function,
  onMouseMove: Function,
  onMouseUp: Function,
  onTouchStart: Function,
  onTouchMove: Function,
  onTouchEnd: Function,
  onMouseEnter: Function,
  onMouseLeave: Function,
  onMouseOut: Function,
  onWheel: Function,
  touchAction: string,
  clickRadius: number,
  interactiveLayerIds: Array<string>,
  getCursor: Function,
  controller: MapController
};

type State = {
  isLoaded: boolean,
  isDragging: boolean,
  isHovering: boolean
};

type InteractiveContextProps = {
  isDragging: boolean,
  eventManager: any
};

export default class InteractiveMap extends PureComponent<InteractiveMapProps, State> {

  static supported() {
    return StaticMap.supported();
  }

  static propTypes = propTypes;
  static defaultProps = defaultProps;

  constructor(props : InteractiveMapProps) {
    super(props);
    // Check for deprecated props
    deprecateWarn(props);

    // If props.controller is not provided, fallback to default MapController instance
    // Cannot use defaultProps here because it needs to be per map instance
    this._controller = props.controller || new MapController();

    this._eventManager = new EventManager(null, {
      touchAction: props.touchAction
    });

    this._updateInteractiveContext({
      isDragging: false,
      eventManager: this._eventManager
    });
  }

  state : State = {
    // Whether mapbox styles have finished loading
    isLoaded: false,
    // Whether the cursor is down
    isDragging: false,
    // Whether the cursor is over a clickable feature
    isHovering: false
  };

  componentDidMount() {
    const eventManager = this._eventManager;

    eventManager.setElement(this._eventCanvasRef.current);
    // Register additional event handlers for click and hover
    eventManager.on({
      pointerdown: this._onPointerDown,
      pointermove: this._onPointerMove,
      pointerup: this._onPointerUp,
      pointerleave: this._onEvent.bind(this, 'onMouseOut'),
      click: this._onClick,
      dblclick: this._onEvent.bind(this, 'onDblClick'),
      wheel: this._onEvent.bind(this, 'onWheel'),
      contextmenu: this._onEvent.bind(this, 'onContextMenu')
    });

    this._setControllerProps(this.props);
  }

  componentWillUpdate(nextProps : InteractiveMapProps, nextState : State) {
    this._setControllerProps(nextProps);

    if (nextState.isDragging !== this.state.isDragging) {
      this._updateInteractiveContext({isDragging: nextState.isDragging});
    }
  }

  _controller : MapController;
  _eventManager : any;
  _interactiveContext : InteractiveContextProps;
  _width : number = 0;
  _height : number = 0;
  _eventCanvasRef: { current: null | HTMLDivElement } = createRef();
  _staticMapRef: { current: null | StaticMap } = createRef();

  getMap = () => {
    return this._staticMapRef.current ? this._staticMapRef.current.getMap() : null;
  }

  queryRenderedFeatures = (geometry : any, options : any = {}) => {
    const map = this.getMap();
    return map && map.queryRenderedFeatures(geometry, options);
  }

  _setControllerProps(props : InteractiveMapProps) {
    props = Object.assign({}, props, props.viewState, {
      isInteractive: Boolean(props.onViewStateChange || props.onViewportChange),
      onViewportChange: this._onViewportChange,
      onStateChange: this._onInteractionStateChange,
      eventManager: this._eventManager,
      width: this._width,
      height: this._height
    });

    this._controller.setOptions(props);
  }

  _getFeatures({pos, radius} : {pos : Array<number>, radius : number}) {
    let features;
    const queryParams = {};
    const map = this.getMap();

    if (this.props.interactiveLayerIds) {
      queryParams.layers = this.props.interactiveLayerIds;
    }

    if (radius) {
      // Radius enables point features, like marker symbols, to be clicked.
      const size = radius;
      const bbox = [[pos[0] - size, pos[1] + size], [pos[0] + size, pos[1] - size]];
      features = map && map.queryRenderedFeatures(bbox, queryParams);
    } else {
      features = map && map.queryRenderedFeatures(pos, queryParams);
    }
    return features;
  }

  _onInteractionStateChange = (interactionState : InteractionState) => {
    const {isDragging = false} = interactionState;
    if (isDragging !== this.state.isDragging) {
      this.setState({isDragging});
    }

    const {onInteractionStateChange} = this.props;
    if (onInteractionStateChange) {
      onInteractionStateChange(interactionState);
    }
  }

  _updateInteractiveContext(updatedContext : $Shape<InteractiveContextProps>) {
    this._interactiveContext = Object.assign({}, this._interactiveContext, updatedContext);
  }

  _onResize = ({width, height} : {width : number, height : number}) => {
    this._width = width;
    this._height = height;
    this._setControllerProps(this.props);
    this.props.onResize({width, height});
  }

  _onViewportChange = (
    viewState : ViewState,
    interactionState : InteractionState,
    oldViewState : ViewState
  ) => {
    const {onViewStateChange, onViewportChange} = this.props;

    if (onViewStateChange) {
      onViewStateChange({viewState, interactionState, oldViewState});
    }
    if (onViewportChange) {
      onViewportChange(viewState, interactionState, oldViewState);
    }
  }

  /* Generic event handling */
  _normalizeEvent(event : MapEvent) {
    if (event.lngLat) {
      // Already unprojected
      return event;
    }

    const {offsetCenter: {x, y}} = event;
    const pos = [x, y];

    // $FlowFixMe
    const viewport = new WebMercatorViewport(Object.assign({}, this.props, {
      width: this._width,
      height: this._height
    }));

    event.point = pos;
    event.lngLat = viewport.unproject(pos);

    return event;
  }

  _onLoad = (event : MapEvent) => {
    this.setState({isLoaded: true});
    this.props.onLoad(event);
  }

  _onEvent = (callbackName : string, event : MapEvent) => {
    const func = this.props[callbackName];
    if (func) {
      func(this._normalizeEvent(event));
    }
  }

  /* Special case event handling */
  _onPointerDown = (event : MapEvent) => {
    switch (event.pointerType) {
    case 'touch':
      this._onEvent('onTouchStart', event);
      break;

    default:
      this._onEvent('onMouseDown', event);
    }
  }

  _onPointerUp = (event : MapEvent) => {
    switch (event.pointerType) {
    case 'touch':
      this._onEvent('onTouchEnd', event);
      break;

    default:
      this._onEvent('onMouseUp', event);
    }
  }

  _onPointerMove = (event : MapEvent) => {
    switch (event.pointerType) {
    case 'touch':
      this._onEvent('onTouchMove', event);
      break;

    default:
      this._onEvent('onMouseMove', event);
    }

    if (!this.state.isDragging) {
      const {onHover, interactiveLayerIds} = this.props;
      let features;
      event = this._normalizeEvent(event);
      if (this.state.isLoaded && (interactiveLayerIds || onHover)) {
        features = this._getFeatures({pos: event.point, radius: this.props.clickRadius});
      }
      if (onHover) {
        // backward compatibility: v3 `onHover` interface
        event.features = features;
        onHover(event);
      }

      const isHovering = Boolean(interactiveLayerIds && features && features.length > 0);
      const isEntering = isHovering && !this.state.isHovering;
      const isExiting = !isHovering && this.state.isHovering;

      if (isEntering) {
        this._onEvent('onMouseEnter', event);
      }
      if (isExiting) {
        this._onEvent('onMouseLeave', event);
      }
      if (isEntering || isExiting) {
        this.setState({isHovering});
      }
    }
  }

  _onClick = (event : MapEvent) => {
    if (this.props.onClick) {
      event = this._normalizeEvent(event);
      // backward compatibility: v3 `onClick` interface
      event.features = this._getFeatures({pos: event.point, radius: this.props.clickRadius});
      this.props.onClick(event);
    }
  }

  render() {
    const {width, height, style, getCursor} = this.props;

    const eventCanvasStyle = Object.assign({position: 'relative'}, style, {
      width,
      height,
      cursor: getCursor(this.state)
    });

    return createElement(InteractiveContext.Provider, {value: this._interactiveContext},
      createElement('div', {
        key: 'event-canvas',
        ref: this._eventCanvasRef,
        style: eventCanvasStyle
      },
        createElement(StaticMap, Object.assign({}, this.props,
          {
            width: '100%',
            height: '100%',
            style: null,
            onResize: this._onResize,
            onLoad: this._onLoad,
            ref: this._staticMapRef,
            children: this.props.children
          }
        ))
      )
    );
  }
}
