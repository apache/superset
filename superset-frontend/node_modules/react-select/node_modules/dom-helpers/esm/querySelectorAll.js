var toArray = Function.prototype.bind.call(Function.prototype.call, [].slice);
export default function qsa(element, selector) {
  return toArray(element.querySelectorAll(selector));
}