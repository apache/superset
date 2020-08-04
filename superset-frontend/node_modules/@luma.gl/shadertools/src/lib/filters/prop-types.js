const TYPE_DEFINITIONS = {
  number: {
    validate(value, propType) {
      return (
        Number.isFinite(value) &&
        (!('max' in propType) || value <= propType.max) &&
        (!('min' in propType) || value >= propType.min)
      );
    }
  },
  array: {
    validate(value, propType) {
      return Array.isArray(value) || ArrayBuffer.isView(value);
    }
  }
};

export function parsePropTypes(propDefs) {
  const propTypes = {};
  for (const propName in propDefs) {
    const propDef = propDefs[propName];
    const propType = parsePropType(propDef);
    propTypes[propName] = propType;
  }
  return propTypes;
}

// Parses one property definition entry. Either contains:
// * a valid prop type object ({type, ...})
// * or just a default value, in which case type and name inference is used
function parsePropType(propDef) {
  let type = getTypeOf(propDef);
  if (type === 'object') {
    if (!propDef) {
      return {type: 'object', value: null};
    }
    if ('type' in propDef) {
      return Object.assign({}, propDef, TYPE_DEFINITIONS[propDef.type]);
    }
    if (!('value' in propDef)) {
      // If no type and value this object is likely the value
      return {type: 'object', value: propDef};
    }
    type = getTypeOf(propDef.value);
    return Object.assign({type}, propDef, TYPE_DEFINITIONS[type]);
  }
  return Object.assign({type, value: propDef}, TYPE_DEFINITIONS[type]);
}

// improved version of javascript typeof that can distinguish arrays and null values
function getTypeOf(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return 'array';
  }
  return typeof value;
}
