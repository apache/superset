import {Bounds} from 'vega-scenegraph';

export const tempBounds = new Bounds();

export function set(item, property, value) {
  return item[property] === value ? 0
    : (item[property] = value, 1);
}