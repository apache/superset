import Controller from './controller';
import {OrbitState} from './orbit-controller';
import LinearInterpolator from '../transitions/linear-interpolator';
import {TRANSITION_EVENTS} from './transition-manager';

const LINEAR_TRANSITION_PROPS = {
  transitionDuration: 300,
  transitionEasing: t => t,
  transitionInterpolator: new LinearInterpolator(['target', 'zoom']),
  transitionInterruption: TRANSITION_EVENTS.BREAK
};

export default class OrthographicController extends Controller {
  constructor(props) {
    super(OrbitState, props);
    this.invertPan = true;
  }

  _onPanRotate(event) {
    // No rotation in orthographic view
    return false;
  }

  _getTransitionProps() {
    // Enables Transitions on double-tap and key-down events.
    return LINEAR_TRANSITION_PROPS;
  }
}
