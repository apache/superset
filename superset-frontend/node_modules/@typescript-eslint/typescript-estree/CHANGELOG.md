# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.20.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.19.2...v2.20.0) (2020-02-17)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





## [2.19.2](https://github.com/typescript-eslint/typescript-eslint/compare/v2.19.1...v2.19.2) (2020-02-10)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





## [2.19.1](https://github.com/typescript-eslint/typescript-eslint/compare/v2.19.0...v2.19.1) (2020-02-10)


### Bug Fixes

* **typescript-estree:** ts returning wrong file with project references ([#1575](https://github.com/typescript-eslint/typescript-eslint/issues/1575)) ([4c12dac](https://github.com/typescript-eslint/typescript-eslint/commit/4c12dac075f774801a145cd29c4c7eff64f98fdc))





# [2.19.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.18.0...v2.19.0) (2020-02-03)


### Bug Fixes

* **typescript-estree:** fix regression introduced in [#1525](https://github.com/typescript-eslint/typescript-eslint/issues/1525) ([#1543](https://github.com/typescript-eslint/typescript-eslint/issues/1543)) ([bec4572](https://github.com/typescript-eslint/typescript-eslint/commit/bec45722dfed8aeb49189d151252b83d4a34239c))
* **typescript-estree:** persisted parse and module none ([#1516](https://github.com/typescript-eslint/typescript-eslint/issues/1516)) ([7c70323](https://github.com/typescript-eslint/typescript-eslint/commit/7c7032322f55d9492e21d3bfa5da16da1f05cbce))





# [2.18.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.17.0...v2.18.0) (2020-01-27)


### Bug Fixes

* improve token types and add missing type guards ([#1497](https://github.com/typescript-eslint/typescript-eslint/issues/1497)) ([ce41d7d](https://github.com/typescript-eslint/typescript-eslint/commit/ce41d7de33bcb7ccf96c03ac1438304c5a49ff54))
* **typescript-estree:** error on unexpected jsdoc nodes ([#1525](https://github.com/typescript-eslint/typescript-eslint/issues/1525)) ([c8dfac3](https://github.com/typescript-eslint/typescript-eslint/commit/c8dfac3d2f066e50fa9d2b5a86beffdaafddb643))
* **typescript-estree:** fix identifier tokens typed as `Keyword` ([#1487](https://github.com/typescript-eslint/typescript-eslint/issues/1487)) ([77a1caa](https://github.com/typescript-eslint/typescript-eslint/commit/77a1caa562638645b4717449800e410107d512c8))


### Features

* **eslint-plugin:** add new rule prefer-as-const ([#1431](https://github.com/typescript-eslint/typescript-eslint/issues/1431)) ([420db96](https://github.com/typescript-eslint/typescript-eslint/commit/420db96921435e8bf7fb484ae74552a912a6adde))





# [2.17.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.16.0...v2.17.0) (2020-01-20)


### Bug Fixes

* **typescript-estree:** correct type of `ArrayPattern.elements` ([#1451](https://github.com/typescript-eslint/typescript-eslint/issues/1451)) ([62e4ca0](https://github.com/typescript-eslint/typescript-eslint/commit/62e4ca0))





# [2.16.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.15.0...v2.16.0) (2020-01-13)


### Bug Fixes

* **typescript-estree:** fix persisted parse for relative paths ([#1424](https://github.com/typescript-eslint/typescript-eslint/issues/1424)) ([9720d2c](https://github.com/typescript-eslint/typescript-eslint/commit/9720d2c))
* **typescript-estree:** parsing of deeply nested new files in new folder ([#1412](https://github.com/typescript-eslint/typescript-eslint/issues/1412)) ([206c94b](https://github.com/typescript-eslint/typescript-eslint/commit/206c94b))
* **typescript-estree:** resolve path relative to tsconfigRootDir ([#1439](https://github.com/typescript-eslint/typescript-eslint/issues/1439)) ([c709056](https://github.com/typescript-eslint/typescript-eslint/commit/c709056))


### Features

* **typescript-estree:** add parserOption to turn on debug logs ([#1413](https://github.com/typescript-eslint/typescript-eslint/issues/1413)) ([25092fd](https://github.com/typescript-eslint/typescript-eslint/commit/25092fd))
* **typescript-estree:** add strict type mapping to esTreeNodeToTSNodeMap ([#1382](https://github.com/typescript-eslint/typescript-eslint/issues/1382)) ([d3d70a3](https://github.com/typescript-eslint/typescript-eslint/commit/d3d70a3))





# [2.15.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.14.0...v2.15.0) (2020-01-06)


### Bug Fixes

* **typescript-estree:** correct persisted parse for windows ([#1406](https://github.com/typescript-eslint/typescript-eslint/issues/1406)) ([1a42f3d](https://github.com/typescript-eslint/typescript-eslint/commit/1a42f3d))





# [2.14.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.13.0...v2.14.0) (2019-12-30)


### Bug Fixes

* **typescript-estree:** visit typeParameters in OptionalCallExpr ([#1377](https://github.com/typescript-eslint/typescript-eslint/issues/1377)) ([cba6a2a](https://github.com/typescript-eslint/typescript-eslint/commit/cba6a2a))


### Features

* add internal eslint plugin for repo-specific lint rules ([#1373](https://github.com/typescript-eslint/typescript-eslint/issues/1373)) ([3a15413](https://github.com/typescript-eslint/typescript-eslint/commit/3a15413))





# [2.13.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.12.0...v2.13.0) (2019-12-23)


### Bug Fixes

* **typescript-estree:** correct type of key for base nodes ([#1367](https://github.com/typescript-eslint/typescript-eslint/issues/1367)) ([099225a](https://github.com/typescript-eslint/typescript-eslint/commit/099225a))


### Features

* **typescript-estree:** computed members discriminated unions ([#1349](https://github.com/typescript-eslint/typescript-eslint/issues/1349)) ([013df9a](https://github.com/typescript-eslint/typescript-eslint/commit/013df9a))
* **typescript-estree:** tighten prop name and destructure types ([#1346](https://github.com/typescript-eslint/typescript-eslint/issues/1346)) ([f335c50](https://github.com/typescript-eslint/typescript-eslint/commit/f335c50))





# [2.12.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.11.0...v2.12.0) (2019-12-16)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





# [2.11.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.10.0...v2.11.0) (2019-12-09)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





# [2.10.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.9.0...v2.10.0) (2019-12-02)


### Bug Fixes

* **eslint-plugin:** [no-unused-expressions] ignore directives ([#1285](https://github.com/typescript-eslint/typescript-eslint/issues/1285)) ([ce4c803](https://github.com/typescript-eslint/typescript-eslint/commit/ce4c803))
* **typescript-estree:** make FunctionDeclaration.body non-null ([#1288](https://github.com/typescript-eslint/typescript-eslint/issues/1288)) ([dc73510](https://github.com/typescript-eslint/typescript-eslint/commit/dc73510))





# [2.9.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.8.0...v2.9.0) (2019-11-25)


### Bug Fixes

* **typescript-estree:** fix synthetic default import ([#1245](https://github.com/typescript-eslint/typescript-eslint/issues/1245)) ([d97f809](https://github.com/typescript-eslint/typescript-eslint/commit/d97f809))


### Features

* **eslint-plugin:** add no-unused-vars-experimental ([#688](https://github.com/typescript-eslint/typescript-eslint/issues/688)) ([05ebea5](https://github.com/typescript-eslint/typescript-eslint/commit/05ebea5))





# [2.8.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.7.0...v2.8.0) (2019-11-18)


### Bug Fixes

* **eslint-plugin:** [unified-signatures] crash: cannot read pro… ([#1096](https://github.com/typescript-eslint/typescript-eslint/issues/1096)) ([d1de3a7](https://github.com/typescript-eslint/typescript-eslint/commit/d1de3a7))
* **typescript-estree:** correctly account for trailing slash in… ([#1205](https://github.com/typescript-eslint/typescript-eslint/issues/1205)) ([ba89168](https://github.com/typescript-eslint/typescript-eslint/commit/ba89168))
* **typescript-estree:** options range loc being always true ([#704](https://github.com/typescript-eslint/typescript-eslint/issues/704)) ([db1aa18](https://github.com/typescript-eslint/typescript-eslint/commit/db1aa18))





# [2.7.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.6.1...v2.7.0) (2019-11-11)


### Bug Fixes

* **typescript-estree:** hash code to reduce update frequency ([#1179](https://github.com/typescript-eslint/typescript-eslint/issues/1179)) ([96d1cc3](https://github.com/typescript-eslint/typescript-eslint/commit/96d1cc3))
* **typescript-estree:** reduce bundle footprint of tsutils ([#1177](https://github.com/typescript-eslint/typescript-eslint/issues/1177)) ([c8fe515](https://github.com/typescript-eslint/typescript-eslint/commit/c8fe515))





## [2.6.1](https://github.com/typescript-eslint/typescript-eslint/compare/v2.6.0...v2.6.1) (2019-11-04)


### Bug Fixes

* **typescript-estree:** don't use typescript's synthetic default ([#1156](https://github.com/typescript-eslint/typescript-eslint/issues/1156)) ([17c956e](https://github.com/typescript-eslint/typescript-eslint/commit/17c956e)), closes [#1153](https://github.com/typescript-eslint/typescript-eslint/issues/1153)
* **typescript-estree:** fix filename handling for vue JSX + markdown ([#1127](https://github.com/typescript-eslint/typescript-eslint/issues/1127)) ([366518f](https://github.com/typescript-eslint/typescript-eslint/commit/366518f))
* **typescript-estree:** improve comment parsing code ([#1120](https://github.com/typescript-eslint/typescript-eslint/issues/1120)) ([e54998d](https://github.com/typescript-eslint/typescript-eslint/commit/e54998d))





# [2.6.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.5.0...v2.6.0) (2019-10-28)


### Bug Fixes

* **parser:** adds TTY check before logging the version mismatch warning ([#1121](https://github.com/typescript-eslint/typescript-eslint/issues/1121)) ([768ef63](https://github.com/typescript-eslint/typescript-eslint/commit/768ef63))
* **typescript-estree:** better handle canonical paths ([#1111](https://github.com/typescript-eslint/typescript-eslint/issues/1111)) ([8dcbf4c](https://github.com/typescript-eslint/typescript-eslint/commit/8dcbf4c))
* **typescript-estree:** correct parenthesized optional chain AST ([#1141](https://github.com/typescript-eslint/typescript-eslint/issues/1141)) ([5ae286e](https://github.com/typescript-eslint/typescript-eslint/commit/5ae286e))
* **typescript-estree:** ensure parent pointers are set ([#1129](https://github.com/typescript-eslint/typescript-eslint/issues/1129)) ([d4703e1](https://github.com/typescript-eslint/typescript-eslint/commit/d4703e1))
* **typescript-estree:** normalize paths to fix cache miss on windows ([#1128](https://github.com/typescript-eslint/typescript-eslint/issues/1128)) ([6d0f2ce](https://github.com/typescript-eslint/typescript-eslint/commit/6d0f2ce))


### Features

* **typescript-estree:** add support for declare class properties ([#1136](https://github.com/typescript-eslint/typescript-eslint/issues/1136)) ([1508670](https://github.com/typescript-eslint/typescript-eslint/commit/1508670))





# [2.5.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.4.0...v2.5.0) (2019-10-21)


### Bug Fixes

* **typescript-estree:** correct semver check range ([#1109](https://github.com/typescript-eslint/typescript-eslint/issues/1109)) ([2fc9bd2](https://github.com/typescript-eslint/typescript-eslint/commit/2fc9bd2))
* **typescript-estree:** handle running out of fs watchers ([#1088](https://github.com/typescript-eslint/typescript-eslint/issues/1088)) ([ec62747](https://github.com/typescript-eslint/typescript-eslint/commit/ec62747))
* **typescript-estree:** parsing error for vue sfc ([#1083](https://github.com/typescript-eslint/typescript-eslint/issues/1083)) ([7a8cce6](https://github.com/typescript-eslint/typescript-eslint/commit/7a8cce6))
* **typescript-estree:** remove now unneeded dep on chokidar ([088a691](https://github.com/typescript-eslint/typescript-eslint/commit/088a691))


### Features

* **typescript-estree:** support long running lint without watch ([#1106](https://github.com/typescript-eslint/typescript-eslint/issues/1106)) ([ed5564d](https://github.com/typescript-eslint/typescript-eslint/commit/ed5564d))





# [2.4.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.3...v2.4.0) (2019-10-14)


### Bug Fixes

* support long running "watch" lint sessions ([#973](https://github.com/typescript-eslint/typescript-eslint/issues/973)) ([854620e](https://github.com/typescript-eslint/typescript-eslint/commit/854620e))


### Features

* **typescript-estree:** support for parsing 3.7 features ([#1045](https://github.com/typescript-eslint/typescript-eslint/issues/1045)) ([623febf](https://github.com/typescript-eslint/typescript-eslint/commit/623febf))





## [2.3.3](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.2...v2.3.3) (2019-10-07)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





## [2.3.2](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.1...v2.3.2) (2019-09-30)


### Bug Fixes

* **typescript-estree:** correct ClassDeclarationBase type ([#1008](https://github.com/typescript-eslint/typescript-eslint/issues/1008)) ([8ce3a81](https://github.com/typescript-eslint/typescript-eslint/commit/8ce3a81))
* **typescript-estree:** handle optional computed prop w/o type ([#1026](https://github.com/typescript-eslint/typescript-eslint/issues/1026)) ([95c13fe](https://github.com/typescript-eslint/typescript-eslint/commit/95c13fe))





## [2.3.1](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.0...v2.3.1) (2019-09-23)


### Bug Fixes

* **typescript-estree:** parsing error for await in non-async func ([#988](https://github.com/typescript-eslint/typescript-eslint/issues/988)) ([19abbe0](https://github.com/typescript-eslint/typescript-eslint/commit/19abbe0))





# [2.3.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.2.0...v2.3.0) (2019-09-16)


### Bug Fixes

* **typescript-estree:** ImportDeclaration.specifier to Literal ([#974](https://github.com/typescript-eslint/typescript-eslint/issues/974)) ([2bf8231](https://github.com/typescript-eslint/typescript-eslint/commit/2bf8231))





# [2.2.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.1.0...v2.2.0) (2019-09-09)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





# [2.1.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.0.0...v2.1.0) (2019-09-02)


### Bug Fixes

* **eslint-plugin:** [unified-signatures] type comparison and exported nodes ([#839](https://github.com/typescript-eslint/typescript-eslint/issues/839)) ([580eceb](https://github.com/typescript-eslint/typescript-eslint/commit/580eceb))
* **typescript-estree:** improve missing project file error msg ([#866](https://github.com/typescript-eslint/typescript-eslint/issues/866)) ([8f3b0a8](https://github.com/typescript-eslint/typescript-eslint/commit/8f3b0a8)), closes [#853](https://github.com/typescript-eslint/typescript-eslint/issues/853)


### Features

* **eslint-plugin:** [no-type-alias] support tuples ([#775](https://github.com/typescript-eslint/typescript-eslint/issues/775)) ([c68e033](https://github.com/typescript-eslint/typescript-eslint/commit/c68e033))
* **typescript-estree:** Accept a glob pattern for `options.project` ([#806](https://github.com/typescript-eslint/typescript-eslint/issues/806)) ([9e5f21e](https://github.com/typescript-eslint/typescript-eslint/commit/9e5f21e))





# [2.0.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.13.0...v2.0.0) (2019-08-13)


* feat(eslint-plugin)!: change recommended config (#729) ([428567d](https://github.com/typescript-eslint/typescript-eslint/commit/428567d)), closes [#729](https://github.com/typescript-eslint/typescript-eslint/issues/729)
* feat(typescript-estree)!: throw error on file not in project when `project` set (#760) ([3777b77](https://github.com/typescript-eslint/typescript-eslint/commit/3777b77)), closes [#760](https://github.com/typescript-eslint/typescript-eslint/issues/760)
* feat(eslint-plugin)!: add rule `consistent-type-assertions` (#731) ([92e98de](https://github.com/typescript-eslint/typescript-eslint/commit/92e98de)), closes [#731](https://github.com/typescript-eslint/typescript-eslint/issues/731)


### Bug Fixes

* **typescript-estree:** fix `is` token typed as `Keyword ([#750](https://github.com/typescript-eslint/typescript-eslint/issues/750)) ([35dec52](https://github.com/typescript-eslint/typescript-eslint/commit/35dec52))
* **typescript-estree:** jsx comment parsing ([#703](https://github.com/typescript-eslint/typescript-eslint/issues/703)) ([0cfc48e](https://github.com/typescript-eslint/typescript-eslint/commit/0cfc48e))


### Features

* explicitly support eslint v6 ([#645](https://github.com/typescript-eslint/typescript-eslint/issues/645)) ([34a7cf6](https://github.com/typescript-eslint/typescript-eslint/commit/34a7cf6))


### BREAKING CHANGES

* recommended config changes are considered breaking
* by default we will now throw when a file is not in the `project` provided
* Merges both no-angle-bracket-type-assertion and no-object-literal-type-assertion into one rule
* Node 6 is no longer supported





# [1.13.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.12.0...v1.13.0) (2019-07-21)

**Note:** Version bump only for package @typescript-eslint/typescript-estree





# [1.12.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.11.0...v1.12.0) (2019-07-12)


### Bug Fixes

* **eslint-plugin:** handle `const;` ([#633](https://github.com/typescript-eslint/typescript-eslint/issues/633)) ([430d628](https://github.com/typescript-eslint/typescript-eslint/commit/430d628)), closes [#441](https://github.com/typescript-eslint/typescript-eslint/issues/441)
* **typescript-estree:** fix `async` identifier token typed as `Keyword` ([#681](https://github.com/typescript-eslint/typescript-eslint/issues/681)) ([6de19d3](https://github.com/typescript-eslint/typescript-eslint/commit/6de19d3))


### Features

* **eslint-plugin:** added new rule prefer-readonly ([#555](https://github.com/typescript-eslint/typescript-eslint/issues/555)) ([76b89a5](https://github.com/typescript-eslint/typescript-eslint/commit/76b89a5))





# [1.11.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.10.2...v1.11.0) (2019-06-23)


### Bug Fixes

* **typescript-estree:** fix more cases with double slash in JSX text ([#607](https://github.com/typescript-eslint/typescript-eslint/issues/607)) ([34cfa53](https://github.com/typescript-eslint/typescript-eslint/commit/34cfa53))





## [1.10.2](https://github.com/typescript-eslint/typescript-eslint/compare/v1.10.1...v1.10.2) (2019-06-10)

**Note:** Version bump only for package @typescript-eslint/typescript-estree

## [1.10.1](https://github.com/typescript-eslint/typescript-eslint/compare/v1.10.0...v1.10.1) (2019-06-09)

**Note:** Version bump only for package @typescript-eslint/typescript-estree

# [1.10.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.9.0...v1.10.0) (2019-06-09)

### Bug Fixes

- **eslint-plugin:** [explicit-function-return-type] Fix obj setter prop ([8c8497c](https://github.com/typescript-eslint/typescript-eslint/commit/8c8497c)), closes [#525](https://github.com/typescript-eslint/typescript-eslint/issues/525)
- **eslint-plugin:** [no-extra-parens] Fix crash default switch case crash ([5ec2b32](https://github.com/typescript-eslint/typescript-eslint/commit/5ec2b32)), closes [#509](https://github.com/typescript-eslint/typescript-eslint/issues/509)
- **typescript-estree:** allow expressions in ExportDefaultDeclaration ([#593](https://github.com/typescript-eslint/typescript-eslint/issues/593)) ([861844d](https://github.com/typescript-eslint/typescript-eslint/commit/861844d))
- **typescript-estree:** stop ignoring comments in JSX with generic ([#596](https://github.com/typescript-eslint/typescript-eslint/issues/596)) ([31d5bd4](https://github.com/typescript-eslint/typescript-eslint/commit/31d5bd4))

### Features

- make utils/TSESLint export typed classes instead of just types ([#526](https://github.com/typescript-eslint/typescript-eslint/issues/526)) ([370ac72](https://github.com/typescript-eslint/typescript-eslint/commit/370ac72))
- support TypeScript versions >=3.2.1 <3.6.0 ([#597](https://github.com/typescript-eslint/typescript-eslint/issues/597)) ([5d2b962](https://github.com/typescript-eslint/typescript-eslint/commit/5d2b962))

# [1.9.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.8.0...v1.9.0) (2019-05-12)

**Note:** Version bump only for package @typescript-eslint/typescript-estree

# [1.8.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.7.0...v1.8.0) (2019-05-10)

### Bug Fixes

- **eslint-plugin:** [array-type] support readonly operator ([#429](https://github.com/typescript-eslint/typescript-eslint/issues/429)) ([8e2d2f5](https://github.com/typescript-eslint/typescript-eslint/commit/8e2d2f5))
- **eslint-plugin:** Support more nodes [no-extra-parens](<[#465](https://github.com/typescript-eslint/typescript-eslint/issues/465)>) ([2d15644](https://github.com/typescript-eslint/typescript-eslint/commit/2d15644))
- **typescript-estree:** ensure parents are defined during subsequent parses ([#500](https://github.com/typescript-eslint/typescript-eslint/issues/500)) ([665278f](https://github.com/typescript-eslint/typescript-eslint/commit/665278f))

### Features

- **eslint-plugin:** (EXPERIMENTAL) begin indent rewrite ([#439](https://github.com/typescript-eslint/typescript-eslint/issues/439)) ([6eb97d4](https://github.com/typescript-eslint/typescript-eslint/commit/6eb97d4))
- **eslint-plugin:** no-inferrable-types: Support more primitives ([#442](https://github.com/typescript-eslint/typescript-eslint/issues/442)) ([4e193ca](https://github.com/typescript-eslint/typescript-eslint/commit/4e193ca))
- **ts-estree:** add preserveNodeMaps option ([#494](https://github.com/typescript-eslint/typescript-eslint/issues/494)) ([c3061f9](https://github.com/typescript-eslint/typescript-eslint/commit/c3061f9))
- Move shared types into their own package ([#425](https://github.com/typescript-eslint/typescript-eslint/issues/425)) ([a7a03ce](https://github.com/typescript-eslint/typescript-eslint/commit/a7a03ce))

# [1.7.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.6.0...v1.7.0) (2019-04-20)

### Features

- **eslint-plugin:** support type assertions in no-extra-parens rule ([#311](https://github.com/typescript-eslint/typescript-eslint/issues/311)) ([116ca75](https://github.com/typescript-eslint/typescript-eslint/commit/116ca75))

# [1.6.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.5.0...v1.6.0) (2019-04-03)

### Bug Fixes

- **typescript-estree:** add ExportDefaultDeclaration to union DeclarationStatement ([#378](https://github.com/typescript-eslint/typescript-eslint/issues/378)) ([bf04398](https://github.com/typescript-eslint/typescript-eslint/commit/bf04398))

### Features

- change TypeScript version range to >=3.2.1 <3.5.0 ([#399](https://github.com/typescript-eslint/typescript-eslint/issues/399)) ([a4f95d3](https://github.com/typescript-eslint/typescript-eslint/commit/a4f95d3))

# [1.5.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.4.2...v1.5.0) (2019-03-20)

### Bug Fixes

- **eslint-plugin:** fix false positives for adjacent-overload-signatures regarding computed property names ([#340](https://github.com/typescript-eslint/typescript-eslint/issues/340)) ([f6e5118](https://github.com/typescript-eslint/typescript-eslint/commit/f6e5118))
- **typescript-estree:** only call watch callback on new files ([#367](https://github.com/typescript-eslint/typescript-eslint/issues/367)) ([0ef07c4](https://github.com/typescript-eslint/typescript-eslint/commit/0ef07c4))

## [1.4.2](https://github.com/typescript-eslint/typescript-eslint/compare/v1.4.1...v1.4.2) (2019-02-25)

**Note:** Version bump only for package @typescript-eslint/typescript-estree

## [1.4.1](https://github.com/typescript-eslint/typescript-eslint/compare/v1.4.0...v1.4.1) (2019-02-23)

**Note:** Version bump only for package @typescript-eslint/typescript-estree

# [1.4.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.3.0...v1.4.0) (2019-02-19)

### Bug Fixes

- **ts-estree:** make sure that every node can be converted to tsNode ([#287](https://github.com/typescript-eslint/typescript-eslint/issues/287)) ([9f1d314](https://github.com/typescript-eslint/typescript-eslint/commit/9f1d314))
- **typescript-estree, eslint-plugin:** stop adding ParenthesizedExpressions to node maps ([#226](https://github.com/typescript-eslint/typescript-eslint/issues/226)) ([317405a](https://github.com/typescript-eslint/typescript-eslint/commit/317405a))

### Features

- **eslint-plugin:** add 'no-unnecessary-qualifier' rule ([#231](https://github.com/typescript-eslint/typescript-eslint/issues/231)) ([cc8f906](https://github.com/typescript-eslint/typescript-eslint/commit/cc8f906))
- **eslint-plugin:** Migrate plugin to ts ([#120](https://github.com/typescript-eslint/typescript-eslint/issues/120)) ([61c60dc](https://github.com/typescript-eslint/typescript-eslint/commit/61c60dc))
- **ts-estree:** fix parsing nested sequence expressions ([#286](https://github.com/typescript-eslint/typescript-eslint/issues/286)) ([ecc9631](https://github.com/typescript-eslint/typescript-eslint/commit/ecc9631))

# [1.3.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.2.0...v1.3.0) (2019-02-07)

### Bug Fixes

- **ts-estree:** align typeArguments and typeParameters across nodes ([#223](https://github.com/typescript-eslint/typescript-eslint/issues/223)) ([3306198](https://github.com/typescript-eslint/typescript-eslint/commit/3306198))
- **ts-estree:** convert decorators on var and fn decs ([#211](https://github.com/typescript-eslint/typescript-eslint/issues/211)) ([0a1777f](https://github.com/typescript-eslint/typescript-eslint/commit/0a1777f))
- **ts-estree:** fix issues with typeParams in FunctionExpression ([#208](https://github.com/typescript-eslint/typescript-eslint/issues/208)) ([d4dfa3b](https://github.com/typescript-eslint/typescript-eslint/commit/d4dfa3b))

### Features

- change TypeScript version range to >=3.2.1 <3.4.0 ([#184](https://github.com/typescript-eslint/typescript-eslint/issues/184)) ([f513a14](https://github.com/typescript-eslint/typescript-eslint/commit/f513a14))
- **ts-estree:** enable errors 1098 and 1099 ([#219](https://github.com/typescript-eslint/typescript-eslint/issues/219)) ([fc50167](https://github.com/typescript-eslint/typescript-eslint/commit/fc50167))

# [1.2.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.1.1...v1.2.0) (2019-02-01)

**Note:** Version bump only for package @typescript-eslint/typescript-estree

## [1.1.1](https://github.com/typescript-eslint/typescript-eslint/compare/v1.1.0...v1.1.1) (2019-01-29)

### Bug Fixes

- **parser:** add visiting of type parameters in JSXOpeningElement ([#150](https://github.com/typescript-eslint/typescript-eslint/issues/150)) ([5e16003](https://github.com/typescript-eslint/typescript-eslint/commit/5e16003))
- **ts-estree:** expand optional property to include question token ([#138](https://github.com/typescript-eslint/typescript-eslint/issues/138)) ([9068b62](https://github.com/typescript-eslint/typescript-eslint/commit/9068b62))

### Performance Improvements

- **ts-estree:** don't create Program in parse() ([#148](https://github.com/typescript-eslint/typescript-eslint/issues/148)) ([aacf5b0](https://github.com/typescript-eslint/typescript-eslint/commit/aacf5b0))

# [1.1.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.0.0...v1.1.0) (2019-01-23)

### Bug Fixes

- **typescript-estree:** correct range of parameters with comments ([#128](https://github.com/typescript-eslint/typescript-eslint/issues/128)) ([91eedf2](https://github.com/typescript-eslint/typescript-eslint/commit/91eedf2))
- **typescript-estree:** fix range of assignment in parameter ([#115](https://github.com/typescript-eslint/typescript-eslint/issues/115)) ([4e781f1](https://github.com/typescript-eslint/typescript-eslint/commit/4e781f1))

# [1.0.0](https://github.com/typescript-eslint/typescript-eslint/compare/v0.2.1...v1.0.0) (2019-01-20)

### Features

- **parser:** support ecmaFeatures.jsx flag and tests ([#85](https://github.com/typescript-eslint/typescript-eslint/issues/85)) ([b321736](https://github.com/typescript-eslint/typescript-eslint/commit/b321736))

## [0.2.1](https://github.com/typescript-eslint/typescript-eslint/compare/v0.2.0...v0.2.1) (2019-01-20)

**Note:** Version bump only for package @typescript-eslint/typescript-estree
