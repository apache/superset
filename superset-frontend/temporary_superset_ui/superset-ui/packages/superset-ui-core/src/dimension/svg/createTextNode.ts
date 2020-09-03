import { SVG_NS } from './constants';

export default function createTextNode() {
  return document.createElementNS(SVG_NS, 'text');
}
