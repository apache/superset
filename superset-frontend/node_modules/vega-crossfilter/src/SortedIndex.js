import {array32} from './arrays';
import {bisectLeft, bisectRight, permute} from 'd3-array';

/**
 * Maintains a list of values, sorted by key.
 */
export default function SortedIndex() {
  var index = array32(0),
      value = [],
      size = 0;

  function insert(key, data, base) {
    if (!data.length) return [];

    var n0 = size,
        n1 = data.length,
        addv = Array(n1),
        addi = array32(n1),
        oldv, oldi, i;

    for (i=0; i<n1; ++i) {
      addv[i] = key(data[i]);
      addi[i] = i;
    }
    addv = sort(addv, addi);

    if (n0) {
      oldv = value;
      oldi = index;
      value = Array(n0 + n1);
      index = array32(n0 + n1);
      merge(base, oldv, oldi, n0, addv, addi, n1, value, index);
    } else {
      if (base > 0) for (i=0; i<n1; ++i) {
        addi[i] += base;
      }
      value = addv;
      index = addi;
    }
    size = n0 + n1;

    return {index: addi, value: addv};
  }

  function remove(num, map) {
    // map: index -> remove
    var n = size,
        idx, i, j;

    // seek forward to first removal
    for (i=0; !map[index[i]] && i<n; ++i);

    // condense index and value arrays
    for (j=i; i<n; ++i) {
      if (!map[idx=index[i]]) {
        index[j] = idx;
        value[j] = value[i];
        ++j;
      }
    }

    size = n - num;
  }

  function reindex(map) {
    for (var i=0, n=size; i<n; ++i) {
      index[i] = map[index[i]];
    }
  }

  function bisect(range, array) {
    var n;
    if (array) {
      n = array.length;
    } else {
      array = value;
      n = size;
    }
    return [
      bisectLeft(array, range[0], 0, n),
      bisectRight(array, range[1], 0, n)
    ];
  }

  return {
    insert:  insert,
    remove:  remove,
    bisect:  bisect,
    reindex: reindex,
    index:   function() { return index; },
    size:    function() { return size; }
  };
}

function sort(values, index) {
  values.sort.call(index, function(a, b) {
    var x = values[a],
        y = values[b];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return permute(values, index);
}

function merge(base, value0, index0, n0, value1, index1, n1, value, index) {
  var i0 = 0, i1 = 0, i;

  for (i=0; i0 < n0 && i1 < n1; ++i) {
    if (value0[i0] < value1[i1]) {
      value[i] = value0[i0];
      index[i] = index0[i0++];
    } else {
      value[i] = value1[i1];
      index[i] = index1[i1++] + base;
    }
  }

  for (; i0 < n0; ++i0, ++i) {
    value[i] = value0[i0];
    index[i] = index0[i0];
  }

  for (; i1 < n1; ++i1, ++i) {
    value[i] = value1[i1];
    index[i] = index1[i1] + base;
  }
}
