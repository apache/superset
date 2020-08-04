const NULL_PICKING_COLOR = new Uint8Array([0, 0, 0]);

// Encodes an index as a Uint8Array([r, g, b]) format picking color
export function encodePickingColor(i) {
  return [(i + 1) & 255, ((i + 1) >> 8) & 255, ((i + 1) >> 16) & 255];
}

// Decodes a picking color in [r, g, b] format to an index
export function decodePickingColor(color) {
  // assert(color instanceof Uint8Array);
  const [i1, i2, i3] = color;
  // 1 was added to seperate from no selection
  const index = i1 + i2 * 256 + i3 * 65536 - 1;
  return index;
}

// Return picking color representing no item at that pixel
export function getNullPickingColor() {
  return NULL_PICKING_COLOR;
}
