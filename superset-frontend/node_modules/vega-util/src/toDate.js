import isDate from './isDate';
import isNumber from './isNumber';

function defaultParser(_) {
  return isNumber(_) ? _ : isDate(_) ? _ : Date.parse(_);
}

export default function(_, parser) {
  parser = parser || defaultParser;
  return _ == null || _ === '' ? null : parser(_);
}
