export default function isTruthy(obj) {
  if (typeof obj === 'boolean') {
    return obj;
  }
  if (typeof obj === 'string') {
    return ['yes', 'y', 'true', 't', '1'].includes(obj.toLowerCase());
  }

  return !!obj;
}
