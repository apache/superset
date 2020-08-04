/* eslint no-use-before-define: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
// eslint-disable-next-line import/no-unresolved
import ReactDOMServer from 'react-dom/server';
// eslint-disable-next-line import/no-unresolved
import ShallowRenderer from 'react-test-renderer/shallow';
import { version as testRendererVersion } from 'react-test-renderer/package.json';
// eslint-disable-next-line import/no-unresolved
import TestUtils from 'react-dom/test-utils';
import semver from 'semver';
import checkPropTypes from 'prop-types/checkPropTypes';
import has from 'has';
import {
  AsyncMode,
  ConcurrentMode,
  ContextConsumer,
  ContextProvider,
  Element,
  ForwardRef,
  Fragment,
  isContextConsumer,
  isContextProvider,
  isElement,
  isForwardRef,
  isLazy,
  isMemo,
  isPortal,
  isSuspense,
  isValidElementType,
  Lazy,
  Memo,
  Portal,
  Profiler,
  StrictMode,
  Suspense,
} from 'react-is';
import { EnzymeAdapter } from 'enzyme';
import { typeOfNode, shallowEqual } from 'enzyme/build/Utils';
import {
  displayNameOfNode,
  elementToTree as utilElementToTree,
  nodeTypeFromType as utilNodeTypeFromType,
  mapNativeEventNames,
  propFromEvent,
  assertDomAvailable,
  withSetStateAllowed,
  createRenderWrapper,
  createMountWrapper,
  propsWithKeysAndRef,
  ensureKeyOrUndefined,
  simulateError,
  wrap,
  getMaskedContext,
  getComponentStack,
  RootFinder,
  getNodeFromRootFinder,
  wrapWithWrappingComponent,
  getWrappingComponentMountRenderer,
} from 'enzyme-adapter-utils';
import findCurrentFiberUsingSlowPath from './findCurrentFiberUsingSlowPath';
import detectFiberTags from './detectFiberTags';

const is164 = !!TestUtils.Simulate.touchStart; // 16.4+
const is165 = !!TestUtils.Simulate.auxClick; // 16.5+
const is166 = is165 && !React.unstable_AsyncMode; // 16.6+
const is168 = is166 && typeof TestUtils.act === 'function';

const hasShouldComponentUpdateBug = semver.satisfies(testRendererVersion, '< 16.8');

// Lazily populated if DOM is available.
let FiberTags = null;

function nodeAndSiblingsArray(nodeWithSibling) {
  const array = [];
  let node = nodeWithSibling;
  while (node != null) {
    array.push(node);
    node = node.sibling;
  }
  return array;
}

function flatten(arr) {
  const result = [];
  const stack = [{ i: 0, array: arr }];
  while (stack.length) {
    const n = stack.pop();
    while (n.i < n.array.length) {
      const el = n.array[n.i];
      n.i += 1;
      if (Array.isArray(el)) {
        stack.push(n);
        stack.push({ i: 0, array: el });
        break;
      }
      result.push(el);
    }
  }
  return result;
}

function nodeTypeFromType(type) {
  if (type === Portal) {
    return 'portal';
  }

  return utilNodeTypeFromType(type);
}

function unmemoType(type) {
  return isMemo(type) ? type.type : type;
}

function elementToTree(el) {
  if (!isPortal(el)) {
    return utilElementToTree(el, elementToTree);
  }

  const { children, containerInfo } = el;
  const props = { children, containerInfo };

  return {
    nodeType: 'portal',
    type: Portal,
    props,
    key: ensureKeyOrUndefined(el.key),
    ref: el.ref || null,
    instance: null,
    rendered: elementToTree(el.children),
  };
}

function toTree(vnode) {
  if (vnode == null) {
    return null;
  }
  // TODO(lmr): I'm not really sure I understand whether or not this is what
  // i should be doing, or if this is a hack for something i'm doing wrong
  // somewhere else. Should talk to sebastian about this perhaps
  const node = findCurrentFiberUsingSlowPath(vnode);
  switch (node.tag) {
    case FiberTags.HostRoot:
      return childrenToTree(node.child);
    case FiberTags.HostPortal: {
      const {
        stateNode: { containerInfo },
        memoizedProps: children,
      } = node;
      const props = { containerInfo, children };
      return {
        nodeType: 'portal',
        type: Portal,
        props,
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: null,
        rendered: childrenToTree(node.child),
      };
    }
    case FiberTags.ClassComponent:
      return {
        nodeType: 'class',
        type: node.type,
        props: { ...node.memoizedProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: node.stateNode,
        rendered: childrenToTree(node.child),
      };
    case FiberTags.FunctionalComponent:
      return {
        nodeType: 'function',
        type: node.type,
        props: { ...node.memoizedProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: null,
        rendered: childrenToTree(node.child),
      };
    case FiberTags.MemoClass:
      return {
        nodeType: 'class',
        type: node.elementType.type,
        props: { ...node.memoizedProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: node.stateNode,
        rendered: childrenToTree(node.child.child),
      };
    case FiberTags.MemoSFC: {
      let renderedNodes = flatten(nodeAndSiblingsArray(node.child).map(toTree));
      if (renderedNodes.length === 0) {
        renderedNodes = [node.memoizedProps.children];
      }
      return {
        nodeType: 'function',
        type: node.elementType,
        props: { ...node.memoizedProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: null,
        rendered: renderedNodes,
      };
    }
    case FiberTags.HostComponent: {
      let renderedNodes = flatten(nodeAndSiblingsArray(node.child).map(toTree));
      if (renderedNodes.length === 0) {
        renderedNodes = [node.memoizedProps.children];
      }
      return {
        nodeType: 'host',
        type: node.type,
        props: { ...node.memoizedProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: node.stateNode,
        rendered: renderedNodes,
      };
    }
    case FiberTags.HostText:
      return node.memoizedProps;
    case FiberTags.Fragment:
    case FiberTags.Mode:
    case FiberTags.ContextProvider:
    case FiberTags.ContextConsumer:
      return childrenToTree(node.child);
    case FiberTags.Profiler:
    case FiberTags.ForwardRef: {
      return {
        nodeType: 'function',
        type: node.type,
        props: { ...node.pendingProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: null,
        rendered: childrenToTree(node.child),
      };
    }
    case FiberTags.Suspense: {
      return {
        nodeType: 'function',
        type: Suspense,
        props: { ...node.memoizedProps },
        key: ensureKeyOrUndefined(node.key),
        ref: node.ref,
        instance: null,
        rendered: childrenToTree(node.child),
      };
    }
    case FiberTags.Lazy:
      return childrenToTree(node.child);
    default:
      throw new Error(`Enzyme Internal Error: unknown node with tag ${node.tag}`);
  }
}

function childrenToTree(node) {
  if (!node) {
    return null;
  }
  const children = nodeAndSiblingsArray(node);
  if (children.length === 0) {
    return null;
  }
  if (children.length === 1) {
    return toTree(children[0]);
  }
  return flatten(children.map(toTree));
}

function nodeToHostNode(_node) {
  // NOTE(lmr): node could be a function component
  // which wont have an instance prop, but we can get the
  // host node associated with its return value at that point.
  // Although this breaks down if the return value is an array,
  // as is possible with React 16.
  let node = _node;
  while (node && !Array.isArray(node) && node.instance === null) {
    node = node.rendered;
  }
  // if the SFC returned null effectively, there is no host node.
  if (!node) {
    return null;
  }

  const mapper = (item) => {
    if (item && item.instance) return ReactDOM.findDOMNode(item.instance);
    return null;
  };
  if (Array.isArray(node)) {
    return node.map(mapper);
  }
  if (Array.isArray(node.rendered) && node.nodeType === 'class') {
    return node.rendered.map(mapper);
  }
  return mapper(node);
}

function replaceLazyWithFallback(node, fallback) {
  if (!node) {
    return null;
  }
  if (Array.isArray(node)) {
    return node.map(el => replaceLazyWithFallback(el, fallback));
  }
  if (isLazy(node.type)) {
    return fallback;
  }
  return {
    ...node,
    props: {
      ...node.props,
      children: replaceLazyWithFallback(node.props.children, fallback),
    },
  };
}

const eventOptions = {
  animation: true,
  pointerEvents: is164,
  auxClick: is165,
};

function getEmptyStateValue() {
  // this handles a bug in React 16.0 - 16.2
  // see https://github.com/facebook/react/commit/39be83565c65f9c522150e52375167568a2a1459
  // also see https://github.com/facebook/react/pull/11965

  // eslint-disable-next-line react/prefer-stateless-function
  class EmptyState extends React.Component {
    render() {
      return null;
    }
  }
  const testRenderer = new ShallowRenderer();
  testRenderer.render(React.createElement(EmptyState));
  return testRenderer._instance.state;
}

function wrapAct(fn) {
  if (!is168) {
    return fn();
  }
  let returnVal;
  TestUtils.act(() => { returnVal = fn(); });
  return returnVal;
}

function getProviderDefaultValue(Provider) {
  // React stores references to the Provider's defaultValue differently across versions.
  if ('_defaultValue' in Provider._context) {
    return Provider._context._defaultValue;
  }
  if ('_currentValue' in Provider._context) {
    return Provider._context._currentValue;
  }
  throw new Error('Enzyme Internal Error: can’t figure out how to get Provider’s default value');
}

function makeFakeElement(type) {
  return { $$typeof: Element, type };
}

function isStateful(Component) {
  return Component.prototype && (
    Component.prototype.isReactComponent
    || Array.isArray(Component.__reactAutoBindPairs) // fallback for createClass components
  );
}

class ReactSixteenAdapter extends EnzymeAdapter {
  constructor() {
    super();
    const { lifecycles } = this.options;
    this.options = {
      ...this.options,
      enableComponentDidUpdateOnSetState: true, // TODO: remove, semver-major
      legacyContextMode: 'parent',
      lifecycles: {
        ...lifecycles,
        componentDidUpdate: {
          onSetState: true,
        },
        getDerivedStateFromProps: {
          hasShouldComponentUpdateBug,
        },
        getSnapshotBeforeUpdate: true,
        setState: {
          skipsComponentDidUpdateOnNullish: true,
        },
        getChildContext: {
          calledByRenderer: false,
        },
        getDerivedStateFromError: is166,
      },
    };
  }

  createMountRenderer(options) {
    assertDomAvailable('mount');
    if (has(options, 'suspenseFallback')) {
      throw new TypeError('`suspenseFallback` is not supported by the `mount` renderer');
    }
    if (FiberTags === null) {
      // Requires DOM.
      FiberTags = detectFiberTags();
    }
    const { attachTo, hydrateIn, wrappingComponentProps } = options;
    const domNode = hydrateIn || attachTo || global.document.createElement('div');
    let instance = null;
    const adapter = this;
    return {
      render(el, context, callback) {
        return wrapAct(() => {
          if (instance === null) {
            const { type, props, ref } = el;
            const wrapperProps = {
              Component: type,
              props,
              wrappingComponentProps,
              context,
              ...(ref && { ref }),
            };
            const ReactWrapperComponent = createMountWrapper(el, { ...options, adapter });
            const wrappedEl = React.createElement(ReactWrapperComponent, wrapperProps);
            instance = hydrateIn
              ? ReactDOM.hydrate(wrappedEl, domNode)
              : ReactDOM.render(wrappedEl, domNode);
            if (typeof callback === 'function') {
              callback();
            }
          } else {
            instance.setChildProps(el.props, context, callback);
          }
        });
      },
      unmount() {
        ReactDOM.unmountComponentAtNode(domNode);
        instance = null;
      },
      getNode() {
        if (!instance) {
          return null;
        }
        return getNodeFromRootFinder(
          adapter.isCustomComponent,
          toTree(instance._reactInternalFiber),
          options,
        );
      },
      simulateError(nodeHierarchy, rootNode, error) {
        const isErrorBoundary = ({ instance: elInstance, type }) => {
          if (is166 && type && type.getDerivedStateFromError) {
            return true;
          }
          return elInstance && elInstance.componentDidCatch;
        };

        const {
          instance: catchingInstance,
          type: catchingType,
        } = nodeHierarchy.find(isErrorBoundary) || {};

        simulateError(
          error,
          catchingInstance,
          rootNode,
          nodeHierarchy,
          nodeTypeFromType,
          adapter.displayNameOfNode,
          is166 ? catchingType : undefined,
        );
      },
      simulateEvent(node, event, mock) {
        const mappedEvent = mapNativeEventNames(event, eventOptions);
        const eventFn = TestUtils.Simulate[mappedEvent];
        if (!eventFn) {
          throw new TypeError(`ReactWrapper::simulate() event '${event}' does not exist`);
        }
        wrapAct(() => {
          eventFn(adapter.nodeToHostNode(node), mock);
        });
      },
      batchedUpdates(fn) {
        return fn();
        // return ReactDOM.unstable_batchedUpdates(fn);
      },
      getWrappingComponentRenderer() {
        return {
          ...this,
          ...getWrappingComponentMountRenderer({
            toTree: inst => toTree(inst._reactInternalFiber),
            getMountWrapperInstance: () => instance,
          }),
        };
      },
    };
  }

  createShallowRenderer(options = {}) {
    const adapter = this;
    const renderer = new ShallowRenderer();
    const { suspenseFallback } = options;
    if (typeof suspenseFallback !== 'undefined' && typeof suspenseFallback !== 'boolean') {
      throw TypeError('`options.suspenseFallback` should be boolean or undefined');
    }
    let isDOM = false;
    let cachedNode = null;

    let lastComponent = null;
    let wrappedComponent = null;
    const sentinel = {};

    // wrap memo components with a PureComponent, or a class component with sCU
    const wrapPureComponent = (Component, compare) => {
      if (!is166) {
        throw new RangeError('this function should not be called in React < 16.6. Please report this!');
      }
      if (lastComponent !== Component) {
        if (isStateful(Component)) {
          wrappedComponent = class extends Component {}; // eslint-disable-line react/prefer-stateless-function
          if (compare) {
            wrappedComponent.prototype.shouldComponentUpdate = nextProps => !compare(this.props, nextProps);
          } else {
            wrappedComponent.prototype.isPureReactComponent = true;
          }
        } else {
          let memoized = sentinel;
          let prevProps;
          wrappedComponent = function (props, ...args) {
            const shouldUpdate = memoized === sentinel || (compare
              ? !compare(prevProps, props)
              : !shallowEqual(prevProps, props)
            );
            if (shouldUpdate) {
              memoized = Component({ ...Component.defaultProps, ...props }, ...args);
              prevProps = props;
            }
            return memoized;
          };
        }
        Object.assign(
          wrappedComponent,
          Component,
          { displayName: adapter.displayNameOfNode({ type: Component }) },
        );
        lastComponent = Component;
      }
      return wrappedComponent;
    };

    // Wrap functional components on versions prior to 16.5,
    // to avoid inadvertently pass a `this` instance to it.
    const wrapFunctionalComponent = (Component) => {
      if (is166 && has(Component, 'defaultProps')) {
        if (lastComponent !== Component) {
          wrappedComponent = Object.assign(
            // eslint-disable-next-line new-cap
            (props, ...args) => Component({ ...Component.defaultProps, ...props }, ...args),
            Component,
            { displayName: adapter.displayNameOfNode({ type: Component }) },
          );
          lastComponent = Component;
        }
        return wrappedComponent;
      }
      if (is165) {
        return Component;
      }

      if (lastComponent !== Component) {
        wrappedComponent = Object.assign(
          (...args) => Component(...args), // eslint-disable-line new-cap
          Component,
        );
        lastComponent = Component;
      }
      return wrappedComponent;
    };

    return {
      render(el, unmaskedContext, {
        providerValues = new Map(),
      } = {}) {
        cachedNode = el;
        /* eslint consistent-return: 0 */
        if (typeof el.type === 'string') {
          isDOM = true;
        } else if (isContextProvider(el)) {
          providerValues.set(el.type, el.props.value);
          const MockProvider = Object.assign(
            props => props.children,
            el.type,
          );
          return withSetStateAllowed(() => renderer.render({ ...el, type: MockProvider }));
        } else if (isContextConsumer(el)) {
          const Provider = adapter.getProviderFromConsumer(el.type);
          const value = providerValues.has(Provider)
            ? providerValues.get(Provider)
            : getProviderDefaultValue(Provider);
          const MockConsumer = Object.assign(
            props => props.children(value),
            el.type,
          );
          return withSetStateAllowed(() => renderer.render({ ...el, type: MockConsumer }));
        } else {
          isDOM = false;
          let renderedEl = el;
          if (isLazy(renderedEl)) {
            throw TypeError('`React.lazy` is not supported by shallow rendering.');
          }
          if (isSuspense(renderedEl)) {
            let { children } = renderedEl.props;
            if (suspenseFallback) {
              const { fallback } = renderedEl.props;
              children = replaceLazyWithFallback(children, fallback);
            }
            const FakeSuspenseWrapper = () => children;
            renderedEl = React.createElement(FakeSuspenseWrapper, null, children);
          }
          const { type: Component } = renderedEl;

          const context = getMaskedContext(Component.contextTypes, unmaskedContext);

          if (isMemo(el.type)) {
            const { type: InnerComp, compare } = el.type;

            return withSetStateAllowed(() => renderer.render(
              { ...el, type: wrapPureComponent(InnerComp, compare) },
              context,
            ));
          }

          if (!isStateful(Component) && typeof Component === 'function') {
            return withSetStateAllowed(() => renderer.render(
              { ...renderedEl, type: wrapFunctionalComponent(Component) },
              context,
            ));
          }

          if (isStateful) {
            // fix react bug; see implementation of `getEmptyStateValue`
            const emptyStateValue = getEmptyStateValue();
            if (emptyStateValue) {
              Object.defineProperty(Component.prototype, 'state', {
                configurable: true,
                enumerable: true,
                get() {
                  return null;
                },
                set(value) {
                  if (value !== emptyStateValue) {
                    Object.defineProperty(this, 'state', {
                      configurable: true,
                      enumerable: true,
                      value,
                      writable: true,
                    });
                  }
                  return true;
                },
              });
            }
          }
          return withSetStateAllowed(() => renderer.render(renderedEl, context));
        }
      },
      unmount() {
        renderer.unmount();
      },
      getNode() {
        if (isDOM) {
          return elementToTree(cachedNode);
        }
        const output = renderer.getRenderOutput();
        return {
          nodeType: nodeTypeFromType(cachedNode.type),
          type: cachedNode.type,
          props: cachedNode.props,
          key: ensureKeyOrUndefined(cachedNode.key),
          ref: cachedNode.ref,
          instance: renderer._instance,
          rendered: Array.isArray(output)
            ? flatten(output).map(el => elementToTree(el))
            : elementToTree(output),
        };
      },
      simulateError(nodeHierarchy, rootNode, error) {
        simulateError(
          error,
          renderer._instance,
          cachedNode,
          nodeHierarchy.concat(cachedNode),
          nodeTypeFromType,
          adapter.displayNameOfNode,
          is166 ? cachedNode.type : undefined,
        );
      },
      simulateEvent(node, event, ...args) {
        const handler = node.props[propFromEvent(event, eventOptions)];
        if (handler) {
          withSetStateAllowed(() => {
            // TODO(lmr): create/use synthetic events
            // TODO(lmr): emulate React's event propagation
            // ReactDOM.unstable_batchedUpdates(() => {
            handler(...args);
            // });
          });
        }
      },
      batchedUpdates(fn) {
        return fn();
        // return ReactDOM.unstable_batchedUpdates(fn);
      },
      checkPropTypes(typeSpecs, values, location, hierarchy) {
        return checkPropTypes(
          typeSpecs,
          values,
          location,
          displayNameOfNode(cachedNode),
          () => getComponentStack(hierarchy.concat([cachedNode])),
        );
      },
    };
  }

  createStringRenderer(options) {
    if (has(options, 'suspenseFallback')) {
      throw new TypeError('`suspenseFallback` should not be specified in options of string renderer');
    }
    return {
      render(el, context) {
        if (options.context && (el.type.contextTypes || options.childContextTypes)) {
          const childContextTypes = {
            ...(el.type.contextTypes || {}),
            ...options.childContextTypes,
          };
          const ContextWrapper = createRenderWrapper(el, context, childContextTypes);
          return ReactDOMServer.renderToStaticMarkup(React.createElement(ContextWrapper));
        }
        return ReactDOMServer.renderToStaticMarkup(el);
      },
    };
  }

  // Provided a bag of options, return an `EnzymeRenderer`. Some options can be implementation
  // specific, like `attach` etc. for React, but not part of this interface explicitly.
  // eslint-disable-next-line class-methods-use-this
  createRenderer(options) {
    switch (options.mode) {
      case EnzymeAdapter.MODES.MOUNT: return this.createMountRenderer(options);
      case EnzymeAdapter.MODES.SHALLOW: return this.createShallowRenderer(options);
      case EnzymeAdapter.MODES.STRING: return this.createStringRenderer(options);
      default:
        throw new Error(`Enzyme Internal Error: Unrecognized mode: ${options.mode}`);
    }
  }

  wrap(element) {
    return wrap(element);
  }

  // converts an RSTNode to the corresponding JSX Pragma Element. This will be needed
  // in order to implement the `Wrapper.mount()` and `Wrapper.shallow()` methods, but should
  // be pretty straightforward for people to implement.
  // eslint-disable-next-line class-methods-use-this
  nodeToElement(node) {
    if (!node || typeof node !== 'object') return null;
    const { type } = node;
    return React.createElement(unmemoType(type), propsWithKeysAndRef(node));
  }

  // eslint-disable-next-line class-methods-use-this
  matchesElementType(node, matchingType) {
    if (!node) {
      return node;
    }
    const { type } = node;
    return unmemoType(type) === unmemoType(matchingType);
  }

  elementToNode(element) {
    return elementToTree(element);
  }

  nodeToHostNode(node, supportsArray = false) {
    const nodes = nodeToHostNode(node);
    if (Array.isArray(nodes) && !supportsArray) {
      return nodes[0];
    }
    return nodes;
  }

  displayNameOfNode(node) {
    if (!node) return null;
    const { type, $$typeof } = node;

    const nodeType = type || $$typeof;

    // newer node types may be undefined, so only test if the nodeType exists
    if (nodeType) {
      switch (nodeType) {
        case (is166 ? ConcurrentMode : AsyncMode) || NaN: return is166 ? 'ConcurrentMode' : 'AsyncMode';
        case Fragment || NaN: return 'Fragment';
        case StrictMode || NaN: return 'StrictMode';
        case Profiler || NaN: return 'Profiler';
        case Portal || NaN: return 'Portal';
        case Suspense || NaN: return 'Suspense';
        default:
      }
    }

    const $$typeofType = type && type.$$typeof;

    switch ($$typeofType) {
      case ContextConsumer || NaN: return 'ContextConsumer';
      case ContextProvider || NaN: return 'ContextProvider';
      case Memo || NaN: {
        const nodeName = displayNameOfNode(node);
        return typeof nodeName === 'string' ? nodeName : `Memo(${displayNameOfNode(type)})`;
      }
      case ForwardRef || NaN: {
        if (type.displayName) {
          return type.displayName;
        }
        const name = displayNameOfNode({ type: type.render });
        return name ? `ForwardRef(${name})` : 'ForwardRef';
      }
      case Lazy || NaN: {
        return 'lazy';
      }
      default: return displayNameOfNode(node);
    }
  }

  isValidElement(element) {
    return isElement(element);
  }

  isValidElementType(object) {
    return !!object && isValidElementType(object);
  }

  isFragment(fragment) {
    return typeOfNode(fragment) === Fragment;
  }

  isCustomComponent(type) {
    const fakeElement = makeFakeElement(type);
    return !!type && (
      typeof type === 'function'
      || isForwardRef(fakeElement)
      || isContextProvider(fakeElement)
      || isContextConsumer(fakeElement)
      || isSuspense(fakeElement)
    );
  }

  isContextConsumer(type) {
    return !!type && isContextConsumer(makeFakeElement(type));
  }

  isCustomComponentElement(inst) {
    if (!inst || !this.isValidElement(inst)) {
      return false;
    }
    return this.isCustomComponent(inst.type);
  }

  getProviderFromConsumer(Consumer) {
    // React stores references to the Provider on a Consumer differently across versions.
    if (Consumer) {
      let Provider;
      if (Consumer._context) { // check this first, to avoid a deprecation warning
        ({ Provider } = Consumer._context);
      } else if (Consumer.Provider) {
        ({ Provider } = Consumer);
      }
      if (Provider) {
        return Provider;
      }
    }
    throw new Error('Enzyme Internal Error: can’t figure out how to get Provider from Consumer');
  }

  createElement(...args) {
    return React.createElement(...args);
  }

  wrapWithWrappingComponent(node, options) {
    return {
      RootFinder,
      node: wrapWithWrappingComponent(React.createElement, node, options),
    };
  }
}

module.exports = ReactSixteenAdapter;
