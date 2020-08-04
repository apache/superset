import Bounds from '../Bounds';
import boundContext from './boundContext';
import {isFunction} from 'vega-util';

var clipBounds = new Bounds();

export default function(mark) {
  var clip = mark.clip;

  if (isFunction(clip)) {
    clip(boundContext(clipBounds.clear()));
  } else if (clip) {
    clipBounds.set(0, 0, mark.group.width, mark.group.height);
  } else return;

  mark.bounds.intersect(clipBounds);
}
