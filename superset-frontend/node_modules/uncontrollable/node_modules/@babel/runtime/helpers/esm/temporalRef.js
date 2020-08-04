import undef from "./temporalUndefined";
import err from "./tdz";
export default function _temporalRef(val, name) {
  return val === undef ? err(name) : val;
}