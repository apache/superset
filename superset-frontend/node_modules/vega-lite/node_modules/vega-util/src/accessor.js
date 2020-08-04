export default function(fn, fields, name) {
  fn.fields = fields || [];
  fn.fname = name;
  return fn;
}

export function accessorName(fn) {
  return fn == null ? null : fn.fname;
}

export function accessorFields(fn) {
  return fn == null ? null : fn.fields;
}
