export default function _classPrivateFieldSet(receiver, privateMap, value) {
  if (!privateMap.has(receiver)) {
    throw new TypeError("attempted to set private field on non-instance");
  }

  var descriptor = privateMap.get(receiver);

  if (!descriptor.writable) {
    throw new TypeError("attempted to set read only private field");
  }

  descriptor.value = value;
  return value;
}