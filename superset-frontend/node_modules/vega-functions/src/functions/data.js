import {truthy} from 'vega-util';

export function data(name) {
  const data = this.context.data[name];
  return data ? data.values.value : [];
}

export function indata(name, field, value) {
  const index = this.context.data[name]['index:' + field],
        entry = index ? index.value.get(value) : undefined;
  return entry ? entry.count : entry;
}

export function setdata(name, tuples) {
  const df = this.context.dataflow,
        data = this.context.data[name],
        input = data.input;

  df.pulse(input, df.changeset().remove(truthy).insert(tuples));
  return 1;
}
