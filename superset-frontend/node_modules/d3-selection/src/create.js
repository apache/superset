import creator from "./creator";
import select from "./select";

export default function(name) {
  return select(creator(name).call(document.documentElement));
}
