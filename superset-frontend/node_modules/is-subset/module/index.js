 /**
  * Check if an object is contained within another object.
  *
  * Returns `true` if:
  * - all enumerable keys of *subset* are also enumerable in *superset*, and
  * - every value assigned to an enumerable key of *subset* strictly equals
  *   the value assigned to the same key of *superset* – or is a subset of it.
  *
  * @param  {Object}  superset
  * @param  {Object}  subset
  *
  * @returns  {Boolean}
  *
  * @module    is-subset
  * @function  default
  * @alias     isSubset
  */
const isSubset = (superset, subset) => {
  if (
    (typeof superset !== 'object' || superset === null) ||
    (typeof subset !== 'object' || subset === null)
  ) return false;

  return Object.keys(subset).every((key) => {
    if (!superset.propertyIsEnumerable(key)) return false;

    const subsetItem = subset[key];
    const supersetItem = superset[key];
    if (
      (typeof subsetItem === 'object' && subsetItem !== null) ?
      !isSubset(supersetItem, subsetItem) :
      supersetItem !== subsetItem
    ) return false;

    return true;
  });
};

export {isSubset as default};
