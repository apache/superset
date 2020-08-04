const lrCache = {}
const lazyRequire = (path, subkey) => {
  const module = lrCache[path] || (lrCache[path] = require(path))
  return subkey ? module[subkey] : module
}

const lazyExport = (key, path, subkey) => {
  Object.defineProperty(exports, key, {
    get: () => {
      const res = lazyRequire(path, subkey)
      Object.defineProperty(exports, key, {
        value: res,
        enumerable: true,
        configurable: true
      })
      return res
    },
    configurable: true,
    enumerable: true
  })
}

lazyExport('re', './internal/re', 're')
lazyExport('src', './internal/re', 'src')
lazyExport('tokens', './internal/re', 't')
lazyExport('SEMVER_SPEC_VERSION', './internal/constants', 'SEMVER_SPEC_VERSION')
lazyExport('SemVer', './classes/semver')
lazyExport('compareIdentifiers', './internal/identifiers', 'compareIdentifiers')
lazyExport('rcompareIdentifiers', './internal/identifiers', 'rcompareIdentifiers')
lazyExport('parse', './functions/parse')
lazyExport('valid', './functions/valid')
lazyExport('clean', './functions/clean')
lazyExport('inc', './functions/inc')
lazyExport('diff', './functions/diff')
lazyExport('major', './functions/major')
lazyExport('minor', './functions/minor')
lazyExport('patch', './functions/patch')
lazyExport('prerelease', './functions/prerelease')
lazyExport('compare', './functions/compare')
lazyExport('rcompare', './functions/rcompare')
lazyExport('compareLoose', './functions/compare-loose')
lazyExport('compareBuild', './functions/compare-build')
lazyExport('sort', './functions/sort')
lazyExport('rsort', './functions/rsort')
lazyExport('gt', './functions/gt')
lazyExport('lt', './functions/lt')
lazyExport('eq', './functions/eq')
lazyExport('neq', './functions/neq')
lazyExport('gte', './functions/gte')
lazyExport('lte', './functions/lte')
lazyExport('cmp', './functions/cmp')
lazyExport('coerce', './functions/coerce')
lazyExport('Comparator', './classes/comparator')
lazyExport('Range', './classes/range')
lazyExport('satisfies', './functions/satisfies')
lazyExport('toComparators', './ranges/to-comparators')
lazyExport('maxSatisfying', './ranges/max-satisfying')
lazyExport('minSatisfying', './ranges/min-satisfying')
lazyExport('minVersion', './ranges/min-version')
lazyExport('validRange', './ranges/valid')
lazyExport('outside', './ranges/outside')
lazyExport('gtr', './ranges/gtr')
lazyExport('ltr', './ranges/ltr')
lazyExport('intersects', './ranges/intersects')
