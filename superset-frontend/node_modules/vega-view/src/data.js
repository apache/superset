import {changeset, isChangeSet} from 'vega-dataflow';
import {error, hasOwnProperty, truthy} from 'vega-util';

export function dataref(view, name) {
  var data = view._runtime.data;
  if (!hasOwnProperty(data, name)) {
    error('Unrecognized data set: ' + name);
  }
  return data[name];
}

export function data(name, values) {
  return arguments.length < 2
    ? dataref(this, name).values.value
    : change.call(this, name, changeset().remove(truthy).insert(values));
}

export function change(name, changes) {
  if (!isChangeSet(changes)) {
    error('Second argument to changes must be a changeset.');
  }
  var dataset = dataref(this, name);
  dataset.modified = true;
  return this.pulse(dataset.input, changes);
}

export function insert(name, _) {
  return change.call(this, name, changeset().insert(_));
}

export function remove(name, _) {
  return change.call(this, name, changeset().remove(_));
}
