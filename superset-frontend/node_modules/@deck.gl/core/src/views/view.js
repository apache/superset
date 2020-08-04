import Viewport from '../viewports/viewport';
import {parsePosition, getPosition} from '../utils/positions';
import {deepEqual} from '../utils/deep-equal';
import assert from '../utils/assert';

export default class View {
  constructor(props = {}) {
    const {
      id = null,

      // Window width/height in pixels (for pixel projection)
      x = 0,
      y = 0,
      width = '100%',
      height = '100%',

      // Viewport Options
      projectionMatrix = null, // Projection matrix
      fovy = 50, // Perspective projection parameters, used if projectionMatrix not supplied
      near = 0.1, // Distance of near clipping plane
      far = 1000, // Distance of far clipping plane
      modelMatrix = null, // A model matrix to be applied to position, to match the layer props API

      // A View can be a wrapper for a viewport instance
      viewportInstance = null,

      // Internal: Viewport Type
      type = Viewport // TODO - default to WebMercator?
    } = props;

    assert(!viewportInstance || viewportInstance instanceof Viewport);
    this.viewportInstance = viewportInstance;

    // Id
    this.id = id || this.constructor.displayName || 'view';
    this.type = type;

    this.props = Object.assign({}, props, {
      id: this.id,
      projectionMatrix,
      fovy,
      near,
      far,
      modelMatrix
    });

    // Extents
    this._parseDimensions({x, y, width, height});

    // Bind methods for easy access
    this.equals = this.equals.bind(this);

    Object.seal(this);
  }

  equals(view) {
    if (this === view) {
      return true;
    }

    // if `viewportInstance` is set, it is the only prop that is used
    // Delegate to `Viewport.equals`
    if (this.viewportInstance) {
      return view.viewportInstance && this.viewportInstance.equals(view.viewportInstance);
    }

    const viewChanged = deepEqual(this.props, view.props);

    return viewChanged;
  }

  // Build a `Viewport` from a view descriptor
  // TODO - add support for autosizing viewports using width and height
  makeViewport({width, height, viewState}) {
    if (this.viewportInstance) {
      return this.viewportInstance;
    }

    viewState = this.filterViewState(viewState);

    // Resolve relative viewport dimensions
    const viewportDimensions = this.getDimensions({width, height});
    const props = Object.assign({viewState}, viewState, this.props, viewportDimensions);
    return this._getViewport(props);
  }

  getViewStateId() {
    switch (typeof this.props.viewState) {
      case 'string':
        // if View.viewState is a string, return it
        return this.props.viewState;

      case 'object':
        // If it is an object, return its id component
        return this.props.viewState && this.props.viewState.id;

      default:
        return this.id;
    }
  }

  // Allows view to override (or completely define) viewState
  filterViewState(viewState) {
    if (this.props.viewState && typeof this.props.viewState === 'object') {
      // If we have specified an id, then intent is to override,
      // If not, completely specify the view state
      if (!this.props.viewState.id) {
        return this.props.viewState;
      }

      // Merge in all props from View's viewState, except id
      const newViewState = Object.assign({}, viewState);
      for (const key in this.props.viewState) {
        if (key !== 'id') {
          newViewState[key] = this.props.viewState[key];
        }
      }
      return newViewState;
    }

    return viewState;
  }

  // Resolve relative viewport dimensions into actual dimensions (y='50%', width=800 => y=400)
  getDimensions({width, height}) {
    return {
      x: getPosition(this._x, width),
      y: getPosition(this._y, height),
      width: getPosition(this._width, width),
      height: getPosition(this._height, height)
    };
  }

  // Used by sub classes to resolve controller props
  _getControllerProps(defaultOpts) {
    let opts = this.props.controller;

    if (!opts) {
      return null;
    }
    if (opts === true) {
      return defaultOpts;
    }
    if (typeof opts === 'function') {
      opts = {type: opts};
    }
    return Object.assign({}, defaultOpts, opts);
  }

  // Overridable method
  _getViewport(props) {
    // Get the type of the viewport
    const {type: ViewportType} = this;
    return new ViewportType(props);
  }

  // Parse relative viewport dimension descriptors (e.g {y: '50%', height: '50%'})
  _parseDimensions({x, y, width, height}) {
    this._x = parsePosition(x);
    this._y = parsePosition(y);
    this._width = parsePosition(width);
    this._height = parsePosition(height);
  }
}
