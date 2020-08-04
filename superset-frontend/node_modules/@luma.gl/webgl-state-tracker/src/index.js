// unified parameter APIs
export {
  getParameter,
  getParameters,
  setParameter,
  resetParameters,
  getModifiedParameters
} from './unified-parameter-api/unified-parameter-api';

export {
  // Support function style parameter keys
  setParameters // TODO - setParameter should also support function style keys?
} from './unified-parameter-api/set-parameters';

// state tracking
export {
  default,
  default as trackContextState,
  pushContextState,
  popContextState
} from './state-tracking/track-context-state';

export {withParameters} from './state-tracking/with-parameters';
