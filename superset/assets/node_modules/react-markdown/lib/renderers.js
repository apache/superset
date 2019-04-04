/* eslint-disable react/prop-types, react/no-multi-comp */
'use strict';

var xtend = require('xtend');
var React = require('react');
var createElement = React.createElement;

module.exports = {
  root: 'div',
  break: 'br',
  paragraph: 'p',
  emphasis: 'em',
  strong: 'strong',
  thematicBreak: 'hr',
  blockquote: 'blockquote',
  delete: 'del',
  link: 'a',
  image: 'img',
  linkReference: 'a',
  imageReference: 'img',
  table: SimpleRenderer.bind(null, 'table'),
  tableHead: SimpleRenderer.bind(null, 'thead'),
  tableBody: SimpleRenderer.bind(null, 'tbody'),
  tableRow: SimpleRenderer.bind(null, 'tr'),
  tableCell: TableCell,

  list: List,
  listItem: ListItem,
  definition: NullRenderer,
  heading: Heading,
  inlineCode: InlineCode,
  code: CodeBlock,
  html: Html,
  virtualHtml: VirtualHtml
};

function SimpleRenderer(tag, props) {
  return createElement(tag, getCoreProps(props), props.children);
}

function TableCell(props) {
  var style = props.align ? { textAlign: props.align } : undefined;
  var coreProps = getCoreProps(props);
  return createElement(props.isHeader ? 'th' : 'td', style ? xtend({ style: style }, coreProps) : coreProps, props.children);
}

function Heading(props) {
  return createElement('h' + props.level, getCoreProps(props), props.children);
}

function List(props) {
  var attrs = getCoreProps(props);
  if (props.start !== null && props.start !== 1) {
    attrs.start = props.start.toString();
  }

  return createElement(props.ordered ? 'ol' : 'ul', attrs, props.children);
}

function ListItem(props) {
  var checkbox = null;
  if (props.checked !== null) {
    var checked = props.checked;
    checkbox = createElement('input', { type: 'checkbox', checked: checked, readOnly: true });
  }

  return createElement('li', getCoreProps(props), checkbox, props.children);
}

function CodeBlock(props) {
  var className = props.language && 'language-' + props.language;
  var code = createElement('code', className ? { className: className } : null, props.value);
  return createElement('pre', getCoreProps(props), code);
}

function InlineCode(props) {
  return createElement('code', getCoreProps(props), props.children);
}

function Html(props) {
  if (props.skipHtml) {
    return null;
  }

  var tag = props.isBlock ? 'div' : 'span';
  if (props.escapeHtml) {
    // @todo when fiber lands, we can simply render props.value
    return createElement(tag, null, props.value);
  }

  var nodeProps = { dangerouslySetInnerHTML: { __html: props.value } };
  return createElement(tag, nodeProps);
}

function VirtualHtml(props) {
  return createElement(props.tag, getCoreProps(props), props.children);
}

function NullRenderer() {
  return null;
}

function getCoreProps(props) {
  return props['data-sourcepos'] ? { 'data-sourcepos': props['data-sourcepos'] } : {};
}