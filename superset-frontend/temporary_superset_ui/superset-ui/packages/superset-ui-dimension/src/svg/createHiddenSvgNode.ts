import { SVG_NS } from './constants';

export default function createHiddenSvgNode() {
  const svgNode = document.createElementNS(SVG_NS, 'svg');
  svgNode.style.position = 'absolute'; // so it won't disrupt page layout
  svgNode.style.opacity = '0'; // and not visible
  svgNode.style.pointerEvents = 'none'; // and not capturing mouse events

  return svgNode;
}
