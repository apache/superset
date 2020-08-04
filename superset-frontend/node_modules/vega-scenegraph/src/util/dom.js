// create a new DOM element
export function domCreate(doc, tag, ns) {
  if (!doc && typeof document !== 'undefined' && document.createElement) {
    doc = document;
  }
  return doc
    ? (ns ? doc.createElementNS(ns, tag) : doc.createElement(tag))
    : null;
}

// find first child element with matching tag
export function domFind(el, tag) {
  tag = tag.toLowerCase();
  var nodes = el.childNodes, i = 0, n = nodes.length;
  for (; i<n; ++i) if (nodes[i].tagName.toLowerCase() === tag) {
    return nodes[i];
  }
}

// retrieve child element at given index
// create & insert if doesn't exist or if tags do not match
export function domChild(el, index, tag, ns) {
  var a = el.childNodes[index], b;
  if (!a || a.tagName.toLowerCase() !== tag.toLowerCase()) {
    b = a || null;
    a = domCreate(el.ownerDocument, tag, ns);
    el.insertBefore(a, b);
  }
  return a;
}

// remove all child elements at or above the given index
export function domClear(el, index) {
  var nodes = el.childNodes,
      curr = nodes.length;
  while (curr > index) el.removeChild(nodes[--curr]);
  return el;
}

// generate css class name for mark
export function cssClass(mark) {
  return 'mark-' + mark.marktype
    + (mark.role ? ' role-' + mark.role : '')
    + (mark.name ? ' ' + mark.name : '');
}
