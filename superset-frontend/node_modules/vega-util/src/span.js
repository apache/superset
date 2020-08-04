import peek from './peek';

/**
 * Return the numerical span of an array: the difference between
 * the last and first values.
 */
export default function(array) {
  return array && (peek(array) - array[0]) || 0;
}
