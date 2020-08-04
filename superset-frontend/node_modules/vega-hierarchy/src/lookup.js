// Build lookup table mapping tuple keys to tree node instances
export default function(tree, key, filter) {
  var map = {};
  tree.each(function(node) {
    var t = node.data;
    if (filter(t)) map[key(t)] = node;
  });
  tree.lookup = map;
  return tree;
}
