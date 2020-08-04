/** Returns an object's value if defined, or the object. */
export default function valueOrIdentity(_) {
  if (_ && typeof _ === 'object' && 'value' in _ && typeof _.value !== 'undefined') return _.value;
  return _;
}
/** Returns an object's value if defined, or the object, coerced to a string. */

export function valueOrIdentityString(_) {
  return String(valueOrIdentity(_));
}