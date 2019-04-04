import {LIFECYCLE} from '../lifecycle/constants';
import {createProps} from '../lifecycle/create-props';
// import {diffProps} from '../lifecycle/props';
// import log from '../utils/log';
// import assert from '../utils/assert';

import ComponentState from './component-state';

const defaultProps = {};

let counter = 0;

export default class Component {
  constructor(/* ...propObjects */) {
    // Merge supplied props with default props and freeze them.
    /* eslint-disable prefer-spread */
    this.props = createProps.apply(this, arguments);
    /* eslint-enable prefer-spread */

    // Define all members before layer is sealed
    this.id = this.props.id; // The layer's id, used for matching with layers from last render cycle
    this.count = counter++; // Keep track of how many layer instances you are generating
    this.lifecycle = LIFECYCLE.NO_STATE; // Helps track and debug the life cycle of the layers
    this.parent = null; // reference to the composite layer parent that rendered this layer
    this.context = null; // Will reference layer manager's context, contains state shared by layers
    this.state = null; // Will be set to the shared layer state object during layer matching
    this.internalState = null;

    // Seal the layer
    Object.seal(this);
  }

  // clone this layer with modified props
  clone(newProps) {
    return new this.constructor(Object.assign({}, this.props, newProps));
  }

  get stats() {
    return this.internalState.stats;
  }

  // PROTECTED METHODS, override in subclass

  _initState() {
    this.internalState = new ComponentState({});
  }
}

Component.defaultProps = defaultProps;
