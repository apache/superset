export function domCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    var c = document.createElement('canvas');
    if (c && c.getContext) {
      c.width = w;
      c.height = h;
      return c;
    }
  }
  return null;
}

export function domImage() {
  return typeof Image !== 'undefined' ? Image : null;
}
