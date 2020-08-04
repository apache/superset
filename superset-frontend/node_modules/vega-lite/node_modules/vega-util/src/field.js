import accessor from './accessor';
import splitAccessPath from './splitAccessPath';
import stringValue from './stringValue';

export default function(field, name) {
  var path = splitAccessPath(field),
      code = 'return _[' + path.map(stringValue).join('][') + '];';

  return accessor(
    Function('_', code),
    [(field = path.length===1 ? path[0] : field)],
    name || field
  );
}
