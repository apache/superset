// Accept JSON strings by parsing them
// Returns a fresh object that can be modified.
// TODO - use a parser that provides meaninful error messages
export default function parseJSON(json) {
  return typeof json === 'string' ? JSON.parse(json) : Object.assign({}, json);
}
