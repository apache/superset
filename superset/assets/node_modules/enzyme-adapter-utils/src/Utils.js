import functionName from 'function.prototype.name';
import createMountWrapper from './createMountWrapper';
import createRenderWrapper from './createRenderWrapper';
import wrap from './wrapWithSimpleWrapper';

export { createMountWrapper, createRenderWrapper, wrap };

export function mapNativeEventNames(event, {
  animation = false, // should be true for React 15+
  pointerEvents = false, // should be true for React 16.4+
  auxClick = false, // should be true for React 16.5+
} = {}) {
  const nativeToReactEventMap = {
    compositionend: 'compositionEnd',
    compositionstart: 'compositionStart',
    compositionupdate: 'compositionUpdate',
    keydown: 'keyDown',
    keyup: 'keyUp',
    keypress: 'keyPress',
    contextmenu: 'contextMenu',
    dblclick: 'doubleClick',
    doubleclick: 'doubleClick', // kept for legacy. TODO: remove with next major.
    dragend: 'dragEnd',
    dragenter: 'dragEnter',
    dragexist: 'dragExit',
    dragleave: 'dragLeave',
    dragover: 'dragOver',
    dragstart: 'dragStart',
    mousedown: 'mouseDown',
    mousemove: 'mouseMove',
    mouseout: 'mouseOut',
    mouseover: 'mouseOver',
    mouseup: 'mouseUp',
    touchcancel: 'touchCancel',
    touchend: 'touchEnd',
    touchmove: 'touchMove',
    touchstart: 'touchStart',
    canplay: 'canPlay',
    canplaythrough: 'canPlayThrough',
    durationchange: 'durationChange',
    loadeddata: 'loadedData',
    loadedmetadata: 'loadedMetadata',
    loadstart: 'loadStart',
    ratechange: 'rateChange',
    timeupdate: 'timeUpdate',
    volumechange: 'volumeChange',
    beforeinput: 'beforeInput',
    mouseenter: 'mouseEnter',
    mouseleave: 'mouseLeave',
    transitionend: 'transitionEnd',
    ...(animation && {
      animationstart: 'animationStart',
      animationiteration: 'animationIteration',
      animationend: 'animationEnd',
    }),
    ...(pointerEvents && {
      pointerdown: 'pointerDown',
      pointermove: 'pointerMove',
      pointerup: 'pointerUp',
      pointercancel: 'pointerCancel',
      gotpointercapture: 'gotPointerCapture',
      lostpointercapture: 'lostPointerCapture',
      pointerenter: 'pointerEnter',
      pointerleave: 'pointerLeave',
      pointerover: 'pointerOver',
      pointerout: 'pointerOut',
    }),
    ...(auxClick && {
      auxclick: 'auxClick',
    }),
  };

  return nativeToReactEventMap[event] || event;
}

// 'click' => 'onClick'
// 'mouseEnter' => 'onMouseEnter'
export function propFromEvent(event, eventOptions = {}) {
  const nativeEvent = mapNativeEventNames(event, eventOptions);
  return `on${nativeEvent[0].toUpperCase()}${nativeEvent.slice(1)}`;
}

export function withSetStateAllowed(fn) {
  // NOTE(lmr):
  // this is currently here to circumvent a React bug where `setState()` is
  // not allowed without global being defined.
  let cleanup = false;
  if (typeof global.document === 'undefined') {
    cleanup = true;
    global.document = {};
  }
  const result = fn();
  if (cleanup) {
    // This works around a bug in node/jest in that developers aren't able to
    // delete things from global when running in a node vm.
    global.document = undefined;
    delete global.document;
  }
  return result;
}

export function assertDomAvailable(feature) {
  if (!global || !global.document || !global.document.createElement) {
    throw new Error(`Enzyme's ${feature} expects a DOM environment to be loaded, but found none`);
  }
}

export function displayNameOfNode(node) {
  if (!node) return null;

  const { type } = node;

  if (!type) return null;

  return type.displayName || (typeof type === 'function' ? functionName(type) : type.name || type);
}

export function nodeTypeFromType(type) {
  if (typeof type === 'string') {
    return 'host';
  }
  if (type && type.prototype && type.prototype.isReactComponent) {
    return 'class';
  }
  return 'function';
}

function getIteratorFn(obj) {
  const iteratorFn = obj && (
    (typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol' && obj[Symbol.iterator])
    || obj['@@iterator']
  );

  if (typeof iteratorFn === 'function') {
    return iteratorFn;
  }

  return undefined;
}

function isIterable(obj) {
  return !!getIteratorFn(obj);
}

export function isArrayLike(obj) {
  return Array.isArray(obj) || (typeof obj !== 'string' && isIterable(obj));
}

export function flatten(arrs) {
  // optimize for the most common case
  if (Array.isArray(arrs)) {
    return arrs.reduce(
      (flatArrs, item) => flatArrs.concat(isArrayLike(item) ? flatten(item) : item),
      [],
    );
  }

  // fallback for arbitrary iterable children
  let flatArrs = [];

  const iteratorFn = getIteratorFn(arrs);
  const iterator = iteratorFn.call(arrs);

  let step = iterator.next();

  while (!step.done) {
    const item = step.value;
    let flatItem;

    if (isArrayLike(item)) {
      flatItem = flatten(item);
    } else {
      flatItem = item;
    }

    flatArrs = flatArrs.concat(flatItem);

    step = iterator.next();
  }

  return flatArrs;
}

export function ensureKeyOrUndefined(key) {
  return key || (key === '' ? '' : undefined);
}

export function elementToTree(el, recurse = elementToTree) {
  if (typeof recurse !== 'function' && arguments.length === 3) {
    // special case for backwards compat for `.map(elementToTree)`
    recurse = elementToTree; // eslint-disable-line no-param-reassign
  }
  if (el === null || typeof el !== 'object' || !('type' in el)) {
    return el;
  }
  const {
    type,
    props,
    key,
    ref,
  } = el;
  const { children } = props;
  let rendered = null;
  if (isArrayLike(children)) {
    rendered = flatten(children).map(x => recurse(x));
  } else if (typeof children !== 'undefined') {
    rendered = recurse(children);
  }

  const nodeType = nodeTypeFromType(type);

  if (nodeType === 'host' && props.dangerouslySetInnerHTML) {
    if (props.children != null) {
      const error = new Error('Can only set one of `children` or `props.dangerouslySetInnerHTML`.');
      error.name = 'Invariant Violation';
      throw error;
    }
  }

  return {
    nodeType,
    type,
    props,
    key: ensureKeyOrUndefined(key),
    ref,
    instance: null,
    rendered,
  };
}

export function propsWithKeysAndRef(node) {
  if (node.ref !== null || node.key !== null) {
    return {
      ...node.props,
      key: node.key,
      ref: node.ref,
    };
  }
  return node.props;
}

function getComponentStack(
  hierarchy,
  getNodeType = nodeTypeFromType,
  getDisplayName = displayNameOfNode,
) {
  const tuples = hierarchy.map(x => [
    getNodeType(x.type),
    getDisplayName(x),
  ]).concat([[
    'class',
    'WrapperComponent',
  ]]);

  return tuples.map(([, name], i, arr) => {
    const [, closestComponent] = arr.slice(i + 1).find(([nodeType]) => nodeType !== 'host') || [];
    return `\n    in ${name}${closestComponent ? ` (created by ${closestComponent})` : ''}`;
  }).join('');
}

export function simulateError(
  error,
  catchingInstance,
  rootNode,
  hierarchy,
  getNodeType = nodeTypeFromType,
  getDisplayName = displayNameOfNode,
) {
  const nodeType = getNodeType(rootNode.type);
  if (nodeType !== 'class') {
    throw new TypeError('simulateError() can only be called on class components with an instance');
  }

  const { componentDidCatch } = catchingInstance || {};
  if (!componentDidCatch) {
    throw error;
  }

  const componentStack = getComponentStack(
    hierarchy,
    getNodeType,
    getDisplayName,
  );

  componentDidCatch.call(catchingInstance, error, { componentStack });
}
