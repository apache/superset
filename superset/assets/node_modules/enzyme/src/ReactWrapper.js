import cheerio from 'cheerio';
import flat from 'array.prototype.flat';
import has from 'has';

import {
  containsChildrenSubArray,
  typeOfNode,
  displayNameOfNode,
  ITERATOR_SYMBOL,
  nodeEqual,
  nodeMatches,
  makeOptions,
  sym,
  privateSet,
  cloneElement,
} from './Utils';
import getAdapter from './getAdapter';
import { debugNodes } from './Debug';
import {
  propsOfNode,
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
const ROOT_NODES = sym('__rootNodes__');

/**
 * Finds all nodes in the current wrapper nodes' render trees that match the provided predicate
 * function.
 *
 * @param {ReactWrapper} wrapper
 * @param {Function} predicate
 * @param {Function} filter
 * @returns {ReactWrapper}
 */
function findWhereUnwrapped(wrapper, predicate, filter = treeFilter) {
  return wrapper.flatMap(n => filter(n.getNodeInternal(), predicate));
}

/**
 * Returns a new wrapper instance with only the nodes of the current wrapper instance that match
 * the provided predicate function.
 *
 * @param {ReactWrapper} wrapper
 * @param {Function} predicate
 * @returns {ReactWrapper}
 */
function filterWhereUnwrapped(wrapper, predicate) {
  return wrapper.wrap(wrapper.getNodesInternal().filter(predicate).filter(Boolean));
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
  if (!nodes) {
    privateSet(wrapper, NODE, null);
    privateSet(wrapper, NODES, []);
  } else if (!Array.isArray(nodes)) {
    privateSet(wrapper, NODE, nodes);
    privateSet(wrapper, NODES, [nodes]);
  } else {
    privateSet(wrapper, NODE, nodes[0]);
    privateSet(wrapper, NODES, nodes);
  }
  privateSet(wrapper, 'length', wrapper[NODES].length);
}

/**
 * @class ReactWrapper
 */
class ReactWrapper {
  constructor(nodes, root, passedOptions = {}) {
    if (!global.window && !global.document) {
      throw new Error('It looks like you called `mount()` without a global document being loaded.');
    }
    const options = makeOptions(passedOptions);

    if (!root) {
      const adapter = getAdapter(options);
      if (!adapter.isValidElement(nodes)) {
        throw new TypeError('ReactWrapper can only wrap valid elements');
      }

      privateSet(this, UNRENDERED, nodes);
      const renderer = adapter.createRenderer({ mode: 'mount', ...options });
      privateSet(this, RENDERER, renderer);
      renderer.render(nodes, options.context);
      privateSet(this, ROOT, this);
      privateSetNodes(this, this[RENDERER].getNode());
    } else {
      privateSet(this, UNRENDERED, null);
      privateSet(this, RENDERER, root[RENDERER]);
      privateSet(this, ROOT, root);
      privateSetNodes(this, nodes);
      privateSet(this, ROOT_NODES, root[NODES]);
    }
    privateSet(this, OPTIONS, root ? root[OPTIONS] : options);
  }

  /**
   * Returns the root wrapper
   *
   * @return {ReactWrapper}
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
      throw new Error('ReactWrapper::getNode() can only be called when wrapping one node');
    }
    return this[NODES][0];
  }

  /**
   * Returns the the wrapped components.
   *
   * @return {Array<ReactComponent>}
   */
  getNodesInternal() {
    return this[NODES];
  }

  /**
   * Returns the wrapped ReactElement.
   *
   * @return {ReactElement}
   */
  getElement() {
    return this.single('getElement', () => getAdapter(this[OPTIONS]).nodeToElement(this[NODE]));
  }

  /**
   * Returns the wrapped ReactElements.
   *
   * @return {Array<ReactElement>}
   */
  getElements() {
    return this[NODES].map(getAdapter(this[OPTIONS]).nodeToElement);
  }

  // eslint-disable-next-line class-methods-use-this
  getNode() {
    throw new Error('ReactWrapper::getNode() is no longer supported. Use ReactWrapper::instance() instead');
  }

  // eslint-disable-next-line class-methods-use-this
  getNodes() {
    throw new Error('ReactWrapper::getNodes() is no longer supported.');
  }

  /**
   * Returns the outer most DOMComponent of the current wrapper.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @returns {DOMComponent}
   */
  getDOMNode() {
    const adapter = getAdapter(this[OPTIONS]);
    return this.single('getDOMNode', n => adapter.nodeToHostNode(n));
  }

  /**
   * If the root component contained a ref, you can access it here and get the relevant
   * react component instance or HTML element instance.
   *
   * NOTE: can only be called on a wrapper instance that is also the root instance.
   *
   * @param {String} refname
   * @returns {ReactComponent | HTMLElement}
   */
  ref(refname) {
    if (this[ROOT] !== this) {
      throw new Error('ReactWrapper::ref(refname) can only be called on the root');
    }
    return this.instance().refs[refname];
  }

  /**
   * Returns the wrapper's underlying instance.
   *
   * Example:
   * ```
   * const wrapper = mount(<MyComponent />);
   * const inst = wrapper.instance();
   * expect(inst).to.be.instanceOf(MyComponent);
   * ```
   * @returns {ReactComponent|DOMComponent}
   */
  instance() {
    return this.single('instance', () => this[NODE].instance);
  }

  /**
   * Forces a re-render. Useful to run before checking the render output if something external
   * may be updating the state of the component somewhere.
   *
   * NOTE: no matter what instance this is called on, it will always update the root.
   *
   * @returns {ReactWrapper}
   */
  update() {
    const root = this[ROOT];
    if (this !== root) {
      return root.update();
    }
    privateSetNodes(this, this[RENDERER].getNode());
    return this;
  }

  /**
   * A method that unmounts the component. This can be used to simulate a component going through
   * and unmount/mount lifecycle.
   *
   * @returns {ReactWrapper}
   */
  unmount() {
    if (this[ROOT] !== this) {
      throw new Error('ReactWrapper::unmount() can only be called on the root');
    }
    this.single('unmount', () => {
      this[RENDERER].unmount();
      this.update();
    });
    return this;
  }

  /**
   * A method that re-mounts the component, if it is not currently mounted.
   * This can be used to simulate a component going through
   * an unmount/mount lifecycle.
   *
   * @returns {ReactWrapper}
   */
  mount() {
    if (this[ROOT] !== this) {
      throw new Error('ReactWrapper::mount() can only be called on the root');
    }
    this[RENDERER].render(this[UNRENDERED], this[OPTIONS].context, () => this.update());
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
   * @returns {ReactWrapper}
   */
  setProps(props, callback = undefined) {
    if (this[ROOT] !== this) {
      throw new Error('ReactWrapper::setProps() can only be called on the root');
    }
    if (arguments.length > 1 && typeof callback !== 'function') {
      throw new TypeError('ReactWrapper::setProps() expects a function as its second argument');
    }
    const adapter = getAdapter(this[OPTIONS]);
    this[UNRENDERED] = cloneElement(adapter, this[UNRENDERED], props);
    this[RENDERER].render(this[UNRENDERED], null, () => {
      this.update();
      if (callback) {
        callback();
      }
    });
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
   * @returns {ReactWrapper}
   */
  setState(state, callback = undefined) {
    if (this.instance() === null || this[RENDERER].getNode().nodeType !== 'class') {
      throw new Error('ReactWrapper::setState() can only be called on class components');
    }
    if (arguments.length > 1 && typeof callback !== 'function') {
      throw new TypeError('ReactWrapper::setState() expects a function as its second argument');
    }
    this.instance().setState(state, () => {
      this.update();
      if (callback) {
        const adapter = getAdapter(this[OPTIONS]);
        const instance = this.instance();
        if (adapter.invokeSetStateCallback) {
          adapter.invokeSetStateCallback(instance, callback);
        } else {
          callback.call(instance);
        }
      }
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
   * @returns {ReactWrapper}
   */
  setContext(context) {
    if (this[ROOT] !== this) {
      throw new Error('ReactWrapper::setContext() can only be called on the root');
    }
    if (!this[OPTIONS].context) {
      throw new Error('ShallowWrapper::setContext() can only be called on a wrapper that was originally passed a context option');
    }
    this[RENDERER].render(this[UNRENDERED], context, () => this.update());
    return this;
  }

  /**
   * Whether or not a given react element exists in the mount render tree.
   *
   * Example:
   * ```
   * const wrapper = mount(<MyComponent />);
   * expect(wrapper.contains(<div className="foo bar" />)).to.equal(true);
   * ```
   *
   * @param {ReactElement|Array<ReactElement>} nodeOrNodes
   * @returns {Boolean}
   */
  contains(nodeOrNodes) {
    const adapter = getAdapter(this[OPTIONS]);

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
   * Whether or not a given react element exists in the current render tree.
   * It will determine if one of the wrappers element "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrappers element and equals to each other.
   *
   * Example:
   * ```
   * // MyComponent outputs <div><div class="foo">Hello</div></div>
   * const wrapper = mount(<MyComponent />);
   * expect(wrapper.containsMatchingElement(<div>Hello</div>)).to.equal(true);
   * ```
   *
   * @param {ReactElement} node
   * @returns {Boolean}
   */
  containsMatchingElement(node) {
    const rstNode = getAdapter(this[OPTIONS]).elementToNode(node);
    const predicate = other => nodeMatches(rstNode, other, (a, b) => a <= b);
    return findWhereUnwrapped(this, predicate).length > 0;
  }

  /**
   * Whether or not all the given react elements exists in the current render tree.
   * It will determine if one of the wrappers element "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrappers element and equals to each other.
   *
   * Example:
   * ```
   * const wrapper = mount(<MyComponent />);
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
   * Whether or not one of the given react elements exists in the current render tree.
   * It will determine if one of the wrappers element "looks like" the expected
   * element by checking if all props of the expected element are present
   * on the wrappers element and equals to each other.
   *
   * Example:
   * ```
   * const wrapper = mount(<MyComponent />);
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
   * const wrapper = mount(<MyComponent />);
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
   * const wrapper = mount(<MyComponent />);
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
   * @param {String|Function} selector
   * @returns {ReactWrapper}
   */
  find(selector) {
    return this.wrap(reduceTreesBySelector(selector, this.getNodesInternal()));
  }

  /**
   * Returns whether or not current node matches a provided selector.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param {String|Function} selector
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
    return this.single('isEmptyRender', n => n.rendered === null);
  }

  /**
   * Returns a new wrapper instance with only the nodes of the current wrapper instance that match
   * the provided predicate function.
   *
   * @param {Function} predicate
   * @returns {ReactWrapper}
   */
  filterWhere(predicate) {
    return filterWhereUnwrapped(this, n => predicate(this.wrap(n)));
  }

  /**
   * Returns a new wrapper instance with only the nodes of the current wrapper instance that match
   * the provided selector.
   *
   * @param {String|Function} selector
   * @returns {ReactWrapper}
   */
  filter(selector) {
    const predicate = buildPredicate(selector);
    return filterWhereUnwrapped(this, predicate);
  }

  /**
   * Returns a new wrapper instance with only the nodes of the current wrapper that did not match
   * the provided selector. Essentially the inverse of `filter`.
   *
   * @param {String|Function} selector
   * @returns {ReactWrapper}
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
    const adapter = getAdapter(this[OPTIONS]);
    return this.single('text', (n) => {
      const node = adapter.nodeToHostNode(n);
      return node && node.textContent;
    });
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
      if (n === null) return null;
      const adapter = getAdapter(this[OPTIONS]);
      const node = adapter.nodeToHostNode(n);
      return node === null
        ? null
        : node.outerHTML.replace(/\sdata-(reactid|reactroot)+="([^"]*)+"/g, '');
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
    const html = this.html();
    return html === null ? cheerio() : cheerio.load('')(html);
  }

  /**
   * Used to simulate events. Pass an eventname and (optionally) event arguments. This method of
   * testing events should be met with some skepticism.
   *
   * @param {String} event
   * @param {Object} mock (optional)
   * @returns {ReactWrapper}
   */
  simulate(event, mock = {}) {
    return this.single('simulate', (n) => {
      this[RENDERER].simulateEvent(n, event, mock);
      this[ROOT].update();
      return this;
    });
  }

  /**
   * Used to simulate throwing a rendering error. Pass an error to throw.
   *
   * @param {String} error
   * @returns {ReactWrapper}
   */
  simulateError(error) {
    if (this[ROOT] === this) {
      throw new Error('ReactWrapper::simulateError() may not be called on the root');
    }

    return this.single('simulateError', (thisNode) => {
      if (thisNode.nodeType === 'host') {
        throw new Error('ReactWrapper::simulateError() can only be called on custom components');
      }

      const renderer = this[RENDERER];
      if (typeof renderer.simulateError !== 'function') {
        throw new TypeError('your adapter does not support `simulateError`. Try upgrading it!');
      }

      const rootNode = getRootNodeInternal(this);
      const nodeHierarchy = [thisNode].concat(nodeParents(this, thisNode));
      renderer.simulateError(nodeHierarchy, rootNode, error);

      this[ROOT].update();
      return this;
    });
  }

  /**
   * Returns the props hash for the root node of the wrapper.
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
    if (this.instance() === null || this[RENDERER].getNode().nodeType !== 'class') {
      throw new Error('ReactWrapper::state() can only be called on class components');
    }
    const _state = this.single('state', () => this.instance().state);
    if (typeof name !== 'undefined') {
      if (_state == null) {
        throw new TypeError(`ReactWrapper::state("${name}") requires that \`state\` not be \`null\` or \`undefined\``);
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
      throw new Error('ReactWrapper::context() can only be called on the root');
    }
    const instance = this.single('context', () => this.instance());
    if (instance === null) {
      throw new Error('ReactWrapper::context() can only be called on components with instances');
    }
    const _context = instance.context;
    if (typeof name !== 'undefined') {
      return _context[name];
    }
    return _context;
  }

  /**
   * Returns a new wrapper with all of the children of the current wrapper.
   *
   * @param {String|Function} [selector]
   * @returns {ReactWrapper}
   */
  children(selector) {
    const allChildren = this.flatMap(n => childrenOfNode(n.getNodeInternal()).filter(x => typeof x === 'object'));
    return selector ? allChildren.filter(selector) : allChildren;
  }

  /**
   * Returns a new wrapper with a specific child
   *
   * @param {Number} [index]
   * @returns {ReactWrapper}
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
   * @param {String|Function} [selector]
   * @returns {ReactWrapper}
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
   * @returns {ReactWrapper}
   */
  parent() {
    return this.flatMap(n => [n.parents().get(0)]);
  }

  /**
   *
   * @param {String|Function} selector
   * @returns {ReactWrapper}
   */
  closest(selector) {
    if (this.is(selector)) {
      return this;
    }
    const matchingAncestors = this.parents().filter(selector);
    return matchingAncestors.length > 0 ? matchingAncestors.first() : this.findWhere(() => false);
  }

  /**
   * Returns the value of  prop with the given name of the root node.
   *
   * @param {String} propName
   * @returns {*}
   */
  prop(propName) {
    return this.props()[propName];
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
        throw new TypeError('ReactWrapper::renderProp() can only be called on custom components');
      }
      if (typeof propName !== 'string') {
        throw new TypeError('`propName` must be a string');
      }
      const props = this.props();
      if (!has(props, propName)) {
        throw new Error(`no prop called “${propName}“ found`);
      }
      const propValue = props[propName];
      if (typeof propValue !== 'function') {
        throw new TypeError(`expected prop “${propName}“ to contain a function, but it holds “${typeof prop}“`);
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
   * Returns the type of the root node of this wrapper. If it's a composite component, this will be
   * the component constructor. If it's native DOM node, it will be a string.
   *
   * @returns {String|Function}
   */
  type() {
    return this.single('type', n => typeOfNode(n));
  }

  /**
   * Returns the name of the root node of this wrapper.
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
   * Returns whether or not the current root node has the given class name or not.
   *
   * NOTE: can only be called on a wrapper of a single node.
   *
   * @param {String} className
   * @returns {Boolean}
   */
  hasClass(className) {
    if (className && className.indexOf('.') !== -1) {
      // eslint-disable-next-line no-console
      console.warn('It looks like you\'re calling `ReactWrapper::hasClass()` with a CSS selector. hasClass() expects a class name, not a CSS selector.');
    }
    return this.single('hasClass', n => hasClassName(n, className));
  }

  /**
   * Iterates through each node of the current wrapper and executes the provided function with a
   * wrapper around the corresponding node passed in as the first argument.
   *
   * @param {Function} fn
   * @returns {ReactWrapper}
   */
  forEach(fn) {
    this.getNodesInternal().forEach((n, i) => fn.call(this, this.wrap(n), i));
    return this;
  }

  /**
   * Maps the current array of nodes to another array. Each node is passed in as a `ReactWrapper`
   * to the map function.
   *
   * @param {Function} fn
   * @returns {Array}
   */
  map(fn) {
    return this.getNodesInternal().map((n, i) => fn.call(this, this.wrap(n), i));
  }

  /**
   * Reduces the current array of nodes to another array.
   * Each node is passed in as a `ShallowWrapper` to the reducer function.
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
   * @param {Function|String} selector
   * @returns {Boolean}
   */
  some(selector) {
    if (this[ROOT] === this) {
      throw new Error('ReactWrapper::some() can not be called on the root');
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
   * @param {Function|String} selector
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
   * @returns {ReactWrapper}
   */
  flatMap(fn) {
    const nodes = this.getNodesInternal().map((n, i) => fn.call(this, this.wrap(n), i));
    const flattened = flat(nodes, 1);
    return this.wrap(flattened.filter(Boolean));
  }

  /**
   * Finds all nodes in the current wrapper nodes' render trees that match the provided predicate
   * function.
   *
   * @param {Function} predicate
   * @returns {ReactWrapper}
   */
  findWhere(predicate) {
    return findWhereUnwrapped(this, n => predicate(this.wrap(n)));
  }

  /**
   * Returns the node at a given index of the current wrapper.
   *
   * @param {Number} index
   * @returns {ReactElement}
   */
  get(index) {
    return this.getElements()[index];
  }

  /**
   * Returns a wrapper around the node at a given index of the current wrapper.
   *
   * @param {Number} index
   * @returns {ReactWrapper}
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
   * @returns {ReactWrapper}
   */
  first() {
    return this.at(0);
  }

  /**
   * Returns a wrapper around the last node of the current wrapper.
   *
   * @returns {ReactWrapper}
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
   * @param {String|Function} selector (optional)
   * @returns {boolean}
   */
  exists(selector = null) {
    if (arguments.length > 0 && typeof selector !== 'string') {
      throw new TypeError('`selector` argument must be a string, if present.');
    }
    return typeof selector === 'string' ? this.find(selector).exists() : this.length > 0;
  }

  /**
   * Utility method that throws an error if the current instance has a length other than one.
   * This is primarily used to enforce that certain methods are only run on a wrapper when it is
   * wrapping a single node.
   *
   * @param {Function} fn
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
   * @param {ReactWrapper|ReactElement|Array<ReactElement>} node
   * @returns {ReactWrapper}
   */
  wrap(node, root = this[ROOT], ...args) {
    if (node instanceof ReactWrapper) {
      return node;
    }
    return new ReactWrapper(node, root, ...args);
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
   * @returns {ReactWrapper}
   */
  tap(intercepter) {
    intercepter(this);
    return this;
  }

  /**
   * Detaches the react tree from the DOM. Runs `ReactDOM.unmountComponentAtNode()` under the hood.
   *
   * This method will most commonly be used as a "cleanup" method if you decide to use the
   * `attachTo` option in `mount(node, options)`.
   *
   * The method is intentionally not "fluent" (in that it doesn't return `this`) because you should
   * not be doing anything with this wrapper after this method is called.
   */
  detach() {
    if (this[ROOT] !== this) {
      throw new Error('ReactWrapper::detach() can only be called on the root');
    }
    if (!this[OPTIONS].attachTo) {
      throw new Error('ReactWrapper::detach() can only be called on when the `attachTo` option was passed into `mount()`.');
    }
    this[RENDERER].unmount();
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

if (ITERATOR_SYMBOL) {
  Object.defineProperty(ReactWrapper.prototype, ITERATOR_SYMBOL, {
    configurable: true,
    value: function iterator() {
      const iter = this[NODES][ITERATOR_SYMBOL]();
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
  Object.defineProperty(ReactWrapper.prototype, prop, {
    get() {
      throw new Error(`
        Attempted to access ReactWrapper::${prop}, which was previously a private property on
        Enzyme ReactWrapper instances, but is no longer and should not be relied upon.
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

export default ReactWrapper;
