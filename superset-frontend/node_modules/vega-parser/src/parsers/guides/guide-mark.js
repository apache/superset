import {Skip} from './constants';
import {extendEncode} from '../encode/util';

export default function(mark, extras) {
  if (extras) {
    mark.name = extras.name;
    mark.style = extras.style || mark.style;
    mark.interactive = !!extras.interactive;
    mark.encode = extendEncode(mark.encode, extras, Skip);
  } else {
    mark.interactive = false;
  }
  return mark;
}
