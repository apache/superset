import {identity, toBoolean, toDate, toNumber, toString} from 'vega-util';

export var typeParsers = {
  boolean: toBoolean,
  integer: toNumber,
  number:  toNumber,
  date:    toDate,
  string:  toString,
  unknown: identity
};

var typeTests = [
  isBoolean,
  isInteger,
  isNumber,
  isDate
];

var typeList = [
  'boolean',
  'integer',
  'number',
  'date'
];

export function inferType(values, field) {
  if (!values || !values.length) return 'unknown';

  const n = values.length,
        m = typeTests.length,
        a = typeTests.map((_, i) => i + 1);

  for (let i = 0, t = 0, j, value; i < n; ++i) {
    value = field ? values[i][field] : values[i];
    for (j = 0; j < m; ++j) {
      if (a[j] && isValid(value) && !typeTests[j](value)) {
        a[j] = 0;
        ++t;
        if (t === typeTests.length) return 'string';
      }
    }
  }

  return typeList[
    a.reduce((u, v) => u === 0 ? v : u, 0) - 1
  ];
}

export function inferTypes(data, fields) {
  return fields.reduce(function(types, field) {
    types[field] = inferType(data, field);
    return types;
  }, {});
}

// -- Type Checks ----

function isValid(_) {
  return _ != null && _ === _;
}

function isBoolean(_) {
  return _ === 'true' || _ === 'false' || _ === true || _ === false;
}

function isDate(_) {
  return !Number.isNaN(Date.parse(_));
}

function isNumber(_) {
  return !Number.isNaN(+_) && !(_ instanceof Date);
}

function isInteger(_) {
  return isNumber(_) && Number.isInteger(+_);
}
