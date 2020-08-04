import {isGradient} from '../../Gradient';
import gradient from './gradient';

export default function(context, item, value) {
  return isGradient(value)
    ? gradient(context, value, item.bounds)
    : value;
}
