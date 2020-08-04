# static-eval Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## 2.1.0
* Add `allowAccessToMethodsOnFunctions` option to restore 1.x behaviour so that [cwise](https://github.com/scijs/cwise) can upgrade. ([@archmoj](https://github.com/archmoj) in [#31](https://github.com/browserify/static-eval/pull/31))

  Do not use this option if you are not sure that you need it, as it had previously been removed for security reasons. There is a known exploit to execute arbitrary code. Only use it on trusted inputs, like the developer's JS files in a build system.

## 2.0.5
* Fix function bodies being invoked during declaration. ([@RoboPhred](https://github.com/RoboPhred) in [#30](https://github.com/browserify/static-eval/pull/30))

## 2.0.4
* Short-circuit evaluation in `&&` and `||` expressions. ([@RoboPhred](https://github.com/RoboPhred) in [#28](https://github.com/browserify/static-eval/pull/28))
* Start tracking changes.
