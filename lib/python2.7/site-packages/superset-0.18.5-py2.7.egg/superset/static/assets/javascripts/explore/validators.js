/* Reusable validator functions used in controls definitions
 *
 * validator functions receive the v and the configuration of the control
 * as arguments and return something that evals to false if v is valid,
 * and an error message if not valid.
 * */

export function numeric(v) {
  if (v && isNaN(v)) {
    return 'is expected to be a number';
  }
  return false;
}

export function integer(v) {
  if (v && (isNaN(v) || parseInt(v, 10) !== +(v))) {
    return 'is expected to be an integer';
  }
  return false;
}

export function nonEmpty(v) {
  if (
      v === null ||
      v === undefined ||
      v === '' ||
      (Array.isArray(v) && v.length === 0)
  ) {
    return 'cannot be empty';
  }
  return false;
}
