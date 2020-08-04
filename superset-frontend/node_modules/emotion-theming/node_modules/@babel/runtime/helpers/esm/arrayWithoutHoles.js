import arrayLikeToArray from "./arrayLikeToArray";
export default function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return arrayLikeToArray(arr);
}