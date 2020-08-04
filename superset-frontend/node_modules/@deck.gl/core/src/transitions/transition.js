export const TRANSITION_STATE = {
  NONE: 'none',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  ENDED: 'ended'
};

function noop() {}

export default class Transition {
  /**
   * @params props {object} - properties of the transition.
   *
   * @params props.duration {number} - total time to complete the transition
   * @params props.easing {func} - easing function
   * @params props.onStart {func} - callback when transition starts
   * @params props.onUpdate {func} - callback when transition updates
   * @params props.onInterrupt {func} - callback when transition is interrupted
   * @params props.onEnd {func} - callback when transition ends
   *
   * Any additional properties are also saved on the instance but have no effect.
   */
  constructor(props) {
    this._startTime = null;
    this._state = TRANSITION_STATE.NONE;

    // Defaults
    this.duration = 1;
    this.easing = t => t;
    this.onStart = noop;
    this.onUpdate = noop;
    this.onInterrupt = noop;
    this.onEnd = noop;

    Object.assign(this, props);
  }

  /* Public API */
  get state() {
    return this._state;
  }

  get inProgress() {
    return this._state === TRANSITION_STATE.PENDING || this._state === TRANSITION_STATE.IN_PROGRESS;
  }

  /**
   * (re)start this transition.
   * @params props {object} - optional overriding props. see constructor
   */
  start(props) {
    if (this.inProgress) {
      this.onInterrupt(this);
    }
    Object.assign(this, props);
    this._setState(TRANSITION_STATE.PENDING);
  }

  /**
   * cancel this transition if it is in progress.
   */
  cancel() {
    if (this.inProgress) {
      this.onInterrupt(this);
      this._setState(TRANSITION_STATE.NONE);
    }
  }

  /**
   * update this transition.
   * @params currentTime {number} - timestamp of the update. should be in the same unit as `duration`.
   */
  update(currentTime) {
    if (this.state === TRANSITION_STATE.PENDING) {
      this._startTime = currentTime;
      this._setState(TRANSITION_STATE.IN_PROGRESS);
    }

    if (this.state === TRANSITION_STATE.IN_PROGRESS) {
      let shouldEnd = false;
      let time = (currentTime - this._startTime) / this.duration;
      if (time >= 1) {
        time = 1;
        shouldEnd = true;
      }
      this.time = this.easing(time);
      this.onUpdate(this);

      if (shouldEnd) {
        this._setState(TRANSITION_STATE.ENDED);
      }
      return true;
    }

    return false;
  }

  /* Private API */
  _setState(newState) {
    if (this._state === newState) {
      return;
    }

    this._state = newState;

    switch (newState) {
      case TRANSITION_STATE.PENDING:
        this.onStart(this);
        break;
      case TRANSITION_STATE.ENDED:
        this.onEnd(this);
        break;
      default:
    }
  }
}
