import _ from 'lodash';

const MULTI_MODULE_REGEXP = /^multi /u;

export function getModulePathParts(moduleData) {
  if (MULTI_MODULE_REGEXP.test(moduleData.identifier)) {
    return [moduleData.identifier];
  }

  const parsedPath = _
  // Removing loaders from module path: they're joined by `!` and the last part is a raw module path
    .last(moduleData.name.split('!'))
    // Splitting module path into parts
    .split('/')
    // Removing first `.`
    .slice(1)
    // Replacing `~` with `node_modules`
    .map(part => (part === '~' ? 'node_modules' : part));

  return parsedPath.length ? parsedPath : null;
}
