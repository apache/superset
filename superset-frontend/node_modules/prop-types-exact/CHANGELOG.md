1.2.0 / 2018-06-14
==================
  * [New] add `sloppy` import, for removing the "exact"ness on a propTypes object
  * [Deps] update `has`
  * [Dev Deps] update `babel-plugin-istanbul`, `babel-plugin-transform-replace-object-assign`, `eslint`, `eslint-plugin-import`, `eslint-plugin-react`, `nyc`, `prop-types`
  * [Tests] on `node` `v10`
  * [Tests] switch from mocha to tape, since mocha drops support for older nodes
  * [Tests] on react 16
  * [Tests] fix test scripts

1.1.2 / 2018-01-17
==================
  * [Fix] replace the object semaphore with a global Symbol/string
  * [Deps] update `object.assign`
  * [Dev Deps] update `babel-cli`, `babel-plugin-istanbul`, `babel-preset-airbnb`, `chai`, `eslint`, `eslint-config-airbnb`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `mocha`, `nyc`, `prop-types`, `rimraf`; downgrade mocha to v3
  * [Tests] on `node` `v9`; use `nvm install-latest-npm`

1.1.1 / 2017-07-06
==================
  * [Fix] no longer use a Symbol; React doesn’t check those (#3)
  * [Tests] fix tests to fail properly (#3)

1.1.0 / 2017-06-05
==================
  * [New] use a Symbol instead of a zero-width space when supported (#2)
  * [Fix] correct the error message when a conflict is found
  * [Dev Deps] update `chai`
  * [Tests] [Refactor] dynamically determine the special property instead of hardcoding the zero width space.
  * [Tests] ignore istanbul output
  * [Tests] nyc include all files

1.0.0 / 2017-06-04
==================
  * Initial release.
