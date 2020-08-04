const GL_FRAGMENT_SHADER = 0x8b30;
const GL_VERTEX_SHADER = 0x8b31;

export default function getShaderTypeName(type) {
  switch (type) {
    case GL_FRAGMENT_SHADER:
      return 'fragment';
    case GL_VERTEX_SHADER:
      return 'vertex';
    default:
      return 'unknown type';
  }
}
