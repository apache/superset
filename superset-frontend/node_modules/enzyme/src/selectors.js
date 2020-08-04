import { createParser } from 'rst-selector-parser';
import values from 'object.values';
import flat from 'array.prototype.flat';
import is from 'object-is';
import has from 'has';
import elementsByConstructor from 'html-element-map/byConstructor';
import {
  treeFilter,
  nodeHasId,
  findParentNode,
  nodeMatchesObjectProps,
  childrenOfNode,
  hasClassName,
} from './RSTTraversal';
import { nodeHasType, propsOfNode } from './Utils';
import getAdapter from './getAdapter';
// our CSS selector parser instance
const parser = createParser();

// Combinators that allow you to chance selectors
const CHILD = 'childCombinator';
const ADJACENT_SIBLING = 'adjacentSiblingCombinator';
const GENERAL_SIBLING = 'generalSiblingCombinator';
const DESCENDANT = 'descendantCombinator';

// Selectors for targeting elements
const SELECTOR = 'selector';
const TYPE_SELECTOR = 'typeSelector';
const CLASS_SELECTOR = 'classSelector';
const ID_SELECTOR = 'idSelector';
const UNIVERSAL_SELECTOR = 'universalSelector';
const ATTRIBUTE_PRESENCE = 'attributePresenceSelector';
const ATTRIBUTE_VALUE = 'attributeValueSelector';
// @TODO we dont support these, throw if they are used
const PSEUDO_CLASS = 'pseudoClassSelector';
const PSEUDO_ELEMENT = 'pseudoElementSelector';

const EXACT_ATTRIBUTE_OPERATOR = '=';
const WHITELIST_ATTRIBUTE_OPERATOR = '~=';
const HYPHENATED_ATTRIBUTE_OPERATOR = '|=';
const PREFIX_ATTRIBUTE_OPERATOR = '^=';
const SUFFIX_ATTRIBUTE_OPERATOR = '$=';
const SUBSTRING_ATTRIBUTE_OPERATOR = '*=';

function unique(arr) {
  return [...new Set(arr)];
}

/**
 * Calls reduce on a array of nodes with the passed
 * function, returning only unique results.
 * @param {Function} fn
 * @param {Array<Node>} nodes
 */
function uniqueReduce(fn, nodes) {
  return unique(nodes.reduce(fn, []));
}

/**
 * Takes a CSS selector and returns a set of tokens parsed
 * by scalpel.
 * @param {String} selector
 */
function safelyGenerateTokens(selector) {
  try {
    return parser.parse(selector);
  } catch (err) {
    throw new Error(`Failed to parse selector: ${selector}`);
  }
}

function matchAttributeSelector(node, token) {
  const { operator, value, name } = token;
  const nodeProps = propsOfNode(node);
  const descriptor = Object.getOwnPropertyDescriptor(nodeProps, name);
  if (descriptor && descriptor.get) {
    return false;
  }
  const nodePropValue = nodeProps[name];
  if (typeof nodePropValue === 'undefined') {
    return false;
  }
  if (token.type === ATTRIBUTE_PRESENCE) {
    return has(nodeProps, token.name);
  }
  // Only the exact value operator ("=") can match non-strings
  if (typeof nodePropValue !== 'string' || typeof value !== 'string') {
    if (operator !== EXACT_ATTRIBUTE_OPERATOR) {
      return false;
    }
  }
  switch (operator) {
    /**
     * Represents an element with the att attribute whose value is exactly "val".
     * @example
     * [attr="val"] matches attr="val"
     */
    case EXACT_ATTRIBUTE_OPERATOR:
      return is(nodePropValue, value);
    /**
     * Represents an element with the att attribute whose value is a whitespace-separated
     * list of words, one of which is exactly
     * @example
     *  [rel~="copyright"] matches rel="copyright other"
     */
    case WHITELIST_ATTRIBUTE_OPERATOR:
      return nodePropValue.split(' ').indexOf(value) !== -1;
    /**
     * Represents an element with the att attribute, its value either being exactly the
     * value or beginning with the value immediately followed by "-"
     * @example
     * [hreflang|="en"] matches hreflang="en-US"
     */
    case HYPHENATED_ATTRIBUTE_OPERATOR:
      return nodePropValue === value || nodePropValue.startsWith(`${value}-`);
    /**
     * Represents an element with the att attribute whose value begins with the prefix value.
     * If the value is the empty string then the selector does not represent anything.
     * @example
     * [type^="image"] matches type="imageobject"
     */
    case PREFIX_ATTRIBUTE_OPERATOR:
      return value === '' ? false : nodePropValue.slice(0, value.length) === value;
    /**
     * Represents an element with the att attribute whose value ends with the suffix value.
     * If the value is the empty string then the selector does not represent anything.
     * @example
     * [type$="image"] matches type="imageobject"
     */
    case SUFFIX_ATTRIBUTE_OPERATOR:
      return value === '' ? false : nodePropValue.slice(-value.length) === value;
    /**
     * Represents an element with the att attribute whose value contains at least one
     * instance of the value. If value is the empty string then the
     * selector does not represent anything.
     * @example
     * [title*="hello"] matches title="well hello there"
     */
    case SUBSTRING_ATTRIBUTE_OPERATOR:
      return value === '' ? false : nodePropValue.indexOf(value) !== -1;
    default:
      throw new Error(`Enzyme::Selector: Unknown attribute selector operator "${operator}"`);
  }
}


function matchPseudoSelector(node, token, root) {
  const { name, parameters } = token;
  if (name === 'not') {
    // eslint-disable-next-line no-use-before-define
    return parameters.every(selector => reduceTreeBySelector(selector, node).length === 0);
  }
  if (name === 'empty') {
    return treeFilter(node, n => n !== node).length === 0;
  }
  if (name === 'first-child') {
    const { rendered } = findParentNode(root, node);
    const [firstChild] = rendered;
    return firstChild === node;
  }
  if (name === 'last-child') {
    const { rendered } = findParentNode(root, node);
    return rendered[rendered.length - 1] === node;
  }
  if (name === 'focus') {
    if (typeof document === 'undefined') {
      throw new Error('Enzyme::Selector does not support the ":focus" pseudo-element without a global `document`.');
    }
    const adapter = getAdapter();
    /* eslint-env browser */
    return document.activeElement && adapter.nodeToHostNode(node) === document.activeElement;
  }

  throw new TypeError(`Enzyme::Selector does not support the "${token.name}" pseudo-element or pseudo-class selectors.`);
}

/**
 * Takes a node and a token and determines if the node
 * matches the predicate defined by the token.
 * @param {Node} node
 * @param {Token} token
 */
function nodeMatchesToken(node, token, root) {
  if (node === null || typeof node === 'string') {
    return false;
  }
  switch (token.type) {
    /**
     * Match every node
     * @example '*' matches every node
     */
    case UNIVERSAL_SELECTOR:
      return true;
    /**
     * Match against the className prop
     * @example '.active' matches <div className='active' />
     */
    case CLASS_SELECTOR:
      return hasClassName(node, token.name);
    /**
     * Simple type matching
     * @example 'div' matches <div />
     */
    case TYPE_SELECTOR:
      return nodeHasType(node, token.name);
    /**
     * Match against the `id` prop
     * @example '#nav' matches <ul id="nav" />
     */
    case ID_SELECTOR:
      return nodeHasId(node, token.name);
    /**
     * Matches if an attribute is present, regardless
     * of its value
     * @example '[disabled]' matches <a disabled />
     */
    case ATTRIBUTE_PRESENCE:
      return matchAttributeSelector(node, token);
    /**
     * Matches if an attribute is present with the
     * provided value
     * @example '[data-foo=foo]' matches <div data-foo="foo" />
     */
    case ATTRIBUTE_VALUE:
      return matchAttributeSelector(node, token);
    case PSEUDO_ELEMENT:
    case PSEUDO_CLASS:
      return matchPseudoSelector(node, token, root);
    default:
      throw new Error(`Unknown token type: ${token.type}`);
  }
}

/**
 * Returns a predicate function that checks if a
 * node matches every token in the body of a selector
 * token.
 * @param {Token} token
 */
function buildPredicateFromToken(token, root) {
  return node => token.body.every(bodyToken => nodeMatchesToken(node, bodyToken, root));
}

/**
 * Returns whether a parsed selector is a complex selector, which
 * is defined as a selector that contains combinators.
 * @param {Array<Token>} tokens
 */
function isComplexSelector(tokens) {
  return tokens.some(token => token.type !== SELECTOR);
}


/**
 * Takes a component constructor, object, or string representing
 * a simple selector and returns a predicate function that can
 * be applied to a single node.
 * @param {EnzymeSelector} selector
 */
export function buildPredicate(selector) {
  // If the selector is a string, parse it as a simple CSS selector
  if (typeof selector === 'string') {
    const tokens = safelyGenerateTokens(selector);
    if (isComplexSelector(tokens)) {
      throw new TypeError('This method does not support complex CSS selectors');
    }
    // Simple selectors only have a single selector token
    return buildPredicateFromToken(tokens[0]);
  }

  // If the selector is an element type, check if the node's type matches
  const adapter = getAdapter();
  const isElementType = adapter.isValidElementType
    ? adapter.isValidElementType(selector)
    : typeof selector === 'function';
  if (isElementType) {
    return node => adapter.matchesElementType(node, selector);
  }
  // If the selector is an non-empty object, treat the keys/values as props
  if (typeof selector === 'object') {
    if (!Array.isArray(selector) && selector !== null && Object.keys(selector).length > 0) {
      const hasUndefinedValues = values(selector).some(value => typeof value === 'undefined');
      if (hasUndefinedValues) {
        throw new TypeError('Enzyme::Props can’t have `undefined` values. Try using ‘findWhere()’ instead.');
      }
      return node => nodeMatchesObjectProps(node, selector);
    }
    throw new TypeError('Enzyme::Selector does not support an array, null, or empty object as a selector');
  }

  throw new TypeError('Enzyme::Selector expects a string, object, or valid element type (Component Constructor)');
}

/**
 * Matches only nodes which are adjacent siblings (direct next sibling)
 * against a predicate, returning those that match.
 * @param {Array<Node>} nodes
 * @param {Function} predicate
 * @param {Node} root
 */
function matchAdjacentSiblings(nodes, predicate, root) {
  return nodes.reduce((matches, node) => {
    const parent = findParentNode(root, node);
    // If there's no parent, there's no siblings
    if (!parent) {
      return matches;
    }
    const parentChildren = childrenOfNode(parent);
    const nodeIndex = parentChildren.indexOf(node);
    const adjacentSibling = parentChildren[nodeIndex + 1];
    // No sibling
    if (!adjacentSibling) {
      return matches;
    }
    if (predicate(adjacentSibling)) {
      matches.push(adjacentSibling);
    }
    return matches;
  }, []);
}

/**
 * Matches only nodes which are general siblings (any sibling *after*)
 * against a predicate, returning those that match.
 * @param {Array<Node>} nodes
 * @param {Function} predicate
 * @param {Node} root
 */
function matchGeneralSibling(nodes, predicate, root) {
  return uniqueReduce((matches, node) => {
    const parent = findParentNode(root, node);
    if (!parent) {
      return matches;
    }
    const parentChildren = childrenOfNode(parent);
    const nodeIndex = parentChildren.indexOf(node);
    const youngerSiblings = parentChildren.slice(nodeIndex + 1);
    return matches.concat(youngerSiblings.filter(predicate));
  }, nodes);
}

/**
 * Matches only nodes which are direct children (not grandchildren, etc.)
 * against a predicate, returning those that match.
 * @param {Array<Node>} nodes
 * @param {Function} predicate
 */
function matchDirectChild(nodes, predicate) {
  return uniqueReduce(
    (matches, node) => matches.concat(childrenOfNode(node).filter(predicate)),
    nodes,
  );
}

/**
 * Matches all descendant nodes against a predicate,
 * returning those that match.
 * @param {Array<Node>} nodes
 * @param {Function} predicate
 */
function matchDescendant(nodes, predicate) {
  return uniqueReduce(
    (matches, node) => matches.concat(treeFilter(node, predicate)),
    flat(nodes.map(childrenOfNode)),
  );
}

/**
 * Takes an RST and reduces it to a set of nodes matching
 * the selector. The selector can be a simple selector, which
 * is handled by `buildPredicate`, or a complex CSS selector which
 * reduceTreeBySelector parses and reduces the tree based on the combinators.
 *
 * @param {EnzymeSelector} selector
 * @param {RSTNode} root
 */
export function reduceTreeBySelector(selector, root) {
  if (typeof selector !== 'string') {
    const elements = elementsByConstructor(selector);
    if (elements.length > 0) {
      return flat(elements.map(x => reduceTreeBySelector(x.tag, root)));

      // when https://github.com/aweary/rst-selector-parser/issues/15 is resolved
      // const htmlTagNames = elements.map(x => x.tag).join(', ');
      // return reduceTreeBySelector(htmlTagNames, root);
    }
  }

  if (typeof selector === 'function' || typeof selector === 'object') {
    return treeFilter(root, buildPredicate(selector));
  }

  let results = [];
  if (typeof selector === 'string') {
    const tokens = safelyGenerateTokens(selector);
    let index = 0;
    while (index < tokens.length) {
      const token = tokens[index];
      /**
       * There are two types of tokens in a CSS selector:
       *
       * 1. Selector tokens. These target nodes directly, like
       *    type or attribute selectors. These are easy to apply
       *    because we can traverse the tree and return only
       *    the nodes that match the predicate.
       *
       * 2. Combinator tokens. These tokens chain together
       *    selector nodes. For example > for children, or +
       *    for adjacent siblings. These are harder to match
       *    as we have to track where in the tree we are
       *    to determine if a selector node applies or not.
       */
      if (token.type === SELECTOR) {
        const predicate = buildPredicateFromToken(token, root);
        results = results.concat(treeFilter(root, predicate));
      } else {
        // We can assume there always all previously matched tokens since selectors
        // cannot start with combinators.
        const { type } = token;
        // We assume the next token is a selector, so move the index
        // forward and build the predicate.
        index += 1;
        const predicate = buildPredicateFromToken(tokens[index], root);
        // We match against only the nodes which have already been matched,
        // since a combinator is meant to refine a previous selector.
        switch (type) {
          // The + combinator
          case ADJACENT_SIBLING:
            results = matchAdjacentSiblings(results, predicate, root);
            break;
          // The ~ combinator
          case GENERAL_SIBLING:
            results = matchGeneralSibling(results, predicate, root);
            break;
          // The > combinator
          case CHILD:
            results = matchDirectChild(results, predicate);
            break;
          // The ' ' (whitespace) combinator
          case DESCENDANT: {
            results = matchDescendant(results, predicate);
            break;
          }
          default:
            throw new Error(`Unknown combinator selector: ${type}`);
        }
      }
      index += 1;
    }
  } else {
    throw new TypeError('Enzyme::Selector expects a string, object, or Component Constructor');
  }
  return results;
}

export function reduceTreesBySelector(selector, roots) {
  const results = roots.map(n => reduceTreeBySelector(selector, n));
  return unique(flat(results, 1));
}
