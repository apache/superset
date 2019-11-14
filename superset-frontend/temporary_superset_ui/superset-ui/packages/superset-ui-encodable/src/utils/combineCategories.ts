/**
 * Combine two arrays into a unique list
 * by keeping the order the fixedCategories
 * and append new categories at the end.
 * @param fixedCategories
 * @param inputCategories
 */
export default function combineCategories<T>(fixedCategories: T[], inputCategories: T[] = []) {
  if (fixedCategories.length === 0) {
    return inputCategories;
  }

  const fixedSet = new Set(fixedCategories);

  return fixedCategories.concat(inputCategories.filter(d => !fixedSet.has(d)));
}
