const attrText = val => (val + '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;');

/**
 * Generate string for an opening xml tag.
 * @param tag the name of the xml tag
 * @param attr hash of attribute name-value pairs to include
 * @param raw additional raw string to include in tag markup
 */
export function openTag(tag, attr, raw) {
  var s = '<' + tag, key, val;
  if (attr) {
    for (key in attr) {
      val = attr[key];
      if (val != null) {
        s += ' ' + key + '="' + attrText(val) + '"';
      }
    }
  }
  if (raw) s += ' ' + raw;
  return s + '>';
}

/**
 * Generate string for closing xml tag.
 * @param tag the name of the xml tag
 */
export function closeTag(tag) {
  return '</' + tag + '>';
}
