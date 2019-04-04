/* eslint no-use-before-define: 0 */
import isEqual from 'lodash.isequal';
import is from 'object-is';
import entries from 'object.entries';
import functionName from 'function.prototype.name';
import has from 'has';
import flat from 'array.prototype.flat';
import trim from 'string.prototype.trim';

import { get } from './configuration';
import { childrenOfNode } from './RSTTraversal';
import realGetAdapter from './getAdapter';

export const ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;

export function getAdapter(options = {}) {
  console.warn('getAdapter from Utils is deprecated; please use ./getAdapter instead');
  return realGetAdapter(options);
}

function validateMountOptions(attachTo, hydrateIn) {
  if (attachTo && hydrateIn && attachTo !== hydrateIn) {
    throw new TypeError('If both the `attachTo` and `hydrateIn` options are provided, they must be === (for backwards compatibility)');
  }
}

export function makeOptions(options) {
  const { attachTo: configAttachTo, hydrateIn: configHydrateIn, ...config } = get();
  validateMountOptions(configAttachTo, configHydrateIn);

  const { attachTo, hydrateIn } = options;
  validateMountOptions(attachTo, hydrateIn);

  // neither present: both undefined
  // only attachTo present: attachTo set, hydrateIn undefined
  // only hydrateIn present: both set to hydrateIn
  // both present (and ===, per above): both set to hydrateIn
  const finalAttachTo = hydrateIn || configHydrateIn || configAttachTo || attachTo || undefined;
  const finalHydrateIn = hydrateIn || configHydrateIn || undefined;
  const mountTargets = {
    ...(finalAttachTo && { attachTo: finalAttachTo }),
    ...(finalHydrateIn && { hydrateIn: finalHydrateIn }),
  };

  return {
    ...config,
    ...options,
    ...mountTargets,
  };
}

export function isCustomComponentElement(inst, adapter) {
  if (adapter.isCustomComponentElement) {
    return !!adapter.isCustomComponentElement(inst);
  }
  return !!inst && adapter.isValidElement(inst) && typeof inst.type === 'function';
}

export function propsOfNode(node) {
  return entries((node && node.props) || {})
    .filter(([, value]) => typeof value !== 'undefined')
    .reduce((acc, [key, value]) => Object.assign(acc, { [key]: value }), {});
}

export function typeOfNode(node) {
  return node ? node.type : null;
}

export function nodeHasType(node, type) {
  if (!type || !node) return false;

  const adapter = realGetAdapter();
  if (adapter.displayNameOfNode) {
    const displayName = adapter.displayNameOfNode(node);
    return displayName === type;
  }

  if (!node.type) return false;
  if (typeof node.type === 'string') return node.type === type;
  return (
    typeof node.type === 'function' ? functionName(node.type) === type : node.type.name === type
  ) || node.type.displayName === type;
}

function internalChildrenCompare(a, b, lenComp, isLoose) {
  const nodeCompare = isLoose ? nodeMatches : nodeEqual;

  if (a === b) return true;
  if (!Array.isArray(a) && !Array.isArray(b)) {
    return nodeCompare(a, b, lenComp);
  }
  const flatA = flat(a, Infinity);
  const flatB = flat(b, Infinity);
  if (flatA.length !== flatB.length) return false;
  if (flatA.length === 0 && flatB.length === 0) return true;
  for (let i = 0; i < flatA.length; i += 1) {
    if (!nodeCompare(flatA[i], flatB[i], lenComp)) return false;
  }
  return true;
}

function childrenMatch(a, b, lenComp) {
  return internalChildrenCompare(a, b, lenComp, true);
}

function childrenEqual(a, b, lenComp) {
  return internalChildrenCompare(a, b, lenComp, false);
}

function removeNullaryReducer(acc, [key, value]) {
  const addition = value == null ? {} : { [key]: value };
  return { ...acc, ...addition };
}

function internalNodeCompare(a, b, lenComp, isLoose) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;

  let left = propsOfNode(a);
  let right = propsOfNode(b);
  if (isLoose) {
    left = entries(left).reduce(removeNullaryReducer, {});
    right = entries(right).reduce(removeNullaryReducer, {});
  }

  const leftKeys = Object.keys(left);
  for (let i = 0; i < leftKeys.length; i += 1) {
    const prop = leftKeys[i];
    // we will check children later
    if (prop === 'children') {
      // continue;
    } else if (!(prop in right)) {
      return false;
    } else if (right[prop] === left[prop]) {
      // continue;
    } else if (typeof right[prop] === typeof left[prop] && typeof left[prop] === 'object') {
      if (!isEqual(left[prop], right[prop])) return false;
    } else {
      return false;
    }
  }

  const leftHasChildren = 'children' in left;
  const rightHasChildren = 'children' in right;
  const childCompare = isLoose ? childrenMatch : childrenEqual;
  if (leftHasChildren || rightHasChildren) {
    if (!childCompare(
      childrenToSimplifiedArray(left.children, isLoose),
      childrenToSimplifiedArray(right.children, isLoose),
      lenComp,
    )) {
      return false;
    }
  }

  if (!isTextualNode(a)) {
    const rightKeys = Object.keys(right);
    return lenComp(leftKeys.length - leftHasChildren, rightKeys.length - rightHasChildren);
  }

  return false;
}

export function nodeMatches(a, b, lenComp = is) {
  return internalNodeCompare(a, b, lenComp, true);
}

export function nodeEqual(a, b, lenComp = is) {
  return internalNodeCompare(a, b, lenComp, false);
}

export function containsChildrenSubArray(match, node, subArray) {
  const children = childrenOfNode(node);
  const checker = (_, i) => arraysEqual(match, children.slice(i, i + subArray.length), subArray);
  return children.some(checker);
}

function arraysEqual(match, left, right) {
  return left.length === right.length && left.every((el, i) => match(el, right[i]));
}

function childrenToArray(children) {
  const result = [];

  const push = (el) => {
    if (el === null || el === false || typeof el === 'undefined') return;
    result.push(el);
  };

  if (Array.isArray(children)) {
    children.forEach(push);
  } else {
    push(children);
  }
  return result;
}

export function childrenToSimplifiedArray(nodeChildren, isLoose = false) {
  const childrenArray = childrenToArray(nodeChildren);
  const simplifiedArray = [];

  for (let i = 0; i < childrenArray.length; i += 1) {
    const child = childrenArray[i];
    const previousChild = simplifiedArray.pop();

    if (typeof previousChild === 'undefined') {
      simplifiedArray.push(child);
    } else if (isTextualNode(child) && isTextualNode(previousChild)) {
      simplifiedArray.push(previousChild + child);
    } else {
      simplifiedArray.push(previousChild);
      simplifiedArray.push(child);
    }
  }

  if (isLoose) {
    return simplifiedArray.map(x => (typeof x === 'string' ? trim(x) : x));
  }

  return simplifiedArray;
}

function isTextualNode(node) {
  return typeof node === 'string' || typeof node === 'number';
}

export function isReactElementAlike(arg, adapter) {
  return adapter.isValidElement(arg) || isTextualNode(arg) || Array.isArray(arg);
}

// TODO(lmr): can we get rid of this outside of the adapter?
export function withSetStateAllowed(fn) {
  // NOTE(lmr):
  // this is currently here to circumvent a React bug where `setState()` is
  // not allowed without global being defined.
  let cleanup = false;
  if (typeof global.document === 'undefined') {
    cleanup = true;
    global.document = {};
  }
  fn();
  if (cleanup) {
    // This works around a bug in node/jest in that developers aren't able to
    // delete things from global when running in a node vm.
    global.document = undefined;
    delete global.document;
  }
}

export function AND(fns) {
  const fnsReversed = fns.slice().reverse();
  return x => fnsReversed.every(fn => fn(x));
}

export function displayNameOfNode(node) {
  if (!node) return null;

  const { type } = node;

  if (!type) return null;

  return type.displayName || (typeof type === 'function' ? functionName(type) : type.name || type);
}

export function sym(s) {
  return typeof Symbol === 'function' ? Symbol.for(`enzyme.${s}`) : s;
}

export function privateSet(obj, prop, value) {
  Object.defineProperty(obj, prop, {
    value,
    enumerable: false,
    writable: true,
  });
}

export function cloneElement(adapter, el, props) {
  return adapter.createElement(
    el.type,
    { ...el.props, ...props },
  );
}

export function spyMethod(instance, methodName) {
  let lastReturnValue;
  const originalMethod = instance[methodName];
  const hasOwn = has(instance, methodName);
  let descriptor;
  if (hasOwn) {
    descriptor = Object.getOwnPropertyDescriptor(instance, methodName);
  }
  Object.defineProperty(instance, methodName, {
    configurable: true,
    enumerable: !descriptor || !!descriptor.enumerable,
    value(...args) {
      const result = originalMethod.apply(this, args);
      lastReturnValue = result;
      return result;
    },
  });
  return {
    restore() {
      if (hasOwn) {
        if (descriptor) {
          Object.defineProperty(instance, methodName, descriptor);
        } else {
          /* eslint-disable no-param-reassign */
          instance[methodName] = originalMethod;
          /* eslint-enable no-param-reassign */
        }
      } else {
        /* eslint-disable no-param-reassign */
        delete instance[methodName];
        /* eslint-enable no-param-reassign */
      }
    },
    getLastReturnValue() {
      return lastReturnValue;
    },
  };
}

// adapted from https://github.com/facebook/react/blob/144328fe81719e916b946e22660479e31561bb0b/packages/shared/shallowEqual.js#L36-L68
export function shallowEqual(objA, objB) {
  if (is(objA, objB)) {
    return true;
  }


  if (!objA || !objB || typeof objA !== 'object' || typeof objB !== 'object') {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  keysA.sort();
  keysB.sort();

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i += 1) {
    if (!has(objB, keysA[i]) || !is(objA[keysA[i]], objB[keysA[i]])) {
      return false;
    }
  }

  return true;
}
