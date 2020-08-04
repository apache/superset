import {event} from "./selection/on";

export default function() {
  var current = event, source;
  while (source = current.sourceEvent) current = source;
  return current;
}
