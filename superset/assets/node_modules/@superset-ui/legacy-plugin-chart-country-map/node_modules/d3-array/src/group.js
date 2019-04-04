import identity from "./identity";
import rollup from "./rollup";

export default function group(values, ...keys) {
  return rollup(values, identity, ...keys);
}
