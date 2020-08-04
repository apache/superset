import flat from 'array.prototype.flat';
import entries from 'object.entries';
import isSubset from 'is-subset';
import functionName from 'function.prototype.name';
import isRegex from 'is-regex';
import getAdapter from './getAdapter';

export function propsOfNode(node) {
  return (node && node.props) || {};
}

export function childrenOfNode(node) {
  if (!node) return [];

  const adapter = getAdapter();
  const adapterHasIsFragment = adapter.isFragment && typeof adapter.isFragment === 'function';

  const renderedArray = Array.isArray(node.rendered) ? flat(node.rendered, 1) : [node.rendered];

  // React adapters before 16 will not have isFragment
  if (!adapterHasIsFragment) {
    return renderedArray;
  }

  return flat(renderedArray.map((currentChild) => {
    // If the node is a Fragment, we want to return its children, not the fragment itself
    if (adapter.isFragment(currentChild)) {
      return childrenOfNode(currentChild);
    }

    return currentChild;
  }), 1);
}

export function hasClassName(node, className) {
  let classes = propsOfNode(node).className || '';
  classes = String(classes).replace(/\s/g, ' ');
  if (isRegex(className)) return className.test(classes);
  return ` ${classes} `.indexOf(` ${className} `) > -1;
}

export function treeForEach(tree, fn) {
  if (tree) {
    fn(tree);
  }
  childrenOfNode(tree).forEach(node => treeForEach(node, fn));
}

export function treeFilter(tree, fn) {
  const results = [];
  treeForEach(tree, (node) => {
    if (fn(node)) {
      results.push(node);
    }
  });
  return results;
}

/**
 * To support sibling selectors we need to be able to find
 * the siblings of a node. The easiest way to do that is find
 * the parent of the node and access its children.
 *
 * This would be unneeded if the RST spec included sibling pointers
 * such as node.nextSibling and node.prevSibling
 * @param {*} root
 * @param {*} targetNode
 */
export function findParentNode(root, targetNode) {
  const results = treeFilter(
    root,
    (node) => {
      if (!node.rendered) {
        return false;
      }

      return childrenOfNode(node).indexOf(targetNode) !== -1;
    },
  );
  return results[0] || null;
}

function pathFilter(path, fn) {
  return path.filter(tree => treeFilter(tree, fn).length !== 0);
}

export function pathToNode(node, root) {
  const queue = [root];
  const path = [];

  const hasNode = testNode => node === testNode;

  while (queue.length) {
    const current = queue.pop();
    const children = childrenOfNode(current);
    if (current === node) return pathFilter(path, hasNode);

    path.push(current);

    if (children.length === 0) {
      // leaf node. if it isn't the node we are looking for, we pop.
      path.pop();
    }
    queue.push(...children);
  }

  return null;
}

export function parentsOfNode(node, root) {
  return (pathToNode(node, root) || []).reverse();
}

export function nodeHasId(node, id) {
  return propsOfNode(node).id === id;
}

const CAN_NEVER_MATCH = {};
function replaceUndefined(v) {
  return typeof v !== 'undefined' ? v : CAN_NEVER_MATCH;
}
function replaceUndefinedValues(obj) {
  return entries(obj)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: replaceUndefined(v) }), {});
}

export function nodeMatchesObjectProps(node, props) {
  return isSubset(propsOfNode(node), replaceUndefinedValues(props));
}

function getTextFromHostNode(hostNode) {
  if (typeof hostNode === 'string') {
    return String(hostNode || '');
  }
  if (!hostNode) {
    return '';
  }
  return hostNode.textContent || '';
}

function getTextFromRSTNode(node, {
  getCustom,
  handleHostNodes,
  recurse,
  nullRenderReturnsNull = false,
}) {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (getCustom && node.type && typeof node.type === 'function') {
    return getCustom(node);
  }

  if (handleHostNodes && node.nodeType === 'host') {
    return handleHostNodes(node);
  }
  if (node.rendered == null && nullRenderReturnsNull) {
    return null;
  }
  return childrenOfNode(node).map(recurse).join('');
}

export function getTextFromNode(node) {
  return getTextFromRSTNode(node, {
    recurse: getTextFromNode,
    getCustom({ type }) {
      return `<${type.displayName || functionName(type)} />`;
    },
  });
}

export function getTextFromHostNodes(node, adapter) {
  return getTextFromRSTNode(node, {
    recurse(item) {
      return getTextFromHostNodes(item, adapter);
    },
    handleHostNodes(item) {
      const nodes = [].concat(adapter.nodeToHostNode(item, true));
      return nodes.map(getTextFromHostNode).join('');
    },
  });
}

function getHTMLFromHostNode(hostNode) {
  if (hostNode == null) {
    return null;
  }
  return hostNode.outerHTML.replace(/\sdata-(reactid|reactroot)+="([^"]*)+"/g, '');
}

export function getHTMLFromHostNodes(node, adapter) {
  return getTextFromRSTNode(node, {
    recurse(item) {
      return getHTMLFromHostNodes(item, adapter);
    },
    handleHostNodes(item) {
      const nodes = [].concat(adapter.nodeToHostNode(item, true));
      return nodes.map(getHTMLFromHostNode).join('');
    },
    nullRenderReturnsNull: true,
  });
}
