var component = /-?\d+(\.\d+)?%?/g;
function extractComponents(color) {
  return color.match(component);
}

module.exports = extractComponents;