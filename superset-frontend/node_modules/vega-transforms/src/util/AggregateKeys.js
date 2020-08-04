export function multikey(f) {
  return function(x) {
    var n = f.length,
        i = 1,
        k = String(f[0](x));

    for (; i<n; ++i) {
      k += '|' + f[i](x);
    }

    return k;
  };
}

export function groupkey(fields) {
  return !fields || !fields.length ? function() { return ''; }
    : fields.length === 1 ? fields[0]
    : multikey(fields);
}
