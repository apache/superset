import GL from '@luma.gl/constants';
import {Buffer} from '@luma.gl/webgl';
import {assert} from '../utils';

// Support for mapping new geometries with glTF attribute names to "classic" luma.gl shader names
const GLTF_TO_LUMA_ATTRIBUTE_MAP = {
  POSITION: 'positions',
  NORMAL: 'normals',
  COLOR_0: 'colors',
  TEXCOORD_0: 'texCoords',
  TEXCOORD_1: 'texCoords1',
  TEXCOORD_2: 'texCoords2'
};

export function getBuffersFromGeometry(gl, geometry, options) {
  const buffers = {};
  let indices = geometry.indices;

  for (const name in geometry.attributes) {
    const attribute = geometry.attributes[name];
    const remappedName = mapAttributeName(name, options);

    if (name === 'indices') {
      indices = attribute;
    } else if (attribute.constant) {
      buffers[remappedName] = attribute.value;
    } else {
      const typedArray = attribute.value;
      // Create accessor by copying the attribute and removing `value``
      const accessor = {...attribute};
      delete accessor.value;
      buffers[remappedName] = [new Buffer(gl, typedArray), accessor];

      inferAttributeAccessor(name, accessor);
    }
  }

  if (indices) {
    const data = indices.value || indices;
    assert(
      data instanceof Uint16Array || data instanceof Uint32Array,
      'attribute array for "indices" must be of integer type'
    );
    const accessor = {
      size: 1,
      isIndexed: indices.isIndexed === undefined ? true : indices.isIndexed
    };
    buffers.indices = [
      new Buffer(gl, {
        data,
        target: GL.ELEMENT_ARRAY_BUFFER
      }),
      accessor
    ];
  }

  return buffers;
}

function mapAttributeName(name, options) {
  const {attributeMap = GLTF_TO_LUMA_ATTRIBUTE_MAP} = options || {};
  return (attributeMap && attributeMap[name]) || name;
}

// Check for well known attribute names
// eslint-disable-next-line complexity
export function inferAttributeAccessor(attributeName, attribute) {
  let category;
  switch (attributeName) {
    case 'texCoords':
    case 'texCoord1':
    case 'texCoord2':
    case 'texCoord3':
      category = 'uvs';
      break;
    case 'vertices':
    case 'positions':
    case 'normals':
    case 'pickingColors':
      category = 'vectors';
      break;
    default:
  }

  // Check for categorys
  switch (category) {
    case 'vectors':
      attribute.size = attribute.size || 3;
      break;
    case 'uvs':
      attribute.size = attribute.size || 2;
      break;
    default:
  }

  assert(Number.isFinite(attribute.size), `attribute ${attributeName} needs size`);
}
