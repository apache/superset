import accessor from './accessor';
import getter from './getter';
import splitAccessPath from './splitAccessPath';

export default function(field, name, opt) {
  const path = splitAccessPath(field);
  field = path.length === 1 ? path[0] : field;
  return accessor(
    (opt && opt.get || getter)(path),
    [field],
    name || field
  );
}
