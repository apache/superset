const hop = Object.prototype.hasOwnProperty;

export default function(object, property) {
  return hop.call(object, property);
}
