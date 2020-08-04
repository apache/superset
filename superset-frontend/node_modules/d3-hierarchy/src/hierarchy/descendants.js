export default function() {
  var nodes = [];
  this.each(function(node) {
    nodes.push(node);
  });
  return nodes;
}
