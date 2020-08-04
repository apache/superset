import sourceEvent from "./sourceEvent";
import point from "./point";

export default function(node) {
  var event = sourceEvent();
  if (event.changedTouches) event = event.changedTouches[0];
  return point(node, event);
}
