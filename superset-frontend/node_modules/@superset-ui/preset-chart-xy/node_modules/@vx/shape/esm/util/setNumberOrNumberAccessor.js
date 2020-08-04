/**
 * This is a workaround for TypeScript not inferring the correct
 * method overload/signature for some d3 shape methods.
 */
export default function setNumberOrNumberAccessor(func, value) {
  if (typeof value === 'number') func(value);else func(value);
}