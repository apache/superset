/** @license React v16.6.1
 * react-test-renderer-shallow.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('react')) :
	typeof define === 'function' && define.amd ? define(['react'], factory) :
	(global.ReactShallowRenderer = factory(global.React));
}(this, (function (React) { 'use strict';

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var validateFormat = function () {};

{
  validateFormat = function (format) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  };
}

function invariant(condition, format, a, b, c, d, e, f) {
  validateFormat(format);

  if (!condition) {
    var error = void 0;
    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
}

// Relying on the `invariant()` implementation lets us
// preserve the format and params in the www builds.

var ReactInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

var _assign = ReactInternals.assign;

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
var hasSymbol = typeof Symbol === 'function' && Symbol.for;

var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;
var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;
var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;
var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;
var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;
var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;
var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace;
var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;
var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;
var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;
var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;
var REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;
var REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;

/**
 * Forked from fbjs/warning:
 * https://github.com/facebook/fbjs/blob/e66ba20ad5be433eb54423f2b097d829324d9de6/packages/fbjs/src/__forks__/warning.js
 *
 * Only change is we use console.warn instead of console.error,
 * and do nothing when 'console' is not supported.
 * This really simplifies the code.
 * ---
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

{
  
}

function typeOf(object) {
  if (typeof object === 'object' && object !== null) {
    var $$typeof = object.$$typeof;

    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
        var type = object.type;

        switch (type) {
          case REACT_ASYNC_MODE_TYPE:
          case REACT_CONCURRENT_MODE_TYPE:
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
            return type;
          default:
            var $$typeofType = type && type.$$typeof;

            switch ($$typeofType) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_PROVIDER_TYPE:
                return $$typeofType;
              default:
                return $$typeof;
            }
        }
      case REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }

  return undefined;
}

// AsyncMode is deprecated along with isAsyncMode











// AsyncMode should be deprecated





function isForwardRef(object) {
  return typeOf(object) === REACT_FORWARD_REF_TYPE;
}

var BEFORE_SLASH_RE = /^(.*)[\\\/]/;

var describeComponentFrame = function (name, source, ownerName) {
  var sourceInfo = '';
  if (source) {
    var path = source.fileName;
    var fileName = path.replace(BEFORE_SLASH_RE, '');
    {
      // In DEV, include code for a common special case:
      // prefer "folder/index.js" instead of just "index.js".
      if (/^index\./.test(fileName)) {
        var match = path.match(BEFORE_SLASH_RE);
        if (match) {
          var pathBeforeSlash = match[1];
          if (pathBeforeSlash) {
            var folderName = pathBeforeSlash.replace(BEFORE_SLASH_RE, '');
            fileName = folderName + '/' + fileName;
          }
        }
      }
    }
    sourceInfo = ' (at ' + fileName + ':' + source.lineNumber + ')';
  } else if (ownerName) {
    sourceInfo = ' (created by ' + ownerName + ')';
  }
  return '\n    in ' + (name || 'Unknown') + sourceInfo;
};

/**
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

var warningWithoutStack = function () {};

{
  warningWithoutStack = function (condition, format) {
    for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }

    if (format === undefined) {
      throw new Error('`warningWithoutStack(condition, format, ...args)` requires a warning ' + 'message argument');
    }
    if (args.length > 8) {
      // Check before the condition to catch violations early.
      throw new Error('warningWithoutStack() currently supports at most 8 arguments.');
    }
    if (condition) {
      return;
    }
    if (typeof console !== 'undefined') {
      var argsWithFormat = args.map(function (item) {
        return '' + item;
      });
      argsWithFormat.unshift('Warning: ' + format);

      // We intentionally don't use spread (or .apply) directly because it
      // breaks IE9: https://github.com/facebook/react/issues/13610
      Function.prototype.apply.call(console.error, console, argsWithFormat);
    }
    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      var argIndex = 0;
      var message = 'Warning: ' + format.replace(/%s/g, function () {
        return args[argIndex++];
      });
      throw new Error(message);
    } catch (x) {}
  };
}

var warningWithoutStack$1 = warningWithoutStack;

var Resolved = 1;


function refineResolvedLazyComponent(lazyComponent) {
  return lazyComponent._status === Resolved ? lazyComponent._result : null;
}

function getWrappedName(outerType, innerType, wrapperName) {
  var functionName = innerType.displayName || innerType.name || '';
  return outerType.displayName || (functionName !== '' ? wrapperName + '(' + functionName + ')' : wrapperName);
}

function getComponentName(type) {
  if (type == null) {
    // Host root, text node or just invalid type.
    return null;
  }
  {
    if (typeof type.tag === 'number') {
      warningWithoutStack$1(false, 'Received an unexpected object in getComponentName(). ' + 'This is likely a bug in React. Please file an issue.');
    }
  }
  if (typeof type === 'function') {
    return type.displayName || type.name || null;
  }
  if (typeof type === 'string') {
    return type;
  }
  switch (type) {
    case REACT_CONCURRENT_MODE_TYPE:
      return 'ConcurrentMode';
    case REACT_FRAGMENT_TYPE:
      return 'Fragment';
    case REACT_PORTAL_TYPE:
      return 'Portal';
    case REACT_PROFILER_TYPE:
      return 'Profiler';
    case REACT_STRICT_MODE_TYPE:
      return 'StrictMode';
    case REACT_SUSPENSE_TYPE:
      return 'Suspense';
  }
  if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_CONTEXT_TYPE:
        return 'Context.Consumer';
      case REACT_PROVIDER_TYPE:
        return 'Context.Provider';
      case REACT_FORWARD_REF_TYPE:
        return getWrappedName(type, type.render, 'ForwardRef');
      case REACT_MEMO_TYPE:
        return getComponentName(type.type);
      case REACT_LAZY_TYPE:
        {
          var thenable = type;
          var resolvedThenable = refineResolvedLazyComponent(thenable);
          if (resolvedThenable) {
            return getComponentName(resolvedThenable);
          }
        }
    }
  }
  return null;
}

/*eslint-disable no-self-compare */

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * inlined Object.is polyfill to avoid requiring consumers ship their own
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
function is(x, y) {
  // SameValue algorithm
  if (x === y) {
    // Steps 1-5, 7-10
    // Steps 6.b-6.e: +0 != -0
    // Added the nonzero y check to make Flow happy, but it is redundant
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    // Step 6.a: NaN == NaN
    return x !== x && y !== y;
  }
}

/**
 * Performs equality by iterating through keys on an object and returning false
 * when any key has values which are not strictly equal between the arguments.
 * Returns true when the values of all keys are strictly equal.
 */
function shallowEqual(objA, objB) {
  if (is(objA, objB)) {
    return true;
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  var keysA = Object.keys(objA);
  var keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (var i = 0; i < keysA.length; i++) {
    if (!hasOwnProperty.call(objB, keysA[i]) || !is(objA[keysA[i]], objB[keysA[i]])) {
      return false;
    }
  }

  return true;
}

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



var ReactPropTypesSecret$1 = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

var ReactPropTypesSecret_1 = ReactPropTypesSecret$1;

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



var printWarning$1 = function() {};

{
  var ReactPropTypesSecret = ReactPropTypesSecret_1;
  var loggedTypeFailures = {};

  printWarning$1 = function(text) {
    var message = 'Warning: ' + text;
    if (typeof console !== 'undefined') {
      console.error(message);
    }
    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };
}

/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 * @param {?Function} getStack Returns the component stack.
 * @private
 */
function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
  {
    for (var typeSpecName in typeSpecs) {
      if (typeSpecs.hasOwnProperty(typeSpecName)) {
        var error;
        // Prop type validation may throw. In case they do, we don't want to
        // fail the render phase where it didn't fail before. So we log it.
        // After these have been cleaned up, we'll let them throw.
        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          if (typeof typeSpecs[typeSpecName] !== 'function') {
            var err = Error(
              (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +
              'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.'
            );
            err.name = 'Invariant Violation';
            throw err;
          }
          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
        } catch (ex) {
          error = ex;
        }
        if (error && !(error instanceof Error)) {
          printWarning$1(
            (componentName || 'React class') + ': type specification of ' +
            location + ' `' + typeSpecName + '` is invalid; the type checker ' +
            'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +
            'You may have forgotten to pass an argument to the type checker ' +
            'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +
            'shape all require an argument).'
          );

        }
        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
          // Only monitor this failure once because there tends to be a lot of the
          // same error.
          loggedTypeFailures[error.message] = true;

          var stack = getStack ? getStack() : '';

          printWarning$1(
            'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')
          );
        }
      }
    }
  }
}

var checkPropTypes_1 = checkPropTypes;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var emptyObject = {};
{
  Object.freeze(emptyObject);
}

var Updater = function () {
  function Updater(renderer) {
    _classCallCheck(this, Updater);

    this._renderer = renderer;
    this._callbacks = [];
  }

  Updater.prototype._enqueueCallback = function _enqueueCallback(callback, publicInstance) {
    if (typeof callback === 'function' && publicInstance) {
      this._callbacks.push({
        callback: callback,
        publicInstance: publicInstance
      });
    }
  };

  Updater.prototype._invokeCallbacks = function _invokeCallbacks() {
    var callbacks = this._callbacks;
    this._callbacks = [];

    callbacks.forEach(function (_ref) {
      var callback = _ref.callback,
          publicInstance = _ref.publicInstance;

      callback.call(publicInstance);
    });
  };

  Updater.prototype.isMounted = function isMounted(publicInstance) {
    return !!this._renderer._element;
  };

  Updater.prototype.enqueueForceUpdate = function enqueueForceUpdate(publicInstance, callback, callerName) {
    this._enqueueCallback(callback, publicInstance);
    this._renderer._forcedUpdate = true;
    this._renderer.render(this._renderer._element, this._renderer._context);
  };

  Updater.prototype.enqueueReplaceState = function enqueueReplaceState(publicInstance, completeState, callback, callerName) {
    this._enqueueCallback(callback, publicInstance);
    this._renderer._newState = completeState;
    this._renderer.render(this._renderer._element, this._renderer._context);
  };

  Updater.prototype.enqueueSetState = function enqueueSetState(publicInstance, partialState, callback, callerName) {
    this._enqueueCallback(callback, publicInstance);
    var currentState = this._renderer._newState || publicInstance.state;

    if (typeof partialState === 'function') {
      partialState = partialState.call(publicInstance, currentState, publicInstance.props);
    }

    // Null and undefined are treated as no-ops.
    if (partialState === null || partialState === undefined) {
      return;
    }

    this._renderer._newState = _assign({}, currentState, partialState);

    this._renderer.render(this._renderer._element, this._renderer._context);
  };

  return Updater;
}();

var ReactShallowRenderer = function () {
  function ReactShallowRenderer() {
    _classCallCheck(this, ReactShallowRenderer);

    this._context = null;
    this._element = null;
    this._instance = null;
    this._newState = null;
    this._rendered = null;
    this._rendering = false;
    this._forcedUpdate = false;
    this._updater = new Updater(this);
  }

  ReactShallowRenderer.prototype.getMountedInstance = function getMountedInstance() {
    return this._instance;
  };

  ReactShallowRenderer.prototype.getRenderOutput = function getRenderOutput() {
    return this._rendered;
  };

  ReactShallowRenderer.prototype.render = function render(element) {
    var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : emptyObject;

    !React.isValidElement(element) ? invariant(false, 'ReactShallowRenderer render(): Invalid component element.%s', typeof element === 'function' ? ' Instead of passing a component class, make sure to instantiate ' + 'it by passing it to React.createElement.' : '') : void 0;
    // Show a special message for host elements since it's a common case.
    !(typeof element.type !== 'string') ? invariant(false, 'ReactShallowRenderer render(): Shallow rendering works only with custom components, not primitives (%s). Instead of calling `.render(el)` and inspecting the rendered output, look at `el.props` directly instead.', element.type) : void 0;
    !(isForwardRef(element) || typeof element.type === 'function') ? invariant(false, 'ReactShallowRenderer render(): Shallow rendering works only with custom components, but the provided element type was `%s`.', Array.isArray(element.type) ? 'array' : element.type === null ? 'null' : typeof element.type) : void 0;

    if (this._rendering) {
      return;
    }

    this._rendering = true;
    this._element = element;
    this._context = getMaskedContext(element.type.contextTypes, context);

    if (this._instance) {
      this._updateClassComponent(element, this._context);
    } else {
      if (isForwardRef(element)) {
        this._rendered = element.type.render(element.props, element.ref);
      } else if (shouldConstruct(element.type)) {
        this._instance = new element.type(element.props, this._context, this._updater);

        this._updateStateFromStaticLifecycle(element.props);

        if (element.type.hasOwnProperty('contextTypes')) {
          currentlyValidatingElement = element;

          checkPropTypes_1(element.type.contextTypes, this._context, 'context', getName(element.type, this._instance), getStackAddendum);

          currentlyValidatingElement = null;
        }

        this._mountClassComponent(element, this._context);
      } else {
        this._rendered = element.type.call(undefined, element.props, this._context);
      }
    }

    this._rendering = false;
    this._updater._invokeCallbacks();

    return this.getRenderOutput();
  };

  ReactShallowRenderer.prototype.unmount = function unmount() {
    if (this._instance) {
      if (typeof this._instance.componentWillUnmount === 'function') {
        this._instance.componentWillUnmount();
      }
    }

    this._context = null;
    this._element = null;
    this._newState = null;
    this._rendered = null;
    this._instance = null;
  };

  ReactShallowRenderer.prototype._mountClassComponent = function _mountClassComponent(element, context) {
    this._instance.context = context;
    this._instance.props = element.props;
    this._instance.state = this._instance.state || null;
    this._instance.updater = this._updater;

    if (typeof this._instance.UNSAFE_componentWillMount === 'function' || typeof this._instance.componentWillMount === 'function') {
      var beforeState = this._newState;

      // In order to support react-lifecycles-compat polyfilled components,
      // Unsafe lifecycles should not be invoked for components using the new APIs.
      if (typeof element.type.getDerivedStateFromProps !== 'function' && typeof this._instance.getSnapshotBeforeUpdate !== 'function') {
        if (typeof this._instance.componentWillMount === 'function') {
          this._instance.componentWillMount();
        }
        if (typeof this._instance.UNSAFE_componentWillMount === 'function') {
          this._instance.UNSAFE_componentWillMount();
        }
      }

      // setState may have been called during cWM
      if (beforeState !== this._newState) {
        this._instance.state = this._newState || emptyObject;
      }
    }

    this._rendered = this._instance.render();
    // Intentionally do not call componentDidMount()
    // because DOM refs are not available.
  };

  ReactShallowRenderer.prototype._updateClassComponent = function _updateClassComponent(element, context) {
    var props = element.props,
        type = element.type;


    var oldState = this._instance.state || emptyObject;
    var oldProps = this._instance.props;

    if (oldProps !== props) {
      // In order to support react-lifecycles-compat polyfilled components,
      // Unsafe lifecycles should not be invoked for components using the new APIs.
      if (typeof element.type.getDerivedStateFromProps !== 'function' && typeof this._instance.getSnapshotBeforeUpdate !== 'function') {
        if (typeof this._instance.componentWillReceiveProps === 'function') {
          this._instance.componentWillReceiveProps(props, context);
        }
        if (typeof this._instance.UNSAFE_componentWillReceiveProps === 'function') {
          this._instance.UNSAFE_componentWillReceiveProps(props, context);
        }
      }
    }
    this._updateStateFromStaticLifecycle(props);

    // Read state after cWRP in case it calls setState
    var state = this._newState || oldState;

    var shouldUpdate = true;
    if (this._forcedUpdate) {
      shouldUpdate = true;
      this._forcedUpdate = false;
    } else if (typeof this._instance.shouldComponentUpdate === 'function') {
      shouldUpdate = !!this._instance.shouldComponentUpdate(props, state, context);
    } else if (type.prototype && type.prototype.isPureReactComponent) {
      shouldUpdate = !shallowEqual(oldProps, props) || !shallowEqual(oldState, state);
    }

    if (shouldUpdate) {
      // In order to support react-lifecycles-compat polyfilled components,
      // Unsafe lifecycles should not be invoked for components using the new APIs.
      if (typeof element.type.getDerivedStateFromProps !== 'function' && typeof this._instance.getSnapshotBeforeUpdate !== 'function') {
        if (typeof this._instance.componentWillUpdate === 'function') {
          this._instance.componentWillUpdate(props, state, context);
        }
        if (typeof this._instance.UNSAFE_componentWillUpdate === 'function') {
          this._instance.UNSAFE_componentWillUpdate(props, state, context);
        }
      }
    }

    this._instance.context = context;
    this._instance.props = props;
    this._instance.state = state;

    if (shouldUpdate) {
      this._rendered = this._instance.render();
    }
    // Intentionally do not call componentDidUpdate()
    // because DOM refs are not available.
  };

  ReactShallowRenderer.prototype._updateStateFromStaticLifecycle = function _updateStateFromStaticLifecycle(props) {
    var type = this._element.type;


    if (typeof type.getDerivedStateFromProps === 'function') {
      var oldState = this._newState || this._instance.state;
      var partialState = type.getDerivedStateFromProps.call(null, props, oldState);

      if (partialState != null) {
        var newState = _assign({}, oldState, partialState);
        this._instance.state = this._newState = newState;
      }
    }
  };

  return ReactShallowRenderer;
}();

ReactShallowRenderer.createRenderer = function () {
  return new ReactShallowRenderer();
};

var currentlyValidatingElement = null;

function getDisplayName(element) {
  if (element == null) {
    return '#empty';
  } else if (typeof element === 'string' || typeof element === 'number') {
    return '#text';
  } else if (typeof element.type === 'string') {
    return element.type;
  } else {
    return element.type.displayName || element.type.name || 'Unknown';
  }
}

function getStackAddendum() {
  var stack = '';
  if (currentlyValidatingElement) {
    var name = getDisplayName(currentlyValidatingElement);
    var owner = currentlyValidatingElement._owner;
    stack += describeComponentFrame(name, currentlyValidatingElement._source, owner && getComponentName(owner.type));
  }
  return stack;
}

function getName(type, instance) {
  var constructor = instance && instance.constructor;
  return type.displayName || constructor && constructor.displayName || type.name || constructor && constructor.name || null;
}

function shouldConstruct(Component) {
  return !!(Component.prototype && Component.prototype.isReactComponent);
}

function getMaskedContext(contextTypes, unmaskedContext) {
  if (!contextTypes) {
    return emptyObject;
  }
  var context = {};
  for (var key in contextTypes) {
    context[key] = unmaskedContext[key];
  }
  return context;
}



var ReactShallowRenderer$2 = Object.freeze({
	default: ReactShallowRenderer
});

var ReactShallowRenderer$3 = ( ReactShallowRenderer$2 && ReactShallowRenderer ) || ReactShallowRenderer$2;

// TODO: decide on the top-level export form.
// This is hacky but makes it work with both Rollup and Jest.
var shallow = ReactShallowRenderer$3.default || ReactShallowRenderer$3;

return shallow;

})));
