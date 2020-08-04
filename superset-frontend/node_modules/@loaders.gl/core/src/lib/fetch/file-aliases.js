// Simple file alias mechanisms for tests.

let pathPrefix = '';
const fileAliases = {};

/*
 * Set a relative path prefix
 */
export function setPathPrefix(prefix) {
  pathPrefix = prefix;
}

export function getPathPrefix() {
  return pathPrefix;
}

// Note: addAliases are not exported at the moment, they are only for loaders.gl testing
export function addAliases(aliases) {
  Object.assign(fileAliases, aliases);
}

export function resolvePath(filename) {
  for (const alias in fileAliases) {
    if (filename.startsWith(alias)) {
      const replacement = fileAliases[alias];
      return filename.replace(alias, replacement);
    }
  }
  filename += pathPrefix;
  return filename;
}
