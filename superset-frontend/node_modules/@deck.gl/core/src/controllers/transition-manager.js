import LinearInterpolator from '../transitions/linear-interpolator';
import Transition from '../transitions/transition';
import assert from '../utils/assert';

const noop = () => {};

export const TRANSITION_EVENTS = {
  BREAK: 1,
  SNAP_TO_END: 2,
  IGNORE: 3
};

const DEFAULT_PROPS = {
  transitionDuration: 0,
  transitionEasing: t => t,
  transitionInterpolator: new LinearInterpolator(),
  transitionInterruption: TRANSITION_EVENTS.BREAK,
  onTransitionStart: noop,
  onTransitionInterrupt: noop,
  onTransitionEnd: noop
};

export default class TransitionManager {
  constructor(ControllerState, props = {}) {
    assert(ControllerState);
    this.ControllerState = ControllerState;
    this.props = Object.assign({}, DEFAULT_PROPS, props);
    this.propsInTransition = null;
    this.time = 0;
    this.transition = new Transition();

    this.onViewStateChange = props.onViewStateChange;

    this._onTransitionUpdate = this._onTransitionUpdate.bind(this);
  }

  finalize() {}

  // Returns current transitioned viewport.
  getViewportInTransition() {
    return this.propsInTransition;
  }

  // Process the vewiport change, either ignore or trigger a new transition.
  // Return true if a new transition is triggered, false otherwise.
  processViewStateChange(nextProps) {
    let transitionTriggered = false;
    const currentProps = this.props;
    // Set this.props here as '_triggerTransition' calls '_updateViewport' that uses this.props.
    nextProps = Object.assign({}, DEFAULT_PROPS, nextProps);
    this.props = nextProps;

    // NOTE: Be cautious re-ordering statements in this function.
    if (this._shouldIgnoreViewportChange(currentProps, nextProps)) {
      return transitionTriggered;
    }

    if (this._isTransitionEnabled(nextProps)) {
      const startProps = Object.assign(
        {},
        currentProps,
        this.transition.interruption === TRANSITION_EVENTS.SNAP_TO_END
          ? this.transition.endProps
          : this.propsInTransition || currentProps
      );

      this._triggerTransition(startProps, nextProps);

      transitionTriggered = true;
    } else {
      this.transition.cancel();
    }

    return transitionTriggered;
  }

  updateTransition(timestamp) {
    this.time = timestamp;
    this._updateTransition();
  }

  // Helper methods

  _isTransitionEnabled(props) {
    return props.transitionDuration > 0 && props.transitionInterpolator;
  }

  _isUpdateDueToCurrentTransition(props) {
    if (this.transition.inProgress) {
      return this.transition.interpolator.arePropsEqual(props, this.propsInTransition);
    }
    return false;
  }

  _shouldIgnoreViewportChange(currentProps, nextProps) {
    if (this.transition.inProgress) {
      // Ignore update if it is requested to be ignored
      return (
        this.transition.interruption === TRANSITION_EVENTS.IGNORE ||
        // Ignore update if it is due to current active transition.
        this._isUpdateDueToCurrentTransition(nextProps)
      );
    } else if (this._isTransitionEnabled(nextProps)) {
      // Ignore if none of the viewport props changed.
      return nextProps.transitionInterpolator.arePropsEqual(currentProps, nextProps);
    }
    return true;
  }

  _triggerTransition(startProps, endProps) {
    assert(this._isTransitionEnabled(endProps), 'Transition is not enabled');

    const startViewstate = new this.ControllerState(startProps);
    const endViewStateProps = new this.ControllerState(endProps).shortestPathFrom(startViewstate);

    const initialProps = endProps.transitionInterpolator.initializeProps(
      startProps,
      endViewStateProps
    );

    this.propsInTransition = {};
    this.transition.start({
      duration: endProps.transitionDuration,
      easing: endProps.transitionEasing,
      interpolator: endProps.transitionInterpolator,
      interruption: endProps.transitionInterruption,

      startProps: initialProps.start,
      endProps: initialProps.end,

      onStart: endProps.onTransitionStart,
      onUpdate: this._onTransitionUpdate,
      onInterrupt: this._onTransitionEnd(endProps.onTransitionInterrupt),
      onEnd: this._onTransitionEnd(endProps.onTransitionEnd)
    });
    this._updateTransition();
  }

  _updateTransition() {
    this.transition.update(this.time);
  }

  _onTransitionEnd(callback) {
    return transition => {
      this.propsInTransition = null;
      callback(transition);
    };
  }

  _onTransitionUpdate(transition) {
    // NOTE: Be cautious re-ordering statements in this function.
    const {interpolator, startProps, endProps, time} = transition;

    const viewport = interpolator.interpolateProps(startProps, endProps, time);

    // This gurantees all props (e.g. bearing, longitude) are normalized
    // So when viewports are compared they are in same range.
    this.propsInTransition = new this.ControllerState(
      Object.assign({}, this.props, viewport)
    ).getViewportProps();

    if (this.onViewStateChange) {
      this.onViewStateChange({
        viewState: this.propsInTransition,
        interactionState: {inTransition: true}
      });
    }
  }
}

TransitionManager.defaultProps = DEFAULT_PROPS;
