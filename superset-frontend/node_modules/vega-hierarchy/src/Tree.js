import HierarchyLayout from './HierarchyLayout';
import {error, hasOwnProperty, inherits} from 'vega-util';
import {cluster, tree} from 'd3-hierarchy';

var Layouts = {
  tidy: tree,
  cluster: cluster
};

var Output = ['x', 'y', 'depth', 'children'];

/**
 * Tree layout. Depending on the method parameter, performs either
 * Reingold-Tilford 'tidy' layout or dendrogram 'cluster' layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 */
export default function Tree(params) {
  HierarchyLayout.call(this, params);
}

Tree.Definition = {
  'type': 'Tree',
  'metadata': {'tree': true, 'modifies': true},
  'params': [
    { 'name': 'field', 'type': 'field' },
    { 'name': 'sort', 'type': 'compare' },
    { 'name': 'method', 'type': 'enum', 'default': 'tidy', 'values': ['tidy', 'cluster'] },
    { 'name': 'size', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'nodeSize', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'separation', 'type': 'boolean', 'default': true },
    { 'name': 'as', 'type': 'string', 'array': true, 'length': Output.length, 'default': Output }
  ]
};

var prototype = inherits(Tree, HierarchyLayout);

/**
 * Tree layout generator. Supports both 'tidy' and 'cluster' layouts.
 */
prototype.layout = function(method) {
  var m = method || 'tidy';
  if (hasOwnProperty(Layouts, m)) return Layouts[m]();
  else error('Unrecognized Tree layout method: ' + m);
};

prototype.params = ['size', 'nodeSize'];

prototype.fields = Output;
