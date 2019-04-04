# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [3.2.0] - 2018-12-14
* [New] add `looseClasses` option to compile classes in loose mode (#46)
* [New] infer default value of `jscript` option from explorer target version (#47)

## [3.1.0] - 2018-12-13
* [New] add `jscript` option to disable JScript transformation (#45)

## [3.0.1] - 2018-10-08
* [Fix] the env preset only accepts `false` or a string, not explicit options

## [3.0.0] - 2018-10-08
* [Breaking] update to babel 7 (#37)
* [New] add support to supply the react preset's "development" option

## [2.6.0] - 2018-08-29
* [New] Add `removePropTypes` option (#36)

## [2.5.3] - 2018-07-26
* [Fix] [Deps] add missing `babel-plugin-transform-strict-mode` (#35)

## [2.5.2] - 2018-07-15
* [Fix] add strict mode for real
* [Docs] Update for ES2018

## [2.5.1] - 2018-06-15
* [Fix] partial revert of #31; set strictMode to true

## [2.5.0] - 2018-06-15
* [New] transform ES5 property mutators
* [New/Fix] set "strict" to true (#31)
* [Deps] update `babel-preset-env`, `babel-plugin-transform-object-rest-spread`, `babel-plugin-transform-es2015-modules-commonjs`, `object.assign`

## [2.4.0] - 2017-06-28
* [New] Added an option to toggle debug mode (#18)

## [2.3.3] - 2017-06-20

* Switches from `babel-preset-es2015` to `babel-preset-env`.
  Allows targeting of specific environments.
