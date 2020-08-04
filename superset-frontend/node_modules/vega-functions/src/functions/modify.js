import {isTuple} from 'vega-dataflow';
import {isArray, isObject, truthy} from 'vega-util';

function equal(a, b) {
  return a === b || a !== a && b !== b ? true
    : isArray(a) ? (
        isArray(b) && a.length === b.length ? equalArray(a, b) : false
      )
    : isObject(a) && isObject(b) ? equalObject(a, b)
    : false;
}

function equalArray(a, b) {
  for (let i=0, n=a.length; i<n; ++i) {
    if (!equal(a[i], b[i])) return false;
  }
  return true;
}

function equalObject(a, b) {
  for (let key in a) {
    if (!equal(a[key], b[key])) return false;
  }
  return true;
}

function removePredicate(props) {
  return _ => equalObject(props, _);
}

export default function(name, insert, remove, toggle, modify, values) {
  let df = this.context.dataflow,
      data = this.context.data[name],
      input = data.input,
      changes = data.changes,
      stamp = df.stamp(),
      predicate, key;

  if (df._trigger === false || !(input.value.length || insert || toggle)) {
    // nothing to do!
    return 0;
  }

  if (!changes || changes.stamp < stamp) {
    data.changes = (changes = df.changeset());
    changes.stamp = stamp;
    df.runAfter(function() {
      data.modified = true;
      df.pulse(input, changes).run();
    }, true, 1);
  }

  if (remove) {
    predicate = remove === true ? truthy
      : (isArray(remove) || isTuple(remove)) ? remove
      : removePredicate(remove);
    changes.remove(predicate);
  }

  if (insert) {
    changes.insert(insert);
  }

  if (toggle) {
    predicate = removePredicate(toggle);
    if (input.value.some(predicate)) {
      changes.remove(predicate);
    } else {
      changes.insert(toggle);
    }
  }

  if (modify) {
    for (key in values) {
      changes.modify(modify, key, values[key]);
    }
  }

  return 1;
}
