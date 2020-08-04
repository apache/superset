import {domCanvas, domImage} from './src/domCanvas';
import {nodeCanvas, nodeImage} from './src/nodeCanvas';

export {domCanvas} from './src/domCanvas';
export {nodeCanvas} from './src/nodeCanvas';

export function canvas(w, h, type) {
  return domCanvas(w, h) || nodeCanvas(w, h, type) || null;
}

export function image() {
  return domImage() || nodeImage() || null;
}
