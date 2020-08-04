var NodeCanvas;

try {
  NodeCanvas = require('canvas');
  if (!(NodeCanvas && NodeCanvas.createCanvas)) {
    NodeCanvas = null;
  }
} catch (error) {
  // do nothing
}

export function nodeCanvas(w, h, type) {
  if (NodeCanvas) {
    try {
      return new NodeCanvas.Canvas(w, h, type);
    } catch (e) {
      // do nothing, return null on error
    }
  }
  return null;
}

export function nodeImage() {
  return (NodeCanvas && NodeCanvas.Image) || null;
}
