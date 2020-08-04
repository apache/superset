import arrayWithHoles from "./arrayWithHoles";
import iterableToArray from "./iterableToArray";
import unsupportedIterableToArray from "./unsupportedIterableToArray";
import nonIterableRest from "./nonIterableRest";
export default function _toArray(arr) {
  return arrayWithHoles(arr) || iterableToArray(arr) || unsupportedIterableToArray(arr) || nonIterableRest();
}