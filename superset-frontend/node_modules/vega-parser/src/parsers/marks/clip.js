import {isObject, stringValue} from 'vega-util';

export default function(clip, scope) {
  var expr;

  if (isObject(clip)) {
    if (clip.signal) {
      expr = clip.signal;
    } else if (clip.path) {
      expr = 'pathShape(' + param(clip.path) + ')';
    } else if (clip.sphere) {
      expr = 'geoShape(' + param(clip.sphere) + ', {type: "Sphere"})';
    }
  }

  return expr
    ? scope.signalRef(expr)
    : !!clip;
}

function param(value) {
  return isObject(value) && value.signal
    ? value.signal
    : stringValue(value);
}