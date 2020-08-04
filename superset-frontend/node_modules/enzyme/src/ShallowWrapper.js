import flat from 'array.prototype.flat';
import cheerio from 'cheerio';
import has from 'has';

import {
  nodeEqual,
  nodeMatches,
  containsChildrenSubArray,
  withSetStateAllowed,
  typeOfNode,
  isReactElementAlike,
  displayNameOfNode,
  isCustomComponent,
  isCustomComponentElement,
  ITERATOR_SYMBOL,
  makeOptions,
  sym,
  privateSet,
  cloneElement,
  spyMethod,
  shallowEqual,
  isEmptyValue,
} from './Utils';
import getAdapter from './getAdapter';
import { debugNodes } from './Debug';
import {
  propsOfNode,
  getTextFromNode,
  hasClassName,
  childrenOfNode,
  parentsOfNode,
  treeFilter,
} from './RSTTraversal';
import { buildPredicate, reduceTreesBySelector } from './selectors';

const NODE = sym('__node__');
const NODES = sym('__nodes__');
const RENDERER = sym('__renderer__');
const UNRENDERED = sym('__unrendered__');
const ROOT = sym('__root__');
const OPTIONS = sym('__options__');
const SET_STATE = sym('__setState__');
const ROOT_NODES = sym('__rootNodes__');
const CHILD_CONTEXT = sym('__childContext__');
const WRAPPING_COMPONENT = sym('__wrappingComponent__');
const PRIMARY_WRAPPER = sym('__primaryWrapper__');
const ROOT_FINDER = sym('__rootFinder__');
const PROVIDER_VALUES = sym('__providerValues__');

/**
 * Finds all nodes in the current wrapper nodes' render trees that match the provided predicate
 * function.
 *
 * @param {ShallowWrapper} wrapper
 * @param {Function} predicate
 * @param {Function} filter
 * @returns {ShallowWrapper}
 */
function findWhereUnwrapped(wrapper, predicate, filter = treeFilter) {
  return wrapper.flatMap(n => filter(n.getNodeInternal(), predicate));
}

/**
 * Returns a new wrapper instance with only the nodes of the current wrapper instance that match
 * the provided predicate function.
 *
 * @param {ShallowWrapper} wrapper
 * @param {Function} predicate
 * @returns {ShallowWrapper}
 */
function filterWhereUnwrapped(wrapper, predicate) {
  return wrapper.wrap(wrapper.getNodesInternal().filter(predicate).filter(Boolean));
}

/**
 * Ensure options passed to ShallowWrapper are valid. Throws otherwise.
 * @param {Object} options
 */
function validateOptions(options) {
  const {
    lifecycleExperimental,
    disableLifecycleMethods,
    enableComponentDidUpdateOnSetState,
    supportPrevContextArgumentOfComponentDidUpdate,
    lifecycles,
  } = options;
  if (typeof lifecycleExperimental !== 'undefined' && typeof lifecycleExperimental !== 'boolean') {
    throw new Error('lifecycleExperimental must be either true or false if provided');
  }

  if (typeof disableLifecycleMethods !== 'undefined' && typeof disableLifecycleMethods !== 'boolean') {
    throw new Error('disableLifecycleMethods must be either true or false if provided');
  }

  if (
    lifecycleExperimental != null
    && disableLifecycleMethods != null
    && lifecycleExperimental === disableLifecycleMethods
  ) {
    throw new Error('lifecycleExperimental and disableLifecycleMethods cannot be set to the same value');
  }

  if (
    typeof enableComponentDidUpdateOnSetState !== 'undefined'
    && lifecycles.componentDidUpdate
    && lifecycles.componentDidUpdate.onSetState !== enableComponentDidUpdateOnSetState
  ) {
    throw new TypeError('the legacy enableComponentDidUpdateOnSetState option should be matched by `lifecycles: { componentDidUpdate: { onSetState: true } }`, for compatibility');
  }

  if (
    typeof supportPrevContextArgumentOfComponentDidUpdate !== 'undefined'
    && lifecycles.componentDidUpdate
    && lifecycles.componentDidUpdate.prevContext !== supportPrevContextArgumentOfComponentDidUpdate
  ) {
    throw new TypeError('the legacy supportPrevContextArgumentOfComponentDidUpdate option should be matched by `lifecycles: { componentDidUpdate: { prevContext: true } }`, for compatibility');
  }
}

function getAdapterLifecycles({ options }) {
  const {
    lifecycles = {},
    enableComponentDidUpdateOnSetState,
    supportPrevContextArgumentOfComponentDidUpdate,
  } = options;

  const hasLegacySetStateArg = typeof enableComponentDidUpdateOnSetState !== 'undefined';
  const hasLegacyPrevContextArg = typeof supportPrevContextArgumentOfComponentDidUpdate !== 'undefined';
  const componentDidUpdate = hasLegacySetStateArg || hasLegacyPrevContextArg
    ? {
      ...(hasLegacySetStateArg && {
        onSetState: !!enableComponentDidUpdateOnSetState,
      }),
      ...(hasLegacyPrevContextArg && {
        prevContext: !!supportPrevContextArgumentOfComponentDidUpdate,
      }),
    }
    : null;
  const { getDerivedStateFromProps: originalGDSFP } = lifecycles;
  const getDerivedStateFromProps = originalGDSFP ? {
    hasShouldComponentUpdateBug: !!originalGDSFP.hasShouldComponentUpdateBug,
  } : false;

  return {
    ...lifecycles,
    setState: {
      ...lifecycles.setState,
    },
    getChildContext: {
      calledByRenderer: true,
      ...lifecycles.getChildContext,
    },
    ...(componentDidUpdate && { componentDidUpdate }),
    getDerivedStateFromProps,
  };
}

function getRootNode(node) {
  if (node.nodeType === 'host') {
    return node;
  }
  return node.rendered;
}

function getRootNodeInternal(wrapper) {
  if (wrapper[ROOT].length !== 1) {
    throw new Error('getRootNodeInternal(wrapper) can only be called when wrapper wraps one node');
  }
  if (wrapper[ROOT] !== wrapper) {
    return wrapper[ROOT_NODES][0];
  }
  return wrapper[ROOT][NODE];
}

function nodeParents(wrapper, node) {
  return parentsOfNode(node, getRootNodeInternal(wrapper));
}

function privateSetNodes(wrapper, nodes) {
  if (!Array.isArray(nodes)) {
    privateSet(wrapper, NODE, nodes);
    privateSet(wrapper, NODES, [nodes]);
  } else {
    privateSet(wrapper, NODE, nodes[0]);
    privateSet(wrapper, NODES, nodes);
  }
  privateSet(wrapper, 'length', wrapper[NODES].length);
}

function pureComponentShouldComponentUpdate(prevProps, props, prevState, state) {
  return !shallowEqual(prevProps, props) || !shallowEqual(prevState, state);
}

function isPureComponent(instance) {
  return instance && instance.isPureReactComponent;
}

function getChildContext(node, hierarchy, renderer) {
  const { instance, type: Component } = node;
  const componentName = displayNameOfNode(node);
  // Warn like react if childContextTypes is not defined:
  // https://github.com/facebook/react/blob/1454a8be03794f5e0b23a7e7696cbbbdcf8b0f5d/packages/react-dom/src/server/ReactPartialRenderer.js#L639-L646
  if (typeof Component.childContextTypes !== 'object') {
    // eslint-disable-next-line no-console
    console.warn(
      `${componentName}.getChildContext(): childContextTypes must be defined in order to use getChildContext().`,
    );
    return {};
  }
  // Check childContextTypes like react:
  // https://github.com/facebook/react/blob/1454a8be03794f5e0b23a7e7696cbbbdcf8b0f5d/packages/react-dom/src/server/ReactPartialRenderer.js#L630-L637
  const childContext = instance.getChildContext();
  Object.keys(childContext).forEach((key) => {
    if (!(key in Component.childContextTypes)) {
      throw new Error(
        `${componentName}.getChildContext(): key "${key}" is not defined in childContextTypes.`,
      );
    }
  });
  if (typeof renderer.checkPropTypes === 'function') {
    renderer.checkPropTypes(Component.childContextTypes, childContext, 'child context', hierarchy);
  }
  return childContext;
}

function spyOnGetChildContextInitialRender(nodes, adapter) {
  if (
    !isCustomComponentElement(nodes, adapter)
    || !nodes.type.prototype
    || typeof nodes.type.prototype.getChildContext !== 'function'
  ) {
    return null;
  }

  return spyMethod(nodes.type.prototype, 'getChildContext');
}

function privateSetChildContext(adapter, wrapper, instance, renderedNode, getChildContextSpy) {
  const renderer = wrapper[RENDERER];
  // We only support parent-based context.
  if (adapter.options.legacyContextMode !== 'parent') { return; }
  if (getChildContextSpy) {
    privateSet(wrapper, CHILD_CONTEXT, getChildContextSpy.getLastReturnValue());
    getChildContextSpy.restore();
  } else if (typeof instance.getChildContext === 'function') {
    // If there's no spy but getChildContext is a function, that means our renderer
    // is not going to call it for us, so we need to call it ourselves.
    const nodeHierarchy = [wrapper[NODE]].concat(nodeParents(wrapper, wrapper[NODE]));
    const childContext = getChildContext(renderedNode, nodeHierarchy, renderer);
    privateSet(wrapper, CHILD_CONTEXT, childContext);
  } else {
    privateSet(wrapper, CHILD_CONTEXT, null);
  }
}

function mockSCUIfgDSFPReturnNonNull(node, state) {
  const { getDerivedStateFromProps } = node.type;

  if (typeof getDerivedStateFromProps === 'function') {
    // we try to fix a React shallow renderer bug here.
    // (facebook/react#14607, which has been fixed in react 16.8):
    // when gDSFP return derived state, it will set instance state in shallow renderer before SCU,
    // this will cause `this.state` in sCU be the updated state, which is wrong behavior.
    // so we have to wrap sCU to pass the old state to original sCU.
    const { instance } = node;
    const { restore } = spyMethod(
      instance,
      'shouldComponentUpdate',
      originalSCU => function shouldComponentUpdate(...args) {
        instance.state = state;
        const sCUResult = originalSCU.apply(instance, args);
        const [, nextState] = args;
        instance.state = nextState;
        restore();
        return sCUResult;
      },
    );
  }
}

/**
 * Recursively dive()s every custom component in a wrapper until
 * the target component is found.
 *
 * @param {ShallowWrapper} wrapper A ShallowWrapper to search
 * @param {ComponentType} target A react custom component that, when found, will end recursion
 * @param {Adapter} adapter An Enzyme adapter
 * @returns {ShallowWrapper|undefined} A ShallowWrapper for the target, or
 *  undefined if it can't be found
 */
function deepRender(wrapper, target, adapter) {
  const node = wrapper[NODE];
  const element = node && adapter.nodeToElement(node);
  if (wrapper.type() === target) {
    return wrapper.dive();
  }
  if (element && isCustomComponentElement(element, adapter)) {
    return deepRender(wrapper.dive(), target, adapter);
  }
  const children = wrapper.children();
  for (let i = 0; i < children.length; i += 1) {
    const found = deepRender(children.at(i), target, adapter);
    if (typeof found !== 'undefined') {
      return found;
    }
  }
  return undefined;
}

/**
 * Deep-renders the `wrappingComponent` and returns the context that should
 * be accessible to the primary wrapper.
 *
 * @param {WrappingComponentWrapper} wrapper The `WrappingComponentWrapper` for a
 *  `wrappingComponent`
 * @param {Adapter} adapter An Enzyme adapter
 * @returns {object} An object containing an object of legacy context values and a Map of
 *  `createContext()` Provider values.
 */
function getContextFromWrappingComponent(wrapper, adapter) {
  const rootFinder = deepRender(wrapper, wrapper[ROOT_FINDER], adapter);
  if (!rootFinder) {
    throw new Error('`wrappingComponent` must render its children!');
  }
  return {
    legacyContext: rootFinder[OPTIONS].context,
    providerValues: rootFinder[PROVIDER_VALUES],
  };
}

/**
 * Makes options specifically for `ShallowWrapper`. Most of the logic here is around rendering
 * a `wrappingComponent` (if one was provided) and adding the child context of that component
 * to `options.context`.
 *
 * @param {ReactElement} nodes the nodes passed to `ShallowWrapper`
 * @param {ShallowWrapper} root this `ShallowWrapper`'s parent. If this is passed, options are
 *  not transformed.
 * @param {*} passedOptions the options passed to `ShallowWrapper`.
 * @param {*} wrapper the `ShallowWrapper` itself
 * @returns {Object} the decorated and transformed options
 */
function makeShallowOptions(nodes, root, passedOptions, wrapper) {
  const options = makeOptions(passedOptions);
  const adapter = getAdapter(passedOptions);
  privateSet(options, PROVIDER_VALUES, passedOptions[PROVIDER_VALUES]);
  if (root || !isCustomComponent(options.wrappingComponent, adapter)) {
    return options;
  }
  if (typeof adapter.wrapWithWrappingComponent !== 'function') {
    throw new TypeError('your adapter does not support `wrappingComponent`. Try upgrading it!');
  }
  const { node: wrappedNode, RootFinder } = adapter.wrapWithWrappingComponent(nodes, options);
  // eslint-disable-next-line no-use-before-define
  const wrappingComponent = new WrappingComponentWrapper(wrappedNode, wrapper, RootFinder);
  const {
    legacyContext: wrappingComponentLegacyContext,
    providerValues: wrappingComponentProviderValues,
  } = getContextFromWrappingComponent(wrappingComponent, adapter);
  privateSet(wrapper, WRAPPING_COMPONENT, wrappingComponent);
  return {
    ...options,
    context: {
      ...options.context,
      ...wrappingComponentLegacyContext,
    },
    [PROVIDER_VALUES]: wrappingComponentProviderValues,
  };
}


/**
 * @class ShallowWrapper
 */
class ShallowWrapper {
  constructor(nodes, root, passedOptions = {}) {
    validateOptions(passedOptions);

    const options = makeShallowOptions(nodes, root, passedOptions, this);
    const adapter = getAdapter(options);
    const lifecycles = getAdapterLifecycles(adapter);

    // mounting a ShallowRender component
    if (!root) {
      if (!adapter.isValidElement(nodes)) {
        throw new TypeError('ShallowWrapper can only wrap valid elements');
      }

      const getChildContextSpy = lifecycles.getChildContext.calledByRenderer
        ? spyOnGetChildContextInitialRender(nodes, adapter)
        : null;
      privateSet(this, ROOT, this);
      privateSet(this, UNRENDERED, nodes);
      const renderer = adapter.createRenderer({ mode: 'shallow', ...options });
      privateSet(this, RENDERER, renderer);
      const providerValues = new Map(options[PROVIDER_VALUES] || []);
      this[RENDERER].render(nodes, options.context, { providerValues });
      const renderedNode = this[RENDERER].getNode();
      privateSetNodes(this, getRootNode(renderedNode));
      privateSet(this, OPTIONS, options);
      privateSet(this, PROVIDER_VALUES, providerValues);

      const { instance } = renderedNode;
      if (instance && !options.disableLifecycleMethods) {
        // Ensure to call componentDidUpdate when instance.setState is called
        if (lifecycles.componentDidUpdate.onSetState && !instance[SET_STATE]) {
          privateSet(instance, SET_STATE, instance.setState);
          instance.setState = (updater, callback = undefined) => this.setState(
            ...(callback == null ? [updater] : [updater, callback]),
          );
        }

        if (typeof instance.componentDidMount === 'function') {
          this[RENDERER].batchedUpdates(() => {
            instance.componentDidMount();
          });
        }
        privateSetChildContext(adapter, this, instance, renderedNode, getChildContextSpy);
      }
    // creating a child component through enzyme's ShallowWrapper APIs.
    } else {
      privateSet(this, ROOT, root);
      privateSet(this, UNRENDERED, null);
      privateSet(this, RENDERER, root[RENDERER]);
      privateSetNodes(this, nodes);
      privateSet(this, OPTIONS, root[OPTIONS]);
      privateSet(this, ROOT_NODES, root[NODES]);
      privateSet(this, PROVIDER_VALUES, null);
    }
  }

  /**
   * Returns the root wrapper
   *
   * @return {ShallowWrapper}
   */
  root() {
    return this[ROOT];
  }

  /**
   * Returns the wrapped component.
   *
   * @return {ReactComponent}
   */
  getNodeInternal() {
    if (this.length !== 1) {
      throw new Error('ShallowWrapper::getNode() can only be called when wrapping one node');
    }
    if (this[ROOT] === this) {
      this.update();
    }
    return this[NODE];
  }

  /**
   * Returns the the wrapped components.
   *
   * @return {Array<ReactComponent>}
   */
  getNodesInternal() {
    if (this[ROOT] === this && this.length === 1) {
      this.update();
    }
    return this[NODES];
  }

  /**
   * Returns the wrapped ReactElement.
   *
   * @return {ReactElement}
   */
  getElement() {
    return this.single('getElement', n => getAdapter(this[OPTIONS]).nodeToElement(n));
  }

  /**
   * Returns the wrapped ReactElements.
   *
   * @return {Array<ReactElement>}
   */
  getElements() {
    return this.getNodesInternal().map(n => getAdapter(this[OPTIONS]).nodeToElement(n));
  }

  // eslint-disable-next-line class-methods-use-this
  getNode() {
    throw new Error('ShallowWrapper::getNode() is no longer supported. Use ShallowWrapper::getElement() instead');
  }

  // eslint-disable-next-line class-methods-use-this
  getNodes() {
    throw new Error('ShallowWrapper::getNodes() is no longer supported. Use ShallowWrapper::getElements() instead');
  }

  /**
   * Gets the instance of the component being rendered as the root node passed into `shallow()`.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * Example:
   * ```
   * const wrapper = shallow(<MyComponent />);
   * const inst = wrapper.instance();
   * expect(inst).to.be.instanceOf(MyComponent);
   * ```
   * @returns {ReactComponent}
   */
  instance() {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::instance() can only be called on the root');
    }
    return this[RENDERER].getNode().instance;
  }

  /**
   * If a `wrappingComponent` was passed in `options`, this methods returns a `ShallowWrapper`
   * around the rendered `wrappingComponent`. This `ShallowWrapper` can be used to update the
   * `wrappingComponent`'s props, state, etc.
   *
   * @returns ShallowWrapper
   */
  getWrappingComponent() {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::getWrappingComponent() can only be called on the root');
    }
    if (!this[OPTIONS].wrappingComponent) {
      throw new Error('ShallowWrapper::getWrappingComponent() can only be called on a wrapper that was originally passed a `wrappingComponent` option');
    }
    return this[WRAPPING_COMPONENT];
  }

  /**
   * Forces a re-render. Useful to run before checking the render output if something external
   * may be updating the state of the component somewhere.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * @returns {ShallowWrapper}
   */
  update() {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::update() can only be called on the root');
    }
    if (this.length !== 1) {
      throw new Error('ShallowWrapper::update() can only be called when wrapping one node');
    }
    privateSetNodes(this, getRootNode(this[RENDERER].getNode()));
    return this;
  }

  /**
   * A method that unmounts the component. This can be used to simulate a component going through
   * and unmount/mount lifecycle.
   * @returns {ShallowWrapper}
   */
  unmount() {
    this[RENDERER].unmount();
    if (this[ROOT][WRAPPING_COMPONENT]) {
      this[ROOT][WRAPPING_COMPONENT].unmount();
    }
    return this;
  }

  /**
   * A method is for re-render with new props and context.
   * This calls componentDidUpdate method if disableLifecycleMethods is not enabled.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * @param {Object} props
   * @param {Object} context
   * @returns {ShallowWrapper}
   */
  rerender(props, context) {
    const adapter = getAdapter(this[OPTIONS]);
    this.single('rerender', () => {
      withSetStateAllowed(() => {
        // NOTE(lmr): In react 16, instances will be null for SFCs, but
        // rerendering with props/context is still a valid thing to do. In
        // this case, state will be undefined, but props/context will exist.
        const node = this[RENDERER].getNode();
        const instance = node.instance || {};
        const type = node.type || {};
        const { state } = instance;
        const prevProps = instance.props || this[UNRENDERED].props;
        const prevContext = instance.context || this[OPTIONS].context;
        const nextContext = context || prevContext;
        if (context) {
          this[OPTIONS] = { ...this[OPTIONS], context: nextContext };
        }
        this[RENDERER].batchedUpdates(() => {
          // When shouldComponentUpdate returns false we shouldn't call componentDidUpdate.
          // so we spy shouldComponentUpdate to get the result.
          const lifecycles = getAdapterLifecycles(adapter);
          let shouldRender = true;
          let shouldComponentUpdateSpy;
          let getChildContextSpy;
          if (
            !this[OPTIONS].disableLifecycleMethods
            && instance
          ) {
            if (typeof instance.shouldComponentUpdate === 'function') {
              const { getDerivedStateFromProps: gDSFP } = lifecycles;
              if (gDSFP && gDSFP.hasShouldComponentUpdateBug) {
                mockSCUIfgDSFPReturnNonNull(node, state);
              }
              shouldComponentUpdateSpy = spyMethod(instance, 'shouldComponentUpdate');
            }
            if (
              lifecycles.getChildContext.calledByRenderer
              && typeof instance.getChildContext === 'function'
            ) {
              getChildContextSpy = spyMethod(instance, 'getChildContext');
            }
          }
          if (!shouldComponentUpdateSpy && isPureComponent(instance)) {
            shouldRender = pureComponentShouldComponentUpdate(
              prevProps,
              props,
              state,
              instance.state,
            );
          }
          if (props) this[UNRENDERED] = cloneElement(adapter, this[UNRENDERED], props);
          this[RENDERER].render(this[UNRENDERED], nextContext, {
            providerValues: this[PROVIDER_VALUES],
          });
          if (shouldComponentUpdateSpy) {
            shouldRender = shouldComponentUpdateSpy.getLastReturnValue();
            shouldComponentUpdateSpy.restore();
          }
          if (
            shouldRender
            && !this[OPTIONS].disableLifecycleMethods
            && instance
          ) {
            privateSetChildContext(adapter, this, instance, node, getChildContextSpy);
            if (lifecycles.getSnapshotBeforeUpdate) {
              let snapshot;
              if (typeof instance.getSnapshotBeforeUpdate === 'function') {
                snapshot = instance.getSnapshotBeforeUpdate(prevProps, state);
              }
              if (
                lifecycles.componentDidUpdate
                && typeof instance.componentDidUpdate === 'function'
                && (
                  !state
                  || shallowEqual(state, this.instance().state)
                  || typeof type.getDerivedStateFromProps === 'function'
                )
              ) {
                instance.componentDidUpdate(prevProps, state, snapshot);
              }
            } else if (
              lifecycles.componentDidUpdate
              && typeof instance.componentDidUpdate === 'function'
            ) {
              if (lifecycles.componentDidUpdate.prevContext) {
                instance.componentDidUpdate(prevProps, state, prevContext);
              } else if (!state || shallowEqual(this.instance().state, state)) {
                instance.componentDidUpdate(prevProps, state);
              }
            }
          // If it doesn't need to rerender, update only its props.
          } else if (!shallowEqual(props, instance.props)) {
            instance.props = (Object.freeze || Object)({ ...instance.props, ...props });
          }
          this.update();
        });
      });
    });
    return this;
  }

  /**
   * A method that sets the props of the root component, and re-renders. Useful for when you are
   * wanting to test how the component behaves over time with changing props. Calling this, for
   * instance, will call the `componentWillReceiveProps` lifecycle method.
   *
   * Similar to `setState`, this method accepts a props object and will merge it in with the already
   * existing props.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * @param {Object} props object
   * @param {Function} cb - callback function
   * @returns {ShallowWrapper}
   */
  setProps(props, callback = undefined) {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::setProps() can only be called on the root');
    }
    if (arguments.length > 1 && typeof callback !== 'function') {
      throw new TypeError('ReactWrapper::setProps() expects a function as its second argument');
    }
    this.rerender(props);
    if (callback) {
      callback();
    }
    return this;
  }

  /**
   * A method to invoke `setState` on the root component instance similar to how you might in the
   * definition of the component, and re-renders.  This method is useful for testing your component
   * in hard to achieve states, however should be used sparingly. If possible, you should utilize
   * your component's external API in order to get it into whatever state you want to test, in order
   * to be as accurate of a test as possible. This is not always practical, however.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * @param {Object} state to merge
   * @param {Function} cb - callback function
   * @returns {ShallowWrapper}
   */
  setState(state, callback = undefined) {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::setState() can only be called on the root');
    }
    if (this.instance() === null || this[RENDERER].getNode().nodeType !== 'class') {
      throw new Error('ShallowWrapper::setState() can only be called on class components');
    }
    if (arguments.length > 1 && typeof callback !== 'function') {
      throw new TypeError('ReactWrapper::setState() expects a function as its second argument');
    }

    this.single('setState', () => {
      withSetStateAllowed(() => {
        const adapter = getAdapter(this[OPTIONS]);

        const lifecycles = getAdapterLifecycles(adapter);

        const node = this[RENDERER].getNode();
        const { instance } = node;
        const prevProps = instance.props;
        const prevState = instance.state;
        const prevContext = instance.context;

        const statePayload = typeof state === 'function'
          ? state.call(instance, prevState, prevProps)
          : state;

        // returning null or undefined prevents the update in React 16+
        // https://github.com/facebook/react/pull/12756
        const maybeHasUpdate = !lifecycles.setState.skipsComponentDidUpdateOnNullish
          || statePayload != null;

        // When shouldComponentUpdate returns false we shouldn't call componentDidUpdate.
        // so we spy shouldComponentUpdate to get the result.
        let shouldComponentUpdateSpy;
        let getChildContextSpy;
        let shouldRender = true;
        if (
          !this[OPTIONS].disableLifecycleMethods
          && instance
        ) {
          if (
            lifecycles.componentDidUpdate
            && lifecycles.componentDidUpdate.onSetState
            && typeof instance.shouldComponentUpdate === 'function'
          ) {
            const { getDerivedStateFromProps: gDSFP } = lifecycles;
            if (gDSFP && gDSFP.hasShouldComponentUpdateBug) {
              mockSCUIfgDSFPReturnNonNull(node, state);
            }
            shouldComponentUpdateSpy = spyMethod(instance, 'shouldComponentUpdate');
          }
          if (
            lifecycles.getChildContext.calledByRenderer
            && typeof instance.getChildContext === 'function'
          ) {
            getChildContextSpy = spyMethod(instance, 'getChildContext');
          }
        }
        if (!shouldComponentUpdateSpy && isPureComponent(instance)) {
          shouldRender = pureComponentShouldComponentUpdate(
            prevProps,
            instance.props,
            prevState,
            { ...prevState, ...statePayload },
          );
        }

        // We don't pass the setState callback here
        // to guarantee to call the callback after finishing the render
        if (instance[SET_STATE]) {
          instance[SET_STATE](statePayload);
        } else {
          instance.setState(statePayload);
        }
        if (shouldComponentUpdateSpy) {
          shouldRender = shouldComponentUpdateSpy.getLastReturnValue();
          shouldComponentUpdateSpy.restore();
        }
        if (
          maybeHasUpdate
          && shouldRender
          && !this[OPTIONS].disableLifecycleMethods
        ) {
          privateSetChildContext(adapter, this, instance, node, getChildContextSpy);
          if (
            lifecycles.componentDidUpdate
            && lifecycles.componentDidUpdate.onSetState
          ) {
            if (
              lifecycles.getSnapshotBeforeUpdate
              && typeof instance.getSnapshotBeforeUpdate === 'function'
            ) {
              const snapshot = instance.getSnapshotBeforeUpdate(prevProps, prevState);
              if (typeof instance.componentDidUpdate === 'function') {
                instance.componentDidUpdate(prevProps, prevState, snapshot);
              }
            } else if (typeof instance.componentDidUpdate === 'function') {
              if (lifecycles.componentDidUpdate.prevContext) {
                instance.componentDidUpdate(prevProps, prevState, prevContext);
              } else {
                instance.componentDidUpdate(prevProps, prevState);
              }
            }
          }
        }
        this.update();
        // call the setState callback
        if (callback) {
          if (adapter.invokeSetStateCallback) {
            adapter.invokeSetStateCallback(instance, callback);
          } else {
            callback.call(instance);
          }
        }
      });
    });
    return this;
  }

  /**
   * A method that sets the context of the root component, and re-renders. Useful for when you are
   * wanting to test how the component behaves over time with changing contexts.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * @param {Object} context object
   * @returns {ShallowWrapper}
   */
  setContext(context) {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::setContext() can only be called on the root');
    }
    if (!this[OPTIONS].context) {
      throw new Error('ShallowWrapper::setContext() can only be called on a wrapper that was originally passed a context option');
    }
    return this.rerender(null, context);
  }

  /**
   * Whether or not a given react element exists in the shallow render tree.
   *
   * Example:
   * ```
   * const wrapper = shallow(<MyComponent />);
   * expect(wrapper.contains(<div className="foo bar" />)).to.equal(true);
   * ```
   *
   * @param {ReactElement|Array<ReactElement>} nodeOrNodes
   * @returns {Boolean}
   */
  contains(nodeOrNodes) {
    const adapter = getAdapter(this[OPTIONS]);
    if (!isReactElementAlike(nodeOrNodes, adapter)) {
      throw new Error('ShallowWrapper::contains() can only be called with a ReactElement (or an array of them), a string, or a number as an argument.');
    }
    const predicate = Array.isArray(nodeOrNodes)
      ? other => containsChildrenSubArray(
        nodeEqual,
        other,
        nodeOrNodes.map(node => adapter.elementToNode(node)),
      )
      : other => nodeEqual(adapter.elementToNode(nodeOrNodes), other);

    return findWhereUnwrapped(this, predicate).length > 0;
  }

  /**
   * Whether or not a given react element exists in the shallow render tree.
   * Match is based on the expected element and not on wrappers element.
   * It will determine if one of the wrappers element "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrappers element and equals to each other.
   *
   * Example:
   * ```
   * // MyComponent outputs <div><div class="foo">Hello</div></div>
   * const wrapper = shallow(<MyComponent />);
   * expect(wrapper.containsMatchingElement(<div>Hello</div>)).to.equal(true);
   * ```
   *
   * @param {ReactElement} node
   * @returns {Boolean}
   */
  containsMatchingElement(node) {
    const adapter = getAdapter(this[OPTIONS]);
    const rstNode = adapter.elementToNode(node);
    const predicate = other => nodeMatches(rstNode, other, (a, b) => a <= b);
    return findWhereUnwrapped(this, predicate).length > 0;
  }

  /**
   * Whether or not all the given react elements exists in the shallow render tree.
   * Match is based on the expected element and not on wrappers element.
   * It will determine if one of the wrappers element "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrappers element and equals to each other.
   *
   * Example:
   * ```
   * const wrapper = shallow(<MyComponent />);
   * expect(wrapper.containsAllMatchingElements([
   *   <div>Hello</div>,
   *   <div>Goodbye</div>,
   * ])).to.equal(true);
   * ```
   *
   * @param {Array<ReactElement>} nodes
   * @returns {Boolean}
   */
  containsAllMatchingElements(nodes) {
    if (!Array.isArray(nodes)) {
      throw new TypeError('nodes should be an Array');
    }

    return nodes.every(node => this.containsMatchingElement(node));
  }

  /**
   * Whether or not one of the given react elements exists in the shallow render tree.
   * Match is based on the expected element and not on wrappers element.
   * It will determine if one of the wrappers element "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrappers element and equals to each other.
   *
   * Example:
   * ```
   * const wrapper = shallow(<MyComponent />);
   * expect(wrapper.containsAnyMatchingElements([
   *   <div>Hello</div>,
   *   <div>Goodbye</div>,
   * ])).to.equal(true);
   * ```
   *
   * @param {Array<ReactElement>} nodes
   * @returns {Boolean}
   */
  containsAnyMatchingElements(nodes) {
    return Array.isArray(nodes) && nodes.some(node => this.containsMatchingElement(node));
  }

  /**
   * Whether or not a given react element exists in the render tree.
   *
   * Example:
   * ```
   * const wrapper = shallow(<MyComponent />);
   * expect(wrapper.contains(<div className="foo bar" />)).to.equal(true);
   * ```
   *
   * @param {ReactElement} node
   * @returns {Boolean}
   */
  equals(node) {
    return this.single('equals', () => nodeEqual(this.getNodeInternal(), node));
  }

  /**
   * Whether or not a given react element matches the render tree.
   * Match is based on the expected element and not on wrapper root node.
   * It will determine if the wrapper root node "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrapper root node and equals to each other.
   *
   * Example:
   * ```
   * // MyComponent outputs <div class="foo">Hello</div>
   * const wrapper = shallow(<MyComponent />);
   * expect(wrapper.matchesElement(<div>Hello</div>)).to.equal(true);
   * ```
   *
   * @param {ReactElement} node
   * @returns {Boolean}
   */
  matchesElement(node) {
    return this.single('matchesElement', () => {
      const adapter = getAdapter(this[OPTIONS]);
      const rstNode = adapter.elementToNode(node);
      return nodeMatches(rstNode, this.getNodeInternal(), (a, b) => a <= b);
    });
  }

  /**
   * Finds every node in the render tree of the current wrapper that matches the provided selector.
   *
   * @param {EnzymeSelector} selector
   * @returns {ShallowWrapper}
   */
  find(selector) {
    return this.wrap(reduceTreesBySelector(selector, this.getNodesInternal()));
  }

  /**
   * Returns whether or not current node matches a provided selector.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param {EnzymeSelector} selector
   * @returns {boolean}
   */
  is(selector) {
    const predicate = buildPredicate(selector);
    return this.single('is', n => predicate(n));
  }

  /**
   * Returns true if the component rendered nothing, i.e., null or false.
   *
   * @returns {boolean}
   */
  isEmptyRender() {
    const nodes = this.getNodesInternal();

    return nodes.every(n => isEmptyValue(n));
  }

  /**
   * Returns a new wrapper instance with only the nodes of the current wrapper instance that match
   * the provided predicate function. The predicate should receive a wrapped node as its first
   * argument.
   *
   * @param {Function} predicate
   * @returns {ShallowWrapper}
   */
  filterWhere(predicate) {
    return filterWhereUnwrapped(this, n => predicate(this.wrap(n)));
  }

  /**
   * Returns a new wrapper instance with only the nodes of the current wrapper instance that match
   * the provided selector.
   *
   * @param {EnzymeSelector} selector
   * @returns {ShallowWrapper}
   */
  filter(selector) {
    const predicate = buildPredicate(selector);
    return filterWhereUnwrapped(this, predicate);
  }

  /**
   * Returns a new wrapper instance with only the nodes of the current wrapper that did not match
   * the provided selector. Essentially the inverse of `filter`.
   *
   * @param {EnzymeSelector} selector
   * @returns {ShallowWrapper}
   */
  not(selector) {
    const predicate = buildPredicate(selector);
    return filterWhereUnwrapped(this, n => !predicate(n));
  }

  /**
   * Returns a string of the rendered text of the current render tree.  This function should be
   * looked at with skepticism if being used to test what the actual HTML output of the component
   * will be. If that is what you would like to test, use enzyme's `render` function instead.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @returns {String}
   */
  text() {
    return this.single('text', getTextFromNode);
  }

  /**
   * Returns the HTML of the node.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @returns {String}
   */
  html() {
    return this.single('html', (n) => {
      if (this.type() === null) return null;
      const adapter = getAdapter(this[OPTIONS]);
      const renderer = adapter.createRenderer({ ...this[OPTIONS], mode: 'string' });
      return renderer.render(adapter.nodeToElement(n));
    });
  }

  /**
   * Returns the current node rendered to HTML and wrapped in a CheerioWrapper.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @returns {CheerioWrapper}
   */
  render() {
    return this.type() === null ? cheerio() : cheerio.load('')(this.html());
  }

  /**
   * Used to simulate events. Pass an eventname and (optionally) event arguments. This method of
   * testing events should be met with some skepticism.
   *
   * @param {String} event
   * @param {Array} args
   * @returns {ShallowWrapper}
   */
  simulate(event, ...args) {
    return this.single('simulate', (n) => {
      this[RENDERER].simulateEvent(n, event, ...args);
      this[ROOT].update();
      return this;
    });
  }

  /**
   * Used to simulate throwing a rendering error. Pass an error to throw.
   *
   * @param {String} error
   * @returns {ShallowWrapper}
   */
  simulateError(error) {
    // in shallow, the "root" is the "rendered" thing.

    return this.single('simulateError', (thisNode) => {
      if (thisNode.nodeType === 'host') {
        throw new TypeError('ShallowWrapper::simulateError() can only be called on custom components');
      }

      const renderer = this[RENDERER];
      if (typeof renderer.simulateError !== 'function') {
        throw new TypeError('your adapter does not support `simulateError`. Try upgrading it!');
      }

      const rootNode = getRootNodeInternal(this);
      const nodeHierarchy = [thisNode].concat(nodeParents(this, thisNode));
      renderer.simulateError(nodeHierarchy, rootNode, error);

      return this;
    });
  }

  /**
   * Returns the props hash for the current node of the wrapper.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @returns {Object}
   */
  props() {
    return this.single('props', propsOfNode);
  }

  /**
   * Returns the state hash for the root node of the wrapper. Optionally pass in a prop name and it
   * will return just that value.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param {String} name (optional)
   * @returns {*}
   */
  state(name) {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::state() can only be called on the root');
    }
    if (this.instance() === null || this[RENDERER].getNode().nodeType !== 'class') {
      throw new Error('ShallowWrapper::state() can only be called on class components');
    }
    const _state = this.single('state', () => this.instance().state);
    if (typeof name !== 'undefined') {
      if (_state == null) {
        throw new TypeError(`ShallowWrapper::state("${name}") requires that \`state\` not be \`null\` or \`undefined\``);
      }
      return _state[name];
    }
    return _state;
  }

  /**
   * Returns the context hash for the root node of the wrapper.
   * Optionally pass in a prop name and it will return just that value.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param {String} name (optional)
   * @returns {*}
   */
  context(name) {
    if (this[ROOT] !== this) {
      throw new Error('ShallowWrapper::context() can only be called on the root');
    }
    if (!this[OPTIONS].context) {
      throw new Error('ShallowWrapper::context() can only be called on a wrapper that was originally passed a context option');
    }
    if (this.instance() === null) {
      throw new Error('ShallowWrapper::context() can only be called on wrapped nodes that have a non-null instance');
    }
    const _context = this.single('context', () => this.instance().context);
    if (name) {
      return _context[name];
    }
    return _context;
  }

  /**
   * Returns a new wrapper with all of the children of the current wrapper.
   *
   * @param {EnzymeSelector} [selector]
   * @returns {ShallowWrapper}
   */
  children(selector) {
    const allChildren = this.flatMap(n => childrenOfNode(n.getNodeInternal()));
    return selector ? allChildren.filter(selector) : allChildren;
  }

  /**
   * Returns a new wrapper with a specific child
   *
   * @param {Number} [index]
   * @returns {ShallowWrapper}
   */
  childAt(index) {
    return this.single('childAt', () => this.children().at(index));
  }

  /**
   * Returns a wrapper around all of the parents/ancestors of the wrapper. Does not include the node
   * in the current wrapper.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param {EnzymeSelector} [selector]
   * @returns {ShallowWrapper}
   */
  parents(selector) {
    return this.single('parents', (n) => {
      const allParents = this.wrap(nodeParents(this, n));
      return selector ? allParents.filter(selector) : allParents;
    });
  }

  /**
   * Returns a wrapper around the immediate parent of the current node.
   *
   * @returns {ShallowWrapper}
   */
  parent() {
    return this.flatMap(n => [n.parents().get(0)]);
  }

  /**
   *
   * @param {EnzymeSelector} selector
   * @returns {ShallowWrapper}
   */
  closest(selector) {
    if (this.is(selector)) {
      return this;
    }
    const matchingAncestors = this.parents().filter(selector);
    return matchingAncestors.length > 0 ? matchingAncestors.first() : this.findWhere(() => false);
  }

  /**
   * Shallow renders the current node and returns a shallow wrapper around it.
   *
   * NOTE: can only be called on wrapper of a single node.
   *
   * @param {Object} options
   * @returns {ShallowWrapper}
   */
  shallow(options) {
    return this.single('shallow', n => (
      this.wrap(getAdapter(this[OPTIONS]).nodeToElement(n), null, options)
    ));
  }

  /**
   * Returns the value of prop with the given name of the current node.
   *
   * @param propName
   * @returns {*}
   */
  prop(propName) {
    return this.props()[propName];
  }

  /**
   * Used to invoke a function prop.
   * Will invoke an function prop and return its value.
   *
   * @param {String} propName
   * @returns {Any}
   */
  invoke(propName) {
    return this.single('invoke', () => {
      const handler = this.prop(propName);
      if (typeof handler !== 'function') {
        throw new TypeError('ShallowWrapper::invoke() requires the name of a prop whose value is a function');
      }
      return (...args) => {
        const response = handler(...args);
        this[ROOT].update();
        return response;
      };
    });
  }

  /**
   * Returns a wrapper of the node rendered by the provided render prop.
   *
   * @param {String} propName
   * @returns {Function}
   */
  renderProp(propName) {
    const adapter = getAdapter(this[OPTIONS]);
    if (typeof adapter.wrap !== 'function') {
      throw new RangeError('your adapter does not support `wrap`. Try upgrading it!');
    }

    return this.single('renderProp', (n) => {
      if (n.nodeType === 'host') {
        throw new TypeError('ShallowWrapper::renderProp() can only be called on custom components');
      }
      if (typeof propName !== 'string') {
        throw new TypeError('ShallowWrapper::renderProp(): `propName` must be a string');
      }
      const props = this.props();
      if (!has(props, propName)) {
        throw new Error(`ShallowWrapper::renderProp(): no prop called “${propName}“ found`);
      }
      const propValue = props[propName];
      if (typeof propValue !== 'function') {
        throw new TypeError(`ShallowWrapper::renderProp(): expected prop “${propName}“ to contain a function, but it holds “${typeof propValue}“`);
      }

      return (...args) => {
        const element = propValue(...args);
        const wrapped = adapter.wrap(element);
        return this.wrap(wrapped, null, this[OPTIONS]);
      };
    });
  }

  /**
   * Returns the key assigned to the current node.
   *
   * @returns {String}
   */
  key() {
    return this.single('key', n => (n.key === undefined ? null : n.key));
  }

  /**
   * Returns the type of the current node of this wrapper. If it's a composite component, this will
   * be the component constructor. If it's a native DOM node, it will be a string of the tag name.
   * If it's null, it will be null.
   *
   * @returns {String|Function|null}
   */
  type() {
    return this.single('type', n => typeOfNode(n));
  }

  /**
   * Returns the name of the current node of this wrapper.
   *
   * In order of precedence => type.displayName -> type.name -> type.
   *
   * @returns {String}
   */
  name() {
    const adapter = getAdapter(this[OPTIONS]);
    return this.single('name', n => (
      adapter.displayNameOfNode ? adapter.displayNameOfNode(n) : displayNameOfNode(n)
    ));
  }

  /**
   * Returns whether or not the current node has the given class name or not.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param className
   * @returns {Boolean}
   */
  hasClass(className) {
    if (typeof className === 'string' && className.indexOf('.') !== -1) {
      // eslint-disable-next-line no-console
      console.warn('It looks like you\'re calling `ShallowWrapper::hasClass()` with a CSS selector. hasClass() expects a class name, not a CSS selector.');
    }
    return this.single('hasClass', n => hasClassName(n, className));
  }

  /**
   * Iterates through each node of the current wrapper and executes the provided function with a
   * wrapper around the corresponding node passed in as the first argument.
   *
   * @param {Function} fn
   * @returns {ShallowWrapper}
   */
  forEach(fn) {
    this.getNodesInternal().forEach((n, i) => fn.call(this, this.wrap(n), i));
    return this;
  }

  /**
   * Maps the current array of nodes to another array. Each node is passed in as a `ShallowWrapper`
   * to the map function.
   *
   * @param {Function} fn
   * @returns {Array}
   */
  map(fn) {
    return this.getNodesInternal().map((n, i) => fn.call(this, this.wrap(n), i));
  }

  /**
   * Reduces the current array of nodes to a value. Each node is passed in as a `ShallowWrapper`
   * to the reducer function.
   *
   * @param {Function} fn - the reducer function
   * @param {*} initialValue - the initial value
   * @returns {*}
   */
  reduce(fn, initialValue = undefined) {
    if (arguments.length > 1) {
      return this.getNodesInternal().reduce(
        (accum, n, i) => fn.call(this, accum, this.wrap(n), i),
        initialValue,
      );
    }
    return this.getNodesInternal().reduce((accum, n, i) => fn.call(
      this,
      i === 1 ? this.wrap(accum) : accum,
      this.wrap(n),
      i,
    ));
  }

  /**
   * Reduces the current array of nodes to another array, from right to left. Each node is passed
   * in as a `ShallowWrapper` to the reducer function.
   *
   * @param {Function} fn - the reducer function
   * @param {*} initialValue - the initial value
   * @returns {*}
   */
  reduceRight(fn, initialValue = undefined) {
    if (arguments.length > 1) {
      return this.getNodesInternal().reduceRight(
        (accum, n, i) => fn.call(this, accum, this.wrap(n), i),
        initialValue,
      );
    }
    return this.getNodesInternal().reduceRight((accum, n, i) => fn.call(
      this,
      i === 1 ? this.wrap(accum) : accum,
      this.wrap(n),
      i,
    ));
  }

  /**
   * Returns a new wrapper with a subset of the nodes of the original wrapper, according to the
   * rules of `Array#slice`.
   *
   * @param {Number} begin
   * @param {Number} end
   * @returns {ShallowWrapper}
   */
  slice(begin, end) {
    return this.wrap(this.getNodesInternal().slice(begin, end));
  }

  /**
   * Returns whether or not any of the nodes in the wrapper match the provided selector.
   *
   * @param {EnzymeSelector} selector
   * @returns {Boolean}
   */
  some(selector) {
    if (this[ROOT] === this) {
      throw new Error('ShallowWrapper::some() can not be called on the root');
    }
    const predicate = buildPredicate(selector);
    return this.getNodesInternal().some(predicate);
  }

  /**
   * Returns whether or not any of the nodes in the wrapper pass the provided predicate function.
   *
   * @param {Function} predicate
   * @returns {Boolean}
   */
  someWhere(predicate) {
    return this.getNodesInternal().some((n, i) => predicate.call(this, this.wrap(n), i));
  }

  /**
   * Returns whether or not all of the nodes in the wrapper match the provided selector.
   *
   * @param {EnzymeSelector} selector
   * @returns {Boolean}
   */
  every(selector) {
    const predicate = buildPredicate(selector);
    return this.getNodesInternal().every(predicate);
  }

  /**
   * Returns whether or not any of the nodes in the wrapper pass the provided predicate function.
   *
   * @param {Function} predicate
   * @returns {Boolean}
   */
  everyWhere(predicate) {
    return this.getNodesInternal().every((n, i) => predicate.call(this, this.wrap(n), i));
  }

  /**
   * Utility method used to create new wrappers with a mapping function that returns an array of
   * nodes in response to a single node wrapper. The returned wrapper is a single wrapper around
   * all of the mapped nodes flattened (and de-duplicated).
   *
   * @param {Function} fn
   * @returns {ShallowWrapper}
   */
  flatMap(fn) {
    const nodes = this.getNodesInternal().map((n, i) => fn.call(this, this.wrap(n), i));
    const flattened = flat(nodes, 1);
    return this.wrap(flattened.filter(Boolean));
  }

  /**
   * Finds all nodes in the current wrapper nodes' render trees that match the provided predicate
   * function. The predicate function will receive the nodes inside a ShallowWrapper as its
   * first argument.
   *
   * @param {Function} predicate
   * @returns {ShallowWrapper}
   */
  findWhere(predicate) {
    return findWhereUnwrapped(this, (n) => {
      const node = this.wrap(n);
      return node.length > 0 && predicate(node);
    });
  }

  /**
   * Returns the node at a given index of the current wrapper.
   *
   * @param index
   * @returns {ReactElement}
   */
  get(index) {
    return this.getElements()[index];
  }

  /**
   * Returns a wrapper around the node at a given index of the current wrapper.
   *
   * @param index
   * @returns {ShallowWrapper}
   */
  at(index) {
    const nodes = this.getNodesInternal();
    if (index < nodes.length) {
      return this.wrap(nodes[index]);
    }
    return this.wrap([]);
  }

  /**
   * Returns a wrapper around the first node of the current wrapper.
   *
   * @returns {ShallowWrapper}
   */
  first() {
    return this.at(0);
  }

  /**
   * Returns a wrapper around the last node of the current wrapper.
   *
   * @returns {ShallowWrapper}
   */
  last() {
    return this.at(this.length - 1);
  }

  /**
   * Delegates to exists()
   *
   * @returns {boolean}
   */
  isEmpty() {
    // eslint-disable-next-line no-console
    console.warn('Enzyme::Deprecated method isEmpty() called, use exists() instead.');
    return !this.exists();
  }

  /**
   * Returns true if the current wrapper has nodes. False otherwise.
   * If called with a selector it returns `.find(selector).exists()` instead.
   *
   * @param {EnzymeSelector} selector (optional)
   * @returns {boolean}
   */
  exists(selector = null) {
    return arguments.length > 0 ? this.find(selector).exists() : this.length > 0;
  }

  /**
   * Utility method that throws an error if the current instance has a length other than one.
   * This is primarily used to enforce that certain methods are only run on a wrapper when it is
   * wrapping a single node.
   *
   * @param fn
   * @returns {*}
   */
  single(name, fn) {
    const fnName = typeof name === 'string' ? name : 'unknown';
    const callback = typeof fn === 'function' ? fn : name;
    if (this.length !== 1) {
      throw new Error(`Method “${fnName}” is meant to be run on 1 node. ${this.length} found instead.`);
    }
    return callback.call(this, this.getNodeInternal());
  }

  /**
   * Helpful utility method to create a new wrapper with the same root as the current wrapper, with
   * any nodes passed in as the first parameter automatically wrapped.
   *
   * @param node
   * @returns {ShallowWrapper}
   */
  wrap(node, root = this[ROOT], ...args) {
    if (node instanceof ShallowWrapper) {
      return node;
    }
    return new ShallowWrapper(node, root, ...args);
  }

  /**
   * Returns an HTML-like string of the shallow render for debugging purposes.
   *
   * @param {Object} [options] - Property bag of additional options.
   * @param {boolean} [options.ignoreProps] - if true, props are omitted from the string.
   * @param {boolean} [options.verbose] - if true, arrays and objects to be verbosely printed.
   * @returns {String}
   */
  debug(options = {}) {
    return debugNodes(this.getNodesInternal(), options);
  }

  /**
   * Invokes intercepter and returns itself. intercepter is called with itself.
   * This is helpful when debugging nodes in method chains.
   * @param fn
   * @returns {ShallowWrapper}
   */
  tap(intercepter) {
    intercepter(this);
    return this;
  }

  /**
   * Primarily useful for HOCs (higher-order components), this method may only be
   * run on a single, non-DOM node, and will return the node, shallow-rendered.
   *
   * @param {Object} options
   * @returns {ShallowWrapper}
   */
  dive(options = {}) {
    const adapter = getAdapter(this[OPTIONS]);
    const name = 'dive';
    return this.single(name, (n) => {
      if (n && n.nodeType === 'host') {
        throw new TypeError(`ShallowWrapper::${name}() can not be called on Host Components`);
      }
      const el = getAdapter(this[OPTIONS]).nodeToElement(n);
      if (!isCustomComponentElement(el, adapter)) {
        throw new TypeError(`ShallowWrapper::${name}() can only be called on components`);
      }
      const childOptions = {
        ...this[OPTIONS],
        ...options,
        context: options.context || {
          ...this[OPTIONS].context,
          ...this[ROOT][CHILD_CONTEXT],
        },
      };
      privateSet(childOptions, PROVIDER_VALUES, this[ROOT][PROVIDER_VALUES]);
      return this.wrap(el, null, childOptions);
    });
  }

  /**
   * Strips out all the not host-nodes from the list of nodes
   *
   * This method is useful if you want to check for the presence of host nodes
   * (actually rendered HTML elements) ignoring the React nodes.
   */
  hostNodes() {
    return this.filterWhere(n => typeof n.type() === 'string');
  }
}

/**
 * Updates the context of the primary wrapper when the
 * `wrappingComponent` re-renders.
 */
function updatePrimaryRootContext(wrappingComponent) {
  const adapter = getAdapter(wrappingComponent[OPTIONS]);
  const primaryWrapper = wrappingComponent[PRIMARY_WRAPPER];
  const primaryRenderer = primaryWrapper[RENDERER];
  const primaryNode = primaryRenderer.getNode();
  const {
    legacyContext,
    providerValues,
  } = getContextFromWrappingComponent(wrappingComponent, adapter);
  const prevProviderValues = primaryWrapper[PROVIDER_VALUES];

  primaryWrapper.setContext({
    ...wrappingComponent[PRIMARY_WRAPPER][OPTIONS].context,
    ...legacyContext,
  });
  primaryWrapper[PROVIDER_VALUES] = new Map([...prevProviderValues, ...providerValues]);

  if (typeof adapter.isContextConsumer === 'function' && adapter.isContextConsumer(primaryNode.type)) {
    const Consumer = primaryNode.type;
    // Adapters with an `isContextConsumer` method will definitely have a `getProviderFromConsumer`
    // method.
    const Provider = adapter.getProviderFromConsumer(Consumer);
    const newValue = providerValues.get(Provider);
    const oldValue = prevProviderValues.get(Provider);

    // Use referential comparison like React
    if (newValue !== oldValue) {
      primaryWrapper.rerender();
    }
  }
}

/**
 * A *special* "root" wrapper that represents the component passed as `wrappingComponent`.
 * It is linked to the primary root such that updates to it will update the primary.
 *
 * @class WrappingComponentWrapper
 */
class WrappingComponentWrapper extends ShallowWrapper {
  constructor(nodes, root, RootFinder) {
    super(nodes);
    privateSet(this, PRIMARY_WRAPPER, root);
    privateSet(this, ROOT_FINDER, RootFinder);
  }

  /**
   * Like rerender() on ShallowWrapper, except it also does a "full render" of
   * itself and updates the primary ShallowWrapper's context.
   */
  rerender(...args) {
    const result = super.rerender(...args);
    updatePrimaryRootContext(this);
    return result;
  }

  /**
   * Like setState() on ShallowWrapper, except it also does a "full render" of
   * itself and updates the primary ShallowWrapper's context.
   */
  setState(...args) {
    const result = super.setState(...args);
    updatePrimaryRootContext(this);
    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  getWrappingComponent() {
    throw new Error('ShallowWrapper::getWrappingComponent() can only be called on the root');
  }
}

if (ITERATOR_SYMBOL) {
  Object.defineProperty(ShallowWrapper.prototype, ITERATOR_SYMBOL, {
    configurable: true,
    value: function iterator() {
      const iter = this.getNodesInternal()[ITERATOR_SYMBOL]();
      const adapter = getAdapter(this[OPTIONS]);
      return {
        [ITERATOR_SYMBOL]() { return this; },
        next() {
          const next = iter.next();
          if (next.done) {
            return { done: true };
          }
          return {
            done: false,
            value: adapter.nodeToElement(next.value),
          };
        },
      };
    },
  });
}

function privateWarning(prop, extraMessage) {
  Object.defineProperty(ShallowWrapper.prototype, prop, {
    get() {
      throw new Error(`
        Attempted to access ShallowWrapper::${prop}, which was previously a private property on
        Enzyme ShallowWrapper instances, but is no longer and should not be relied upon.
        ${extraMessage}
      `);
    },
    enumerable: false,
    configurable: false,
  });
}

privateWarning('node', 'Consider using the getElement() method instead.');
privateWarning('nodes', 'Consider using the getElements() method instead.');
privateWarning('renderer', '');
privateWarning('options', '');
privateWarning('complexSelector', '');

export default ShallowWrapper;
