import {isObject} from 'vega-util';

const number = _ => +_ || 0;

const paddingObject = _ => ({top: _, bottom: _, left: _, right: _});

export default function(_) {
  return isObject(_)
    ? {
        top:    number(_.top),
        bottom: number(_.bottom),
        left:   number(_.left),
        right:  number(_.right)
      }
    : paddingObject(number(_));
}
