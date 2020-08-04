import escape from 'lodash.escape';
import functionName from 'function.prototype.name';
import isString from 'is-string';
import isNumber from 'is-number-object';
import isCallable from 'is-callable';
import isBoolean from 'is-boolean-object';
import inspect from 'object-inspect';
import has from 'has';

import {
  propsOfNode,
  childrenOfNode,
} from './RSTTraversal';
import getAdapter from './getAdapter';

const booleanValue = Function.bind.call(Function.call, Boolean.prototype.valueOf);

export function typeName(node) {
  const adapter = getAdapter();
  if (adapter.displayNameOfNode) {
    return getAdapter().displayNameOfNode(node) || 'Component';
  }
  return typeof node.type === 'function'
    ? (node.type.displayName || functionName(node.type) || 'Component')
    : node.type;
}

export function spaces(n) {
  return Array(n + 1).join(' ');
}

export function indent(depth, string) {
  return string.split('\n').map(x => `${spaces(depth)}${x}`).join('\n');
}

function propString(prop, options) {
  if (isString(prop)) {
    return inspect(String(prop), { quoteStyle: 'double' });
  }
  if (isNumber(prop)) {
    return `{${inspect(Number(prop))}}`;
  }
  if (isBoolean(prop)) {
    return `{${inspect(booleanValue(prop))}}`;
  }
  if (isCallable(prop)) {
    return `{${inspect(prop)}}`;
  }
  if (typeof prop === 'object') {
    if (options.verbose) {
      return `{${inspect(prop)}}`;
    }

    return '{{...}}';
  }
  return `{[${typeof prop}]}`;
}

function propsString(node, options) {
  const props = propsOfNode(node);
  const keys = Object.keys(props).filter(x => x !== 'children');
  return keys.map(key => `${key}=${propString(props[key], options)}`).join(' ');
}

function indentChildren(childrenStrs, indentLength) {
  return childrenStrs.length
    ? `\n${childrenStrs.map(x => indent(indentLength, x)).join('\n')}\n`
    : '';
}

function isRSTNodeLike(node) {
  return has(node, 'nodeType')
    && typeof node.nodeType === 'string'
    && has(node, 'type')
    && has(node, 'key')
    && has(node, 'ref')
    && has(node, 'instance')
    && has(node, 'rendered');
}

export function debugNode(node, indentLength = 2, options = {}) {
  if (typeof node === 'string' || typeof node === 'number') return escape(node);
  if (typeof node === 'function') {
    const name = functionName(node);
    return `[function${name ? ` ${name}` : ''}]`;
  }
  if (!node) return '';

  const adapter = getAdapter();
  if (!adapter.isValidElement(node) && !isRSTNodeLike(node)) {
    return `{${inspect(node)}}`;
  }

  const childrenStrs = childrenOfNode(node)
    .map(n => debugNode(n, indentLength, options))
    .filter(Boolean);
  const type = typeName(node);

  const props = options.ignoreProps ? '' : propsString(node, options);
  const beforeProps = props ? ' ' : '';
  const afterProps = childrenStrs.length
    ? '>'
    : ' ';
  const childrenIndented = indentChildren(childrenStrs, indentLength);
  const nodeClose = childrenStrs.length ? `</${type}>` : '/>';
  return `<${type}${beforeProps}${props}${afterProps}${childrenIndented}${nodeClose}`;
}

export function debugNodes(nodes, options = {}) {
  return nodes.map(node => debugNode(node, undefined, options)).join('\n\n\n');
}
