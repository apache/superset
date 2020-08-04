import accessor from './accessor';
import array from './array';
import splitAccessPath from './splitAccessPath';
import stringValue from './stringValue';

export default function(fields, flat) {
  if (fields) {
    fields = flat
      ? array(fields).map(function(f) { return f.replace(/\\(.)/g, '$1'); })
      : array(fields);
  }

  var fn = !(fields && fields.length)
    ? function() { return ''; }
    : Function('_', 'return \'\'+' +
        fields.map(function(f) {
          return '_[' + (flat
              ? stringValue(f)
              : splitAccessPath(f).map(stringValue).join('][')
            ) + ']';
        }).join('+\'|\'+') + ';');

  return accessor(fn, fields, 'key');
}
