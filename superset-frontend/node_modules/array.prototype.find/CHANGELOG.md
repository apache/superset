# 2.1.0
 - [New] add `auto` entry point
 - [Performance] Remove unnecessary `ToInteger` call.
 - [Performance] inline `ES.Call` since `IsCallable` is already checked prior to the loop.
 - [Performance] avoid checking `arguments` indexes beyond `arguments.length`
 - [meta] Add LICENSE file (#25)
 - [Deps] update `define-properties`, `es-abstract`
 - [Dev Deps] update `eslint`, `@ljharb/eslint-config`, `chai`, `mocha`
 - [Tests] fix matrix; use `nvm install-latest-npm`, test up to latest node
 - [Tests] add `npm run posttest`

# 2.0.4
 - [Performance] the entry point should use the native function when compliant

# 2.0.3
 - [Fix] again: don’t needlessly shim `Array#find` (#22)

# 2.0.2
 - [Fix] don’t needlessly shim `Array#find` (#22)
 - [Deps] update `es-abstract`
 - [Dev Deps] update `@es-shims/api`, `mocha`, `eslint`, `@ljharb/eslint-config`
 - [Tests] up to `node` `v7.4`, `v4.7`; improve test matrix

# 2.0.1
 - [Fix] use call instead of apply in bound entry point function (#20)
 - [Tests] up to `node` `v7.0`, `v6.9`, `v5.12`; improve test matrix
 - [Tests] add `npm run lint`

# 2.0.0
 - [Breaking] implement es-shim API (#15)
 - [Fix] use ToLength, not ToUint32 (#15)
 - [Fix] Uncallable predicates must throw even when the array is empty (#15)
 - [Docs] fix browserify example (#12)

# 1.0.0
 - [Breaking] do not skip holes (per ES6 change) (#6)
 - [Dev Deps] update `mocha`
 - [Fix] Older browsers report the typeof some host objects and regexes as "function" (#8)

# 0.2.0
 - [Tests] Add travis support (#5)
 - [Tests] Add tests (#5)
 - [Fix] Fix failing test: 'should work with an array-like object with negative length' (#5)

# 0.1.1
 - [Fix] check if `Array#find` already exists (#4)

# 0.1.0
 - Initial release
