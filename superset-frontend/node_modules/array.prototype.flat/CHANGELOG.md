1.2.1 / 2018-02-23
=================
  * [Fix] Temporarily hack main entry, so it's compatible with other resolvers (#3)
  * [Dev Deps] update `eslint`, `nsp`, `tape`
  * [Tests] up to `node` `v9.6`, `v6.13`

1.2.0 / 2018-01-18
=================
  * [New] add "auto" entry point
  * [Fix] Move the receiver length check higher
  * [Fix] spec adjustments
  * [Refactor] adjust shouldFlatten logic
  * [Dev Deps] update `eslint`
  * [Tests] up to `node` `v9.4`

1.1.1 / 2017-11-29
=================
  * [Fix] avoid an extra hole in the array (https://github.com/es-shims/Array.prototype.flatMap/issues/1)
  * [Deps] update `es-abstract`
  * [Dev Deps] update `eslint`, `nsp`
  * [Tests] up to `node` `v9.2`, `v8.9`, `v6.12`; pin included builds to LTS.

1.1.0 / 2017-10-03
=================
  * [New] add explicit setting of “length” on target array
  * [Fix] `FlattenIntoArray`: add assertion that `thisArg` and `mapperFunction` are both passed together
  * [Tests] make coverage required

1.0.1 / 2017-10-02
=================
  * Add readme

1.0.0 / 2017-10-01
=================
  * Initial release
