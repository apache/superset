import {identity} from 'vega-util';

export default function UniqueList(idFunc) {
  var $ = idFunc || identity,
      list = [],
      ids = {};

  list.add = function(_) {
    var id = $(_);
    if (!ids[id]) {
      ids[id] = 1;
      list.push(_);
    }
    return list;
  };

  list.remove = function(_) {
    var id = $(_), idx;
    if (ids[id]) {
      ids[id] = 0;
      if ((idx = list.indexOf(_)) >= 0) {
        list.splice(idx, 1);
      }
    }
    return list;
  };

  return list;
}
