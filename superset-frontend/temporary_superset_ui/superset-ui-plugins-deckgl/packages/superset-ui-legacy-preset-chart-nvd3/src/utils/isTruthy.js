export default function isTruthy(obj) {
  if (typeof obj === 'boolean') {
    return obj;
  } else if (typeof obj === 'string') {
    return ['yes', 'y', 'true', 't', '1'].indexOf(obj.toLowerCase()) >= 0;
  }

  return !!obj;
}
