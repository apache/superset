import {extend} from 'vega-util';

export default function() {
  var args = [].slice.call(arguments);
  args.unshift({});
  return extend.apply(null, args);
}
