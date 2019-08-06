import { TextStyle } from '../types';

const STYLE_FIELDS: (keyof TextStyle)[] = [
  'font',
  'fontWeight',
  'fontStyle',
  'fontSize',
  'fontFamily',
  'letterSpacing',
];

export default function updateTextNode(
  node: SVGTextElement,
  {
    className,
    style = {},
    text,
  }: {
    className?: string;
    style?: TextStyle;
    text?: string;
  } = {},
) {
  const textNode = node;

  if (textNode.textContent !== text) {
    textNode.textContent = typeof text === 'undefined' ? null : text;
  }
  if (textNode.getAttribute('class') !== className) {
    textNode.setAttribute('class', className || '');
  }

  // clear style
  STYLE_FIELDS.forEach((field: keyof TextStyle) => {
    textNode.style[field] = null;
  });

  // apply new style
  // Note that the font field will auto-populate other font fields when applicable.
  STYLE_FIELDS.filter(
    (field: keyof TextStyle) => typeof style[field] !== 'undefined' && style[field] !== null,
  ).forEach((field: keyof TextStyle) => {
    textNode.style[field] = `${style[field]}`;
  });

  return textNode;
}
