# [1.5.2](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.5.2)

- fix: no longer attempts to merge React elements [#76](https://github.com/KyleAMathews/deepmerge/issues/76)

# [1.5.1](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.5.1)

- bower support: officially dropping bower support.  If you use bower, please depend on the [unpkg distribution](https://unpkg.com/deepmerge/dist/umd.js).  See [#63](https://github.com/KyleAMathews/deepmerge/issues/63)

# [1.5.0](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.5.0)

- bug fix: merging objects into arrays was allowed, and doesn't make any sense. [#65](https://github.com/KyleAMathews/deepmerge/issues/65) published as a feature release instead of a patch because it is a decent behavior change.

# [1.4.4](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.4.4)

- bower support: updated `main` in bower.json

# [1.4.3](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.4.3)

- bower support: inline is-mergeable-object in a new CommonJS build, so that people using both bower and CommonJS can bundle the library [0b34e6](https://github.com/KyleAMathews/deepmerge/commit/0b34e6e95f989f2fc8091d25f0d291c08f3d2d24)

# [1.4.2](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.4.2)

- performance: bump is-mergeable-object dependency version for a slight performance improvement [5906c7](https://github.com/KyleAMathews/deepmerge/commit/5906c765d691d48e83d76efbb0d4b9ca150dc12c)

# [1.4.1](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.4.1)

- documentation: fix unpkg link [acc45b](https://github.com/KyleAMathews/deepmerge/commit/acc45be85519c1df906a72ecb24764b622d18d47)

# [1.4.0](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.4.0)

- api: instead of only exporting a UMD module, expose a UMD module with `pkg.main`, a CJS module with `pkg.browser`, and an ES module with `pkg.module` [#62](https://github.com/KyleAMathews/deepmerge/pull/62)

# [1.3.2](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.3.2)

- documentation: note the minified/gzipped file sizes [56](https://github.com/KyleAMathews/deepmerge/pull/56)
- documentation: make data structures more readable in merge example: pull request [57](https://github.com/KyleAMathews/deepmerge/pull/57)

# [1.3.1](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.3.1)

- documentation: clarify and test some array merging documentation: pull request [51](https://github.com/KyleAMathews/deepmerge/pull/51)

# [1.3.0](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.3.0)

- feature: `merge.all`, a merge function that merges any number of objects: pull request [50](https://github.com/KyleAMathews/deepmerge/pull/50)

# [1.2.0](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.2.0)

- fix: an error that would be thrown when an array would be merged onto a truthy non-array value: pull request [46](https://github.com/KyleAMathews/deepmerge/pull/46)
- feature: the ability to clone: Issue [28](https://github.com/KyleAMathews/deepmerge/issues/28), pull requests [44](https://github.com/KyleAMathews/deepmerge/pull/44) and [48](https://github.com/KyleAMathews/deepmerge/pull/48)
- maintenance: added tests + travis to `.npmignore`: pull request [47](https://github.com/KyleAMathews/deepmerge/pull/47)

# [1.1.1](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.1.1)

- fix an issue where an error was thrown when merging an array onto a non-array: [Pull request 46](https://github.com/KyleAMathews/deepmerge/pull/46)

# [1.1.0](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.1.0)

- allow consumers to specify their own array merging algorithm: [Pull request 37](https://github.com/KyleAMathews/deepmerge/pull/37)

# [1.0.3](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.0.3)

- adding bower.json back: [Issue 38](https://github.com/KyleAMathews/deepmerge/pull/38)
- updating keywords and Github links in package.json [bc3898e](https://github.com/KyleAMathews/deepmerge/commit/bc3898e587a56f74591328f40f656b0152c1d5eb)

# [1.0.2](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.0.2)

- Updating the readme: dropping bower, testing that the example works: [7102fc](https://github.com/KyleAMathews/deepmerge/commit/7102fcc4ddec11e2d33205866f9f18df14e5aeb5)

# [1.0.1](https://github.com/KyleAMathews/deepmerge/releases/tag/v1.0.1)

- `null`, dates, and regular expressions are now properly merged in arrays: [Issue 18](https://github.com/KyleAMathews/deepmerge/pull/18), plus commit: [ef1c6b](https://github.com/KyleAMathews/deepmerge/commit/ef1c6bac8350ba12a24966f0bc7da02560827586)

# 1.0.0

- Should only be a patch change, because this module is READY. [Issue 15](https://github.com/KyleAMathews/deepmerge/issues/15)
- Regular expressions are now treated like primitive values when merging: [Issue 30](https://github.com/KyleAMathews/deepmerge/pull/30)
- Dates are now treated like primitives when merging: [Issue 31](https://github.com/KyleAMathews/deepmerge/issues/31)
