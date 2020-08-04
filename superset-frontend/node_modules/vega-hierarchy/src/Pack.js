import HierarchyLayout from './HierarchyLayout';
import {inherits} from 'vega-util';
import {pack} from 'd3-hierarchy';

var Output = ['x', 'y', 'r', 'depth', 'children'];

/**
 * Packed circle tree layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The value field to size nodes.
 */
export default function Pack(params) {
  HierarchyLayout.call(this, params);
}

Pack.Definition = {
  'type': 'Pack',
  'metadata': {'tree': true, 'modifies': true},
  'params': [
    { 'name': 'field', 'type': 'field' },
    { 'name': 'sort', 'type': 'compare' },
    { 'name': 'padding', 'type': 'number', 'default': 0 },
    { 'name': 'radius', 'type': 'field', 'default': null },
    { 'name': 'size', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'as', 'type': 'string', 'array': true, 'length': Output.length, 'default': Output }
  ]
};

var prototype = inherits(Pack, HierarchyLayout);

prototype.layout = pack;

prototype.params = ['radius', 'size', 'padding'];

prototype.fields = Output;
