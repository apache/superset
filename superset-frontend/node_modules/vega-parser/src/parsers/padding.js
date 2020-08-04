import {isObject} from 'vega-util';

const number = _ => +_ || 0;

const paddingObject = _ => ({top: _, bottom: _, left: _, right: _});

export default function(spec) {
  return !isObject(spec) ? paddingObject(number(spec))
    : spec.signal ? spec
    : {
        top:    number(spec.top),
        bottom: number(spec.bottom),
        left:   number(spec.left),
        right:  number(spec.right)
      };
}
