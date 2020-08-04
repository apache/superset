import Buffer from '../classes/buffer';
import {getKey} from '../webgl-utils';
import {getCompositeGLType} from '../webgl-utils/attribute-utils';
import {formatValue} from '../utils';

// Creates object suitable as input for console.table
export function getDebugTableForVertexArray({vertexArray, header = 'Attributes'} = {}) {
  if (!vertexArray.configuration) {
    return {};
  }

  const table = {}; // {[header]: {}};

  // Add index (elements) if available
  if (vertexArray.elements) {
    // const elements = Object.assign({size: 1}, vertexArray.elements);
    table.ELEMENT_ARRAY_BUFFER = getDebugTableRow(vertexArray, vertexArray.elements, null, header);
  }

  // Add used attributes
  const attributes = vertexArray.values;

  for (const attributeLocation in attributes) {
    const info = vertexArray._getAttributeInfo(attributeLocation);
    if (info) {
      let rowHeader = `${attributeLocation}: ${info.name}`;
      const accessor = vertexArray.accessors[info.location];
      if (accessor) {
        rowHeader = `${attributeLocation}: ${getGLSLDeclaration(info.name, accessor)}`;
      }
      table[rowHeader] = getDebugTableRow(
        vertexArray,
        attributes[attributeLocation],
        accessor,
        header
      );
    }
  }

  return table;
}

/* eslint-disable max-statements */
function getDebugTableRow(vertexArray, attribute, accessor, header) {
  const {gl} = vertexArray;

  if (!attribute) {
    return {
      [header]: 'null',
      'Format ': 'N/A'
    };
  }

  let type = 'NOT PROVIDED';
  let size = 'N/A';
  let verts = 'N/A';
  let bytes = 'N/A';

  let isInteger;
  let marker;
  let value;

  if (accessor) {
    type = accessor.type;
    size = accessor.size;

    // Generate a type name by dropping Array from Float32Array etc.
    type = String(type).replace('Array', '');

    // Look for 'nt' to detect integer types, e.g. Int32Array, Uint32Array
    isInteger = type.indexOf('nt') !== -1;
  }

  if (attribute instanceof Buffer) {
    const buffer = attribute;

    const {data, modified} = buffer.getDebugData();
    marker = modified ? '*' : '';

    value = data;
    bytes = buffer.byteLength;
    verts = bytes / data.BYTES_PER_ELEMENT / size;

    let format;

    if (accessor) {
      const instanced = accessor.divisor > 0;
      format = `${instanced ? 'I ' : 'P '} ${verts} (x${size}=${bytes} bytes ${getKey(gl, type)})`;
    } else {
      // element buffer
      isInteger = true;
      format = `${bytes} bytes`;
    }

    return {
      [header]: `${marker}${formatValue(value, {size, isInteger})}`,
      'Format ': format
    };
  }

  // CONSTANT VALUE
  value = attribute;
  size = attribute.length;
  // Generate a type name by dropping Array from Float32Array etc.
  type = String(attribute.constructor.name).replace('Array', '');
  // Look for 'nt' to detect integer types, e.g. Int32Array, Uint32Array
  isInteger = type.indexOf('nt') !== -1;

  return {
    [header]: `${formatValue(value, {size, isInteger})} (constant)`,
    'Format ': `${size}x${type} (constant)`
  };
}
/* eslint-ensable max-statements */

function getGLSLDeclaration(name, accessor) {
  const {type, size} = accessor;
  const typeAndName = getCompositeGLType(type, size);
  return typeAndName ? `${name} (${typeAndName.name})` : name;
}
