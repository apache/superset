// returns GLSL shader version of given shader string
export default function getShaderVersion(source) {
  let version = 100;
  const words = source.match(/[^\s]+/g);
  if (words.length >= 2 && words[0] === '#version') {
    const v = parseInt(words[1], 10);
    if (Number.isFinite(v)) {
      version = v;
    }
  }
  return version;
}
