import assert from '../utils/assert';

export function validateProps(props) {
  const propTypes = getPropTypes(props);

  for (const propName in propTypes) {
    const propType = propTypes[propName];
    const {validate} = propType;
    if (validate && !validate(props[propName], propType)) {
      throw new Error(`Invalid prop ${propName}: ${props[propName]}`);
    }
  }
}

// Returns an object with "change flags", either false or strings indicating reason for change
export function diffProps(props, oldProps) {
  // First check if any props have changed (ignore props that will be examined separately)
  const propsChangedReason = compareProps({
    newProps: props,
    oldProps,
    propTypes: getPropTypes(props),
    ignoreProps: {data: null, updateTriggers: null}
  });

  // Now check if any data related props have changed
  const dataChangedReason = diffDataProps(props, oldProps);

  // Check update triggers to determine if any attributes need regeneration
  // Note - if data has changed, all attributes will need regeneration, so skip this step
  let updateTriggersChangedReason = false;
  if (!dataChangedReason) {
    updateTriggersChangedReason = diffUpdateTriggers(props, oldProps);
  }

  return {
    dataChanged: dataChangedReason,
    propsChanged: propsChangedReason,
    updateTriggersChanged: updateTriggersChangedReason
  };
}

/**
 * Performs equality by iterating through keys on an object and returning false
 * when any key has values which are not strictly equal between the arguments.
 * @param {Object} opt.oldProps - object with old key/value pairs
 * @param {Object} opt.newProps - object with new key/value pairs
 * @param {Object} opt.ignoreProps={} - object, keys that should not be compared
 * @returns {null|String} - null when values of all keys are strictly equal.
 *   if unequal, returns a string explaining what changed.
 */
/* eslint-disable max-statements, max-depth, complexity */
export function compareProps({
  newProps,
  oldProps,
  ignoreProps = {},
  propTypes = {},
  triggerName = 'props'
} = {}) {
  assert(oldProps !== undefined && newProps !== undefined, 'compareProps args');

  // shallow equality => deep equality
  if (oldProps === newProps) {
    return null;
  }

  // TODO - do we need these checks? Should never happen...
  if (typeof newProps !== 'object' || newProps === null) {
    return `${triggerName} changed shallowly`;
  }

  if (typeof oldProps !== 'object' || oldProps === null) {
    return `${triggerName} changed shallowly`;
  }

  // Test if new props different from old props
  for (const key in oldProps) {
    if (!(key in ignoreProps)) {
      if (!(key in newProps)) {
        return `${triggerName}.${key} dropped`;
      }
      const newProp = newProps[key];
      const oldProp = oldProps[key];
      const propType = propTypes[key];

      // If prop type has an equal function, invoke it
      let equal = propType && propType.equal;
      if (equal && !equal(newProp, oldProp, propType)) {
        return `${triggerName}.${key} changed deeply`;
      }

      if (!equal) {
        // If object has an equals function, invoke it
        equal = newProp && oldProp && newProp.equals;
        if (equal && !equal.call(newProp, oldProp)) {
          return `${triggerName}.${key} changed deeply`;
        }
      }

      if (!equal && oldProp !== newProp) {
        return `${triggerName}.${key} changed shallowly`;
      }
    }
  }

  // Test if any new props have been added
  for (const key in newProps) {
    if (!(key in ignoreProps)) {
      if (!(key in oldProps)) {
        return `${triggerName}.${key} added: undefined -> ${newProps[key]}`;
      }
    }
  }

  return null;
}
/* eslint-enable max-statements, max-depth, complexity */

// HELPERS

// The comparison of the data prop requires special handling
// the dataComparator should be used if supplied
function diffDataProps(props, oldProps) {
  if (oldProps === null) {
    return 'oldProps is null, initial diff';
  }

  // Support optional app defined comparison of data
  const {dataComparator} = props;
  if (dataComparator) {
    if (!dataComparator(props.data, oldProps.data)) {
      return 'Data comparator detected a change';
    }
    // Otherwise, do a shallow equal on props
  } else if (props.data !== oldProps.data) {
    return 'A new data container was supplied';
  }

  return null;
}

// Checks if any update triggers have changed
// also calls callback to invalidate attributes accordingly.
function diffUpdateTriggers(props, oldProps) {
  if (oldProps === null) {
    return 'oldProps is null, initial diff';
  }

  // If the 'all' updateTrigger fires, ignore testing others
  if ('all' in props.updateTriggers) {
    const diffReason = diffUpdateTrigger(props, oldProps, 'all');
    if (diffReason) {
      return {all: true};
    }
  }

  const triggerChanged = {};
  let reason = false;
  // If the 'all' updateTrigger didn't fire, need to check all others
  for (const triggerName in props.updateTriggers) {
    if (triggerName !== 'all') {
      const diffReason = diffUpdateTrigger(props, oldProps, triggerName);
      if (diffReason) {
        triggerChanged[triggerName] = true;
        reason = triggerChanged;
      }
    }
  }

  return reason;
}

function diffUpdateTrigger(props, oldProps, triggerName) {
  let newTriggers = props.updateTriggers[triggerName];
  newTriggers = newTriggers === undefined || newTriggers === null ? {} : newTriggers;
  let oldTriggers = oldProps.updateTriggers[triggerName];
  oldTriggers = oldTriggers === undefined || oldTriggers === null ? {} : oldTriggers;
  const diffReason = compareProps({
    oldProps: oldTriggers,
    newProps: newTriggers,
    triggerName
  });
  return diffReason;
}

function getPropTypes(props) {
  const layer = props._component;
  const LayerType = layer && layer.constructor;
  return LayerType ? LayerType._propTypes : {};
}
