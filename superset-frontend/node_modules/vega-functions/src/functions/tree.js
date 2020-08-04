import {data} from './data';

const datum = d => d.data;

function treeNodes(name, context) {
  const tree = data.call(context, name);
  return tree.root && tree.root.lookup || {};
}

export function treePath(name, source, target) {
  const nodes = treeNodes(name, this),
        s = nodes[source],
        t = nodes[target];
  return s && t ? s.path(t).map(datum) : undefined;
}

export function treeAncestors(name, node) {
  const n = treeNodes(name, this)[node];
  return n ? n.ancestors().map(datum) : undefined;
}
