var TUPLE_ID_KEY = Symbol('vega_id'),
    TUPLE_ID = 1;

/**
 * Resets the internal tuple id counter to one.
 */
export function reset() {
  TUPLE_ID = 1;
}

/**
 * Checks if an input value is a registered tuple.
 * @param {*} t - The value to check.
 * @return {boolean} True if the input is a tuple, false otherwise.
 */
export function isTuple(t) {
  return !!(t && tupleid(t));
}

/**
 * Returns the id of a tuple.
 * @param {object} t - The input tuple.
 * @return {*} the tuple id.
 */
export function tupleid(t) {
  return t[TUPLE_ID_KEY];
}

/**
 * Sets the id of a tuple.
 * @param {object} t - The input tuple.
 * @param {*} id - The id value to set.
 * @return {object} the input tuple.
 */
function setid(t, id) {
  t[TUPLE_ID_KEY] = id;
  return t;
}

/**
 * Ingest an object or value as a data tuple.
 * If the input value is an object, an id field will be added to it. For
 * efficiency, the input object is modified directly. A copy is not made.
 * If the input value is a literal, it will be wrapped in a new object
 * instance, with the value accessible as the 'data' property.
 * @param datum - The value to ingest.
 * @return {object} The ingested data tuple.
 */
export function ingest(datum) {
  var t = (datum === Object(datum)) ? datum : {data: datum};
  return tupleid(t) ? t : setid(t, TUPLE_ID++);
}

/**
 * Given a source tuple, return a derived copy.
 * @param {object} t - The source tuple.
 * @return {object} The derived tuple.
 */
export function derive(t) {
  return rederive(t, ingest({}));
}

/**
 * Rederive a derived tuple by copying values from the source tuple.
 * @param {object} t - The source tuple.
 * @param {object} d - The derived tuple.
 * @return {object} The derived tuple.
 */
export function rederive(t, d) {
  for (var k in t) d[k] = t[k];
  return d;
}

/**
 * Replace an existing tuple with a new tuple.
 * @param {object} t - The existing data tuple.
 * @param {object} d - The new tuple that replaces the old.
 * @return {object} The new tuple.
 */
export function replace(t, d) {
  return setid(d, tupleid(t));
}

/**
 * Generate an augmented comparator function that provides stable
 * sorting by tuple id when the given comparator produces ties.
 * @param {function} cmp - The comparator to augment.
 * @param {function} [f] - Optional tuple accessor function.
 * @return {function} An augmented comparator function.
 */
export function stableCompare(cmp, f) {
  return !cmp ? null
    : f ? (a, b) => cmp(a, b) || (tupleid(f(a)) - tupleid(f(b)))
    : (a, b) => cmp(a, b) || (tupleid(a) - tupleid(b));
}
