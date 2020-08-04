import {merge} from 'vega-util';

export default function(idFunc, source, input) {
  var $ = idFunc,
      data = source || [],
      add = input || [],
      rem = {},
      cnt = 0;

  return {
    add: function(t) { add.push(t); },
    remove: function(t) { rem[$(t)] = ++cnt; },
    size: function() { return data.length; },
    data: function(compare, resort) {
      if (cnt) {
        data = data.filter(function(t) { return !rem[$(t)]; });
        rem = {};
        cnt = 0;
      }
      if (resort && compare) {
        data.sort(compare);
      }
      if (add.length) {
        data = compare
          ? merge(compare, data, add.sort(compare))
          : data.concat(add);
        add = [];
      }
      return data;
    }
  };
}