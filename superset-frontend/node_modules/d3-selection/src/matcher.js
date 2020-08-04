export default function(selector) {
  return function() {
    return this.matches(selector);
  };
}
