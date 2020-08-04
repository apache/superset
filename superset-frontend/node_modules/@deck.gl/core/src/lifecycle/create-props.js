import {applyPropOverrides} from '../lib/seer-integration';
import log from '../utils/log';
import {parsePropTypes} from './prop-types';

// Create a property object
export function createProps() {
  const component = this; // eslint-disable-line

  // Get default prop object (a prototype chain for now)
  const propTypeDefs = getPropsPrototypeAndTypes(component.constructor);
  const propsPrototype = propTypeDefs.defaultProps;

  // Create a new prop object with default props object in prototype chain
  const propsInstance = Object.create(propsPrototype, {
    // Props need a back pointer to the owning component
    _component: {
      enumerable: false,
      value: component
    },
    // The supplied (original) values for those async props that are set to url strings or Promises.
    // In this case, the actual (i.e. resolved) values are looked up from component.internalState
    _asyncPropOriginalValues: {
      enumerable: false,
      value: {}
    },
    // Note: the actual (resolved) values for props that are NOT set to urls or Promises.
    // in this case the values are served directly from this map
    _asyncPropResolvedValues: {
      enumerable: false,
      value: {}
    }
  });

  // "Copy" all sync props
  for (let i = 0; i < arguments.length; ++i) {
    Object.assign(propsInstance, arguments[i]);
  }

  const {layerName} = component.constructor;
  const {deprecatedProps} = propTypeDefs;
  checkDeprecatedProps(layerName, propsInstance, deprecatedProps);
  checkDeprecatedProps(layerName, propsInstance.updateTriggers, deprecatedProps);
  checkDeprecatedProps(layerName, propsInstance.transitions, deprecatedProps);

  // SEER: Apply any overrides from the seer debug extension if it is active
  applyPropOverrides(propsInstance);

  // Props must be immutable
  Object.freeze(propsInstance);

  return propsInstance;
}

/* eslint-disable max-depth */
function checkDeprecatedProps(layerName, propsInstance, deprecatedProps) {
  if (!propsInstance) {
    return;
  }

  for (const name in deprecatedProps) {
    if (hasOwnProperty(propsInstance, name)) {
      const nameStr = `${layerName || 'Layer'}: ${name}`;

      for (const newPropName of deprecatedProps[name]) {
        if (!hasOwnProperty(propsInstance, newPropName)) {
          propsInstance[newPropName] = propsInstance[name];
        }
      }

      log.deprecated(nameStr, deprecatedProps[name].join('/'))();
    }
  }
}
/* eslint-enable max-depth */

// Return precalculated defaultProps and propType objects if available
// build them if needed
function getPropsPrototypeAndTypes(componentClass) {
  const props = getOwnProperty(componentClass, '_mergedDefaultProps');
  if (props) {
    return {
      defaultProps: props,
      propTypes: getOwnProperty(componentClass, '_propTypes'),
      deprecatedProps: getOwnProperty(componentClass, '_deprecatedProps')
    };
  }

  return createPropsPrototypeAndTypes(componentClass);
}

// Build defaultProps and propType objects by walking component prototype chain
function createPropsPrototypeAndTypes(componentClass) {
  const parent = componentClass.prototype;
  if (!parent) {
    return {
      defaultProps: {}
    };
  }

  const parentClass = Object.getPrototypeOf(componentClass);
  const parentPropDefs = (parent && getPropsPrototypeAndTypes(parentClass)) || null;

  // Parse propTypes from Component.defaultProps
  const componentDefaultProps = getOwnProperty(componentClass, 'defaultProps') || {};
  const componentPropDefs = parsePropTypes(componentDefaultProps);

  // Create a merged type object
  const propTypes = Object.assign(
    {},
    parentPropDefs && parentPropDefs.propTypes,
    componentPropDefs.propTypes
  );

  // Create any necessary property descriptors and create the default prop object
  // Assign merged default props
  const defaultProps = createPropsPrototype(
    componentPropDefs.defaultProps,
    parentPropDefs && parentPropDefs.defaultProps,
    propTypes,
    componentClass
  );

  // Create a map for prop whose default value is a callback
  const deprecatedProps = Object.assign(
    {},
    parentPropDefs && parentPropDefs.deprecatedProps,
    componentPropDefs.deprecatedProps
  );

  // Store the precalculated props
  componentClass._mergedDefaultProps = defaultProps;
  componentClass._propTypes = propTypes;
  componentClass._deprecatedProps = deprecatedProps;

  return {propTypes, defaultProps, deprecatedProps};
}

// Builds a pre-merged default props object that component props can inherit from
function createPropsPrototype(props, parentProps, propTypes, componentClass) {
  const defaultProps = Object.create(null);

  Object.assign(defaultProps, parentProps, props);

  // Avoid freezing `id` prop
  const id = getComponentName(componentClass);
  delete props.id;

  // Add getters/setters for async prop properties
  Object.defineProperties(defaultProps, {
    // `id` is treated specially because layer might need to override it
    id: {
      configurable: false,
      writable: true,
      value: id
    }
  });

  // Add getters/setters for async prop properties
  addAsyncPropsToPropPrototype(defaultProps, propTypes);

  return defaultProps;
}

// Create descriptors for overridable props
function addAsyncPropsToPropPrototype(defaultProps, propTypes) {
  const defaultValues = {};

  const descriptors = {
    // Default "resolved" values for async props, returned if value not yet resolved/set.
    _asyncPropDefaultValues: {
      enumerable: false,
      value: defaultValues
    },
    // Shadowed object, just to make sure "early indexing" into the instance does not fail
    _asyncPropOriginalValues: {
      enumerable: false,
      value: {}
    }
  };

  // Move async props into shadow values
  for (const propName in propTypes) {
    const propType = propTypes[propName];
    const {name, value} = propType;

    // Note: async is ES7 keyword, can't destructure
    if (propType.async) {
      defaultValues[name] = value;
      descriptors[name] = getDescriptorForAsyncProp(name, value);
    }
  }

  Object.defineProperties(defaultProps, descriptors);
}

// Helper: Configures getter and setter for one async prop
function getDescriptorForAsyncProp(name) {
  return {
    configurable: false,
    enumerable: true,
    // Save the provided value for async props in a special map
    set(newValue) {
      if (typeof newValue === 'string' || newValue instanceof Promise) {
        this._asyncPropOriginalValues[name] = newValue;
      } else {
        this._asyncPropResolvedValues[name] = newValue;
      }
    },
    // Only the component's state knows the true value of async prop
    get() {
      if (this._asyncPropResolvedValues) {
        // Prop value isn't async, so just return it
        if (name in this._asyncPropResolvedValues) {
          const value = this._asyncPropResolvedValues[name];

          // Special handling - components expect null `data` prop expects to be replaced with `[]`
          if (name === 'data') {
            return value || this._asyncPropDefaultValues[name];
          }

          return value;
        }

        if (name in this._asyncPropOriginalValues) {
          // It's an async prop value: look into component state
          const state = this._component && this._component.internalState;
          if (state && state.hasAsyncProp(name)) {
            return state.getAsyncProp(name);
          }
        }
      }

      // the prop is not supplied, or
      // component not yet initialized/matched, return the component's default value for the prop
      return this._asyncPropDefaultValues[name];
    }
  };
}

// HELPER METHODS

function hasOwnProperty(object, prop) {
  return Object.prototype.hasOwnProperty.call(object, prop);
}

// Constructors have their super class constructors as prototypes
function getOwnProperty(object, prop) {
  return hasOwnProperty(object, prop) && object[prop];
}

function getComponentName(componentClass) {
  const componentName =
    getOwnProperty(componentClass, 'layerName') || getOwnProperty(componentClass, 'componentName');
  if (!componentName) {
    log.once(0, `${componentClass.name}.componentName not specified`)();
  }
  return componentName || componentClass.name;
}
