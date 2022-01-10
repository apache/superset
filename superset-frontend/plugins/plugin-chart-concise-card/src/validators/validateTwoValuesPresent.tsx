export default function (values: unknown) {
  if (Array.isArray(values) && values.length === 2) {
    return false;
  }
  return 'Exactly two columns have to be present';
}
