# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.20.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.19.2...v2.20.0) (2020-02-17)


### Features

* **eslint-plugin:** [ban-types] allow banning null and undefined ([#821](https://github.com/typescript-eslint/typescript-eslint/issues/821)) ([0b2b887](https://github.com/typescript-eslint/typescript-eslint/commit/0b2b887c06f2582d812a45f7a8deb82f52d82a84))
* **eslint-plugin:** [strict-boolean-expressions] refactor, add clearer error messages ([#1480](https://github.com/typescript-eslint/typescript-eslint/issues/1480)) ([db4b530](https://github.com/typescript-eslint/typescript-eslint/commit/db4b530f3f049267d679e89d9e75acfcb86faaf2))





## [2.19.2](https://github.com/typescript-eslint/typescript-eslint/compare/v2.19.1...v2.19.2) (2020-02-10)

**Note:** Version bump only for package @typescript-eslint/eslint-plugin





## [2.19.1](https://github.com/typescript-eslint/typescript-eslint/compare/v2.19.0...v2.19.1) (2020-02-10)


### Bug Fixes

* **eslint-plugin:** [unbound-method] blacklist a few unbound natives ([#1562](https://github.com/typescript-eslint/typescript-eslint/issues/1562)) ([4670aab](https://github.com/typescript-eslint/typescript-eslint/commit/4670aabef31d9017ad302f206b9c2f18d53c8ee4))





# [2.19.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.18.0...v2.19.0) (2020-02-03)


### Bug Fixes

* **eslint-plugin:** [embt] fix allowTypedFunctionExpressions ([#1553](https://github.com/typescript-eslint/typescript-eslint/issues/1553)) ([9e7d161](https://github.com/typescript-eslint/typescript-eslint/commit/9e7d1616d78a0f94521f4e6d4b48344e5df2d9f7))
* **eslint-plugin:** [require-await] improve performance ([#1536](https://github.com/typescript-eslint/typescript-eslint/issues/1536)) ([45ae0b9](https://github.com/typescript-eslint/typescript-eslint/commit/45ae0b9565ee6e9d01e82107d85ad7151a15af7b))


### Features

* **eslint-plugin:** [no-extra-non-null-assert] add fixer ([#1468](https://github.com/typescript-eslint/typescript-eslint/issues/1468)) ([54201ab](https://github.com/typescript-eslint/typescript-eslint/commit/54201aba37b2865c0ba4981be79d1fd989806133))
* **eslint-plugin:** [no-float-prom] fixer + msg for ignoreVoid ([#1473](https://github.com/typescript-eslint/typescript-eslint/issues/1473)) ([159b16e](https://github.com/typescript-eslint/typescript-eslint/commit/159b16ec3a66f05478080c397df5c3f6e29535e4))
* **eslint-plugin:** [unbound-method] support bound builtins ([#1526](https://github.com/typescript-eslint/typescript-eslint/issues/1526)) ([0a110eb](https://github.com/typescript-eslint/typescript-eslint/commit/0a110eb680749c8c4a2a3dc1375c1a83056e4c14))
* **eslint-plugin:** add extension [no-dupe-class-members] ([#1492](https://github.com/typescript-eslint/typescript-eslint/issues/1492)) ([b22424e](https://github.com/typescript-eslint/typescript-eslint/commit/b22424e7d4a16042a027557f44e9191e0722b38b))
* **eslint-plugin:** add no-unnecessary-boolean-literal-compare ([#242](https://github.com/typescript-eslint/typescript-eslint/issues/242)) ([6bebb1d](https://github.com/typescript-eslint/typescript-eslint/commit/6bebb1dc47897ee0e1f075d7e5dd89d8b0590f31))
* **eslint-plugin:** add switch-exhaustiveness-check rule ([#972](https://github.com/typescript-eslint/typescript-eslint/issues/972)) ([9e0f6dd](https://github.com/typescript-eslint/typescript-eslint/commit/9e0f6ddef7cd29f355f398c90f1986e51c4854f7))
* **eslint-plugin:** support negative matches for `filter` ([#1517](https://github.com/typescript-eslint/typescript-eslint/issues/1517)) ([b24fbe8](https://github.com/typescript-eslint/typescript-eslint/commit/b24fbe8790b540998e4085174251fb4d61bf96b0))





# [2.18.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.17.0...v2.18.0) (2020-01-27)


### Bug Fixes

* **eslint-plugin:** [explicit-module-boundary-types] false positive for returned fns ([#1490](https://github.com/typescript-eslint/typescript-eslint/issues/1490)) ([5562ad5](https://github.com/typescript-eslint/typescript-eslint/commit/5562ad5ed902102d7c09a7fd47ca4ea7e50d6654))
* improve token types and add missing type guards ([#1497](https://github.com/typescript-eslint/typescript-eslint/issues/1497)) ([ce41d7d](https://github.com/typescript-eslint/typescript-eslint/commit/ce41d7de33bcb7ccf96c03ac1438304c5a49ff54))
* **eslint-plugin:** [naming-convention] fix filter option ([#1482](https://github.com/typescript-eslint/typescript-eslint/issues/1482)) ([718cd88](https://github.com/typescript-eslint/typescript-eslint/commit/718cd889c155a75413c571ac006c33fbc271dcc5))
* **eslint-plugin:** fix property access on undefined error ([#1507](https://github.com/typescript-eslint/typescript-eslint/issues/1507)) ([d89e8e8](https://github.com/typescript-eslint/typescript-eslint/commit/d89e8e8a1114989e2727351bee7aadb6579f312b))


### Features

* **eslint-plugin:** add comma-spacing ([#1495](https://github.com/typescript-eslint/typescript-eslint/issues/1495)) ([1fd86be](https://github.com/typescript-eslint/typescript-eslint/commit/1fd86befa6a940a0354c619dd2da08a5c5d69fb4))
* **eslint-plugin:** add new rule prefer-as-const ([#1431](https://github.com/typescript-eslint/typescript-eslint/issues/1431)) ([420db96](https://github.com/typescript-eslint/typescript-eslint/commit/420db96921435e8bf7fb484ae74552a912a6adde))
* **eslint-plugin:** create `ban-ts-comment` rule ([#1361](https://github.com/typescript-eslint/typescript-eslint/issues/1361)) ([2a83d13](https://github.com/typescript-eslint/typescript-eslint/commit/2a83d138a966cd5ce787d1eecf595b59b78232d4))
* **experimental-utils:** make RuleMetaData.docs optional ([#1462](https://github.com/typescript-eslint/typescript-eslint/issues/1462)) ([cde97ac](https://github.com/typescript-eslint/typescript-eslint/commit/cde97aca24df5a0f28f37006ed130ebc217fb2ad))





# [2.17.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.16.0...v2.17.0) (2020-01-20)


### Bug Fixes

* **eslint-plugin:** [naming-convention] handle empty array-pattern ([#1450](https://github.com/typescript-eslint/typescript-eslint/issues/1450)) ([4726605](https://github.com/typescript-eslint/typescript-eslint/commit/4726605))
* **eslint-plugin:** [unbound-method] handling of logical expr ([#1440](https://github.com/typescript-eslint/typescript-eslint/issues/1440)) ([9c5b857](https://github.com/typescript-eslint/typescript-eslint/commit/9c5b857))
* **eslint-plugin:** set default-param-last as an extension rule ([#1445](https://github.com/typescript-eslint/typescript-eslint/issues/1445)) ([b5ef704](https://github.com/typescript-eslint/typescript-eslint/commit/b5ef704))
* **typescript-estree:** correct type of `ArrayPattern.elements` ([#1451](https://github.com/typescript-eslint/typescript-eslint/issues/1451)) ([62e4ca0](https://github.com/typescript-eslint/typescript-eslint/commit/62e4ca0))


### Features

* **eslint-plugin:** [naming-convention] allow not check format ([#1455](https://github.com/typescript-eslint/typescript-eslint/issues/1455)) ([61eb434](https://github.com/typescript-eslint/typescript-eslint/commit/61eb434))
* **eslint-plugin:** [naming-convention] correct example ([#1455](https://github.com/typescript-eslint/typescript-eslint/issues/1455)) ([60683d7](https://github.com/typescript-eslint/typescript-eslint/commit/60683d7))
* **eslint-plugin:** [no-extra-!-assert] flag ?. after !-assert ([#1460](https://github.com/typescript-eslint/typescript-eslint/issues/1460)) ([58c7c25](https://github.com/typescript-eslint/typescript-eslint/commit/58c7c25))
* **eslint-plugin:** add explicit-module-boundary-types rule ([#1020](https://github.com/typescript-eslint/typescript-eslint/issues/1020)) ([bb0a846](https://github.com/typescript-eslint/typescript-eslint/commit/bb0a846))
* **eslint-plugin:** add no-non-null-asserted-optional-chain ([#1469](https://github.com/typescript-eslint/typescript-eslint/issues/1469)) ([498aa24](https://github.com/typescript-eslint/typescript-eslint/commit/498aa24))
* **experimental-utils:** expose getParserServices from utils ([#1448](https://github.com/typescript-eslint/typescript-eslint/issues/1448)) ([982c8bc](https://github.com/typescript-eslint/typescript-eslint/commit/982c8bc))





# [2.16.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.15.0...v2.16.0) (2020-01-13)


### Bug Fixes

* **eslint-plugin:** [no-magic-numbers] handle UnaryExpression for enums ([#1415](https://github.com/typescript-eslint/typescript-eslint/issues/1415)) ([852fc31](https://github.com/typescript-eslint/typescript-eslint/commit/852fc31))
* **eslint-plugin:** [no-unnec-type-assert] handle JSX attributes ([#1002](https://github.com/typescript-eslint/typescript-eslint/issues/1002)) ([3c5659b](https://github.com/typescript-eslint/typescript-eslint/commit/3c5659b))
* **eslint-plugin:** handle error classes using generics ([#1428](https://github.com/typescript-eslint/typescript-eslint/issues/1428)) ([b139540](https://github.com/typescript-eslint/typescript-eslint/commit/b139540))
* **typescript-estree:** resolve path relative to tsconfigRootDir ([#1439](https://github.com/typescript-eslint/typescript-eslint/issues/1439)) ([c709056](https://github.com/typescript-eslint/typescript-eslint/commit/c709056))


### Features

* **eslint-plugin:** [no-unnec-cond] array predicate callbacks ([#1206](https://github.com/typescript-eslint/typescript-eslint/issues/1206)) ([f7ad716](https://github.com/typescript-eslint/typescript-eslint/commit/f7ad716))
* **eslint-plugin:** add default-param-last rule ([#1418](https://github.com/typescript-eslint/typescript-eslint/issues/1418)) ([a37ff9f](https://github.com/typescript-eslint/typescript-eslint/commit/a37ff9f))
* **eslint-plugin:** add rule naming-conventions ([#1318](https://github.com/typescript-eslint/typescript-eslint/issues/1318)) ([9eab26f](https://github.com/typescript-eslint/typescript-eslint/commit/9eab26f))
* **typescript-estree:** add strict type mapping to esTreeNodeToTSNodeMap ([#1382](https://github.com/typescript-eslint/typescript-eslint/issues/1382)) ([d3d70a3](https://github.com/typescript-eslint/typescript-eslint/commit/d3d70a3))





# [2.15.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.14.0...v2.15.0) (2020-01-06)


### Bug Fixes

* **eslint-plugin:** crash in no-unnecessary-type-arguments ([#1401](https://github.com/typescript-eslint/typescript-eslint/issues/1401)) ([01c939f](https://github.com/typescript-eslint/typescript-eslint/commit/01c939f))


### Features

* **eslint-plugin:** [strict-bool-expr] add allowSafe option ([#1385](https://github.com/typescript-eslint/typescript-eslint/issues/1385)) ([9344233](https://github.com/typescript-eslint/typescript-eslint/commit/9344233))
* **eslint-plugin:** add no-implied-eval ([#1375](https://github.com/typescript-eslint/typescript-eslint/issues/1375)) ([254d276](https://github.com/typescript-eslint/typescript-eslint/commit/254d276))





# [2.14.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.13.0...v2.14.0) (2019-12-30)


### Bug Fixes

* **eslint-plugin:** type assertion in rule no-extra-parens ([#1376](https://github.com/typescript-eslint/typescript-eslint/issues/1376)) ([f40639e](https://github.com/typescript-eslint/typescript-eslint/commit/f40639e))


### Features

* add internal eslint plugin for repo-specific lint rules ([#1373](https://github.com/typescript-eslint/typescript-eslint/issues/1373)) ([3a15413](https://github.com/typescript-eslint/typescript-eslint/commit/3a15413))





# [2.13.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.12.0...v2.13.0) (2019-12-23)


### Bug Fixes

* **eslint-plugin:** [quotes] ignore backticks for Enum members ([#1355](https://github.com/typescript-eslint/typescript-eslint/issues/1355)) ([e51048c](https://github.com/typescript-eslint/typescript-eslint/commit/e51048c))
* **eslint-plugin:** [type-annotation-spacing] typo in messages ([#1354](https://github.com/typescript-eslint/typescript-eslint/issues/1354)) ([82e0dbc](https://github.com/typescript-eslint/typescript-eslint/commit/82e0dbc))
* **eslint-plugin:** add isTypeAssertion utility function ([#1369](https://github.com/typescript-eslint/typescript-eslint/issues/1369)) ([bb1671e](https://github.com/typescript-eslint/typescript-eslint/commit/bb1671e))
* **eslint-plugin:** use AST_NODE_TYPES enum instead of strings ([#1366](https://github.com/typescript-eslint/typescript-eslint/issues/1366)) ([bd0276b](https://github.com/typescript-eslint/typescript-eslint/commit/bd0276b))


### Features

* **eslint-plugin:** [ban-types] handle empty type literal {} ([#1348](https://github.com/typescript-eslint/typescript-eslint/issues/1348)) ([1c0ce9b](https://github.com/typescript-eslint/typescript-eslint/commit/1c0ce9b))
* **eslint-plugin:** [no-use-before-define] opt to ignore enum ([#1242](https://github.com/typescript-eslint/typescript-eslint/issues/1242)) ([6edd911](https://github.com/typescript-eslint/typescript-eslint/commit/6edd911))
* **eslint-plugin:** [pref-str-starts/ends-with] optional chain… ([#1357](https://github.com/typescript-eslint/typescript-eslint/issues/1357)) ([fd37bc3](https://github.com/typescript-eslint/typescript-eslint/commit/fd37bc3))
* **eslint-plugin:** add no-extra-semi [extension] ([#1237](https://github.com/typescript-eslint/typescript-eslint/issues/1237)) ([425f65c](https://github.com/typescript-eslint/typescript-eslint/commit/425f65c))
* **eslint-plugin:** add no-throw-literal [extension] ([#1331](https://github.com/typescript-eslint/typescript-eslint/issues/1331)) ([2aa696c](https://github.com/typescript-eslint/typescript-eslint/commit/2aa696c))
* **eslint-plugin:** more optional chain support in rules ([#1363](https://github.com/typescript-eslint/typescript-eslint/issues/1363)) ([3dd1b02](https://github.com/typescript-eslint/typescript-eslint/commit/3dd1b02))
* **typescript-estree:** computed members discriminated unions ([#1349](https://github.com/typescript-eslint/typescript-eslint/issues/1349)) ([013df9a](https://github.com/typescript-eslint/typescript-eslint/commit/013df9a))
* **typescript-estree:** tighten prop name and destructure types ([#1346](https://github.com/typescript-eslint/typescript-eslint/issues/1346)) ([f335c50](https://github.com/typescript-eslint/typescript-eslint/commit/f335c50))





# [2.12.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.11.0...v2.12.0) (2019-12-16)


### Bug Fixes

* **eslint-plugin:** [prefer-null-coal] fixer w/ mixed logicals ([#1326](https://github.com/typescript-eslint/typescript-eslint/issues/1326)) ([f9a9fbf](https://github.com/typescript-eslint/typescript-eslint/commit/f9a9fbf))
* **eslint-plugin:** [quotes] ignore backticks for interface properties ([#1311](https://github.com/typescript-eslint/typescript-eslint/issues/1311)) ([3923a09](https://github.com/typescript-eslint/typescript-eslint/commit/3923a09))


### Features

* **eslint-plugin:** [no-unnec-cond] check optional chaining ([#1315](https://github.com/typescript-eslint/typescript-eslint/issues/1315)) ([a2a8a0a](https://github.com/typescript-eslint/typescript-eslint/commit/a2a8a0a))





# [2.11.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.10.0...v2.11.0) (2019-12-09)


### Bug Fixes

* **eslint-plugin:** [brace-style] handle enum declarations ([#1281](https://github.com/typescript-eslint/typescript-eslint/issues/1281)) ([3ddf1a2](https://github.com/typescript-eslint/typescript-eslint/commit/3ddf1a2))


### Features

* **eslint-plugin:** [member-ordering] add index signature ([#1190](https://github.com/typescript-eslint/typescript-eslint/issues/1190)) ([b5a52a3](https://github.com/typescript-eslint/typescript-eslint/commit/b5a52a3))





# [2.10.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.9.0...v2.10.0) (2019-12-02)


### Bug Fixes

* **eslint-plugin:** [no-empty-function] add missed node types ([#1271](https://github.com/typescript-eslint/typescript-eslint/issues/1271)) ([e9d44f5](https://github.com/typescript-eslint/typescript-eslint/commit/e9d44f5))
* **eslint-plugin:** [no-untyped-pub-sig] ignore set return ([#1264](https://github.com/typescript-eslint/typescript-eslint/issues/1264)) ([6daff10](https://github.com/typescript-eslint/typescript-eslint/commit/6daff10))
* **eslint-plugin:** [no-unused-expressions] ignore directives ([#1285](https://github.com/typescript-eslint/typescript-eslint/issues/1285)) ([ce4c803](https://github.com/typescript-eslint/typescript-eslint/commit/ce4c803))
* **eslint-plugin:** [prefer-optional-chain] allow $ in identifiers ([c72c3c1](https://github.com/typescript-eslint/typescript-eslint/commit/c72c3c1))
* **eslint-plugin:** [prefer-optional-chain] handle more cases ([#1261](https://github.com/typescript-eslint/typescript-eslint/issues/1261)) ([57ddba3](https://github.com/typescript-eslint/typescript-eslint/commit/57ddba3))
* **eslint-plugin:** [return-await] allow Any and Unknown ([#1270](https://github.com/typescript-eslint/typescript-eslint/issues/1270)) ([ebf5e0a](https://github.com/typescript-eslint/typescript-eslint/commit/ebf5e0a))
* **eslint-plugin:** [strict-bool-expr] allow nullish coalescing ([#1275](https://github.com/typescript-eslint/typescript-eslint/issues/1275)) ([3b39340](https://github.com/typescript-eslint/typescript-eslint/commit/3b39340))


### Features

* **eslint-plugin:** [no-empty-func] private/protected construct ([#1267](https://github.com/typescript-eslint/typescript-eslint/issues/1267)) ([3b931ac](https://github.com/typescript-eslint/typescript-eslint/commit/3b931ac))
* **eslint-plugin:** [no-non-null-assert] add suggestion fixer ([#1260](https://github.com/typescript-eslint/typescript-eslint/issues/1260)) ([e350a21](https://github.com/typescript-eslint/typescript-eslint/commit/e350a21))
* **eslint-plugin:** [no-unnec-cond] support nullish coalescing ([#1148](https://github.com/typescript-eslint/typescript-eslint/issues/1148)) ([96ef1e7](https://github.com/typescript-eslint/typescript-eslint/commit/96ef1e7))
* **eslint-plugin:** [prefer-null-coal] opt for suggestion fixer ([#1272](https://github.com/typescript-eslint/typescript-eslint/issues/1272)) ([f84eb96](https://github.com/typescript-eslint/typescript-eslint/commit/f84eb96))





# [2.9.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.8.0...v2.9.0) (2019-11-25)


### Bug Fixes

* **eslint-plugin:** [no-dynamic-delete] correct invalid fixer for identifiers ([#1244](https://github.com/typescript-eslint/typescript-eslint/issues/1244)) ([5b1300d](https://github.com/typescript-eslint/typescript-eslint/commit/5b1300d))
* **eslint-plugin:** [no-untyped-pub-sig] constructor return ([#1231](https://github.com/typescript-eslint/typescript-eslint/issues/1231)) ([6cfd468](https://github.com/typescript-eslint/typescript-eslint/commit/6cfd468))
* **eslint-plugin:** [prefer-optional-chain] unhandled cases ([b1a065f](https://github.com/typescript-eslint/typescript-eslint/commit/b1a065f))
* **eslint-plugin:** [req-await] crash on nonasync promise return ([#1228](https://github.com/typescript-eslint/typescript-eslint/issues/1228)) ([56c00b3](https://github.com/typescript-eslint/typescript-eslint/commit/56c00b3))


### Features

* **eslint-plugin:** [camelcase] add genericType option ([#925](https://github.com/typescript-eslint/typescript-eslint/issues/925)) ([d785c61](https://github.com/typescript-eslint/typescript-eslint/commit/d785c61))
* **eslint-plugin:** [no-empty-interface] noEmptyWithSuper fixer ([#1247](https://github.com/typescript-eslint/typescript-eslint/issues/1247)) ([b91b0ba](https://github.com/typescript-eslint/typescript-eslint/commit/b91b0ba))
* **eslint-plugin:** [no-extran-class] add allowWithDecorator opt ([#886](https://github.com/typescript-eslint/typescript-eslint/issues/886)) ([f1ab9a2](https://github.com/typescript-eslint/typescript-eslint/commit/f1ab9a2))
* **eslint-plugin:** [no-unnece-cond] Add allowConstantLoopConditions ([#1029](https://github.com/typescript-eslint/typescript-eslint/issues/1029)) ([ceb6f1c](https://github.com/typescript-eslint/typescript-eslint/commit/ceb6f1c))
* **eslint-plugin:** [restrict-plus-operands] check += ([#892](https://github.com/typescript-eslint/typescript-eslint/issues/892)) ([fa88cb9](https://github.com/typescript-eslint/typescript-eslint/commit/fa88cb9))
* suggestion types, suggestions for no-explicit-any ([#1250](https://github.com/typescript-eslint/typescript-eslint/issues/1250)) ([b16a4b6](https://github.com/typescript-eslint/typescript-eslint/commit/b16a4b6))
* **eslint-plugin:** add no-extra-non-null-assertion ([#1183](https://github.com/typescript-eslint/typescript-eslint/issues/1183)) ([2b3b5d6](https://github.com/typescript-eslint/typescript-eslint/commit/2b3b5d6))
* **eslint-plugin:** add no-unused-vars-experimental ([#688](https://github.com/typescript-eslint/typescript-eslint/issues/688)) ([05ebea5](https://github.com/typescript-eslint/typescript-eslint/commit/05ebea5))
* **eslint-plugin:** add prefer-nullish-coalescing ([#1069](https://github.com/typescript-eslint/typescript-eslint/issues/1069)) ([a9cd399](https://github.com/typescript-eslint/typescript-eslint/commit/a9cd399))
* **eslint-plugin:** add return-await rule ([#1050](https://github.com/typescript-eslint/typescript-eslint/issues/1050)) ([0ff4620](https://github.com/typescript-eslint/typescript-eslint/commit/0ff4620))
* **eslint-plugin:** add rule prefer-optional-chain ([#1213](https://github.com/typescript-eslint/typescript-eslint/issues/1213)) ([ad7e1a7](https://github.com/typescript-eslint/typescript-eslint/commit/ad7e1a7))
* **eslint-plugin:** optional chain support in rules (part 1) ([#1253](https://github.com/typescript-eslint/typescript-eslint/issues/1253)) ([f5c0e02](https://github.com/typescript-eslint/typescript-eslint/commit/f5c0e02))





# [2.8.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.7.0...v2.8.0) (2019-11-18)


### Bug Fixes

* **eslint-plugin:** [camelcase] handle optional member expr ([#1204](https://github.com/typescript-eslint/typescript-eslint/issues/1204)) ([9c8203f](https://github.com/typescript-eslint/typescript-eslint/commit/9c8203f))
* **eslint-plugin:** [indent] fix decorator type ([#1189](https://github.com/typescript-eslint/typescript-eslint/issues/1189)) ([e2008e3](https://github.com/typescript-eslint/typescript-eslint/commit/e2008e3))
* **eslint-plugin:** [indent] handle empty generic declarations ([#1211](https://github.com/typescript-eslint/typescript-eslint/issues/1211)) ([9aee06c](https://github.com/typescript-eslint/typescript-eslint/commit/9aee06c))
* **eslint-plugin:** [no-type-alias] handle constructor aliases ([#1198](https://github.com/typescript-eslint/typescript-eslint/issues/1198)) ([1bb4d63](https://github.com/typescript-eslint/typescript-eslint/commit/1bb4d63))
* **eslint-plugin:** [no-unnec-type-arg] throwing on call/new expr ([#1217](https://github.com/typescript-eslint/typescript-eslint/issues/1217)) ([42a48de](https://github.com/typescript-eslint/typescript-eslint/commit/42a48de))
* **eslint-plugin:** [no-unnecessary-cond] fix naked type param ([#1207](https://github.com/typescript-eslint/typescript-eslint/issues/1207)) ([4fac6c5](https://github.com/typescript-eslint/typescript-eslint/commit/4fac6c5))
* **eslint-plugin:** [nuta] correctly handle null/undefined separation ([#1201](https://github.com/typescript-eslint/typescript-eslint/issues/1201)) ([9829dd3](https://github.com/typescript-eslint/typescript-eslint/commit/9829dd3))
* **eslint-plugin:** [require-await] better handle nesting ([#1193](https://github.com/typescript-eslint/typescript-eslint/issues/1193)) ([eb83af1](https://github.com/typescript-eslint/typescript-eslint/commit/eb83af1))
* **eslint-plugin:** [unified-signatures] crash: cannot read pro… ([#1096](https://github.com/typescript-eslint/typescript-eslint/issues/1096)) ([d1de3a7](https://github.com/typescript-eslint/typescript-eslint/commit/d1de3a7))
* **eslint-plugin:** disable base no-unused-expressions in all config ([ecb3f4e](https://github.com/typescript-eslint/typescript-eslint/commit/ecb3f4e))


### Features

* **eslint-plugin:** [no-type-alias] handle conditional types ([#953](https://github.com/typescript-eslint/typescript-eslint/issues/953)) ([259ff20](https://github.com/typescript-eslint/typescript-eslint/commit/259ff20))
* **eslint-plugin:** add rule restrict-template-expressions ([#850](https://github.com/typescript-eslint/typescript-eslint/issues/850)) ([46b58b4](https://github.com/typescript-eslint/typescript-eslint/commit/46b58b4))
* **eslint-plugin:** add space-before-function-paren [extension] ([#924](https://github.com/typescript-eslint/typescript-eslint/issues/924)) ([d8b07a7](https://github.com/typescript-eslint/typescript-eslint/commit/d8b07a7))
* **eslint-plugin:** added new rule no-dynamic-delete ([#565](https://github.com/typescript-eslint/typescript-eslint/issues/565)) ([864c811](https://github.com/typescript-eslint/typescript-eslint/commit/864c811))
* **eslint-plugin:** added new rule no-untyped-public-signature ([#801](https://github.com/typescript-eslint/typescript-eslint/issues/801)) ([c5835f3](https://github.com/typescript-eslint/typescript-eslint/commit/c5835f3))





# [2.7.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.6.1...v2.7.0) (2019-11-11)


### Bug Fixes

* **eslint-plugin:** crash fixing readonly arrays to generic ([#1172](https://github.com/typescript-eslint/typescript-eslint/issues/1172)) ([2b2f2d7](https://github.com/typescript-eslint/typescript-eslint/commit/2b2f2d7))


### Features

* **eslint-plugin:** [no-unused-expressions] extend for optional chaining ([#1175](https://github.com/typescript-eslint/typescript-eslint/issues/1175)) ([57d63b7](https://github.com/typescript-eslint/typescript-eslint/commit/57d63b7))
* **parser:** handle optional chaining in scope analysis ([#1169](https://github.com/typescript-eslint/typescript-eslint/issues/1169)) ([026ceb9](https://github.com/typescript-eslint/typescript-eslint/commit/026ceb9))





## [2.6.1](https://github.com/typescript-eslint/typescript-eslint/compare/v2.6.0...v2.6.1) (2019-11-04)

**Note:** Version bump only for package @typescript-eslint/eslint-plugin





# [2.6.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.5.0...v2.6.0) (2019-10-28)


### Features

* **typescript-estree:** add support for declare class properties ([#1136](https://github.com/typescript-eslint/typescript-eslint/issues/1136)) ([1508670](https://github.com/typescript-eslint/typescript-eslint/commit/1508670))





# [2.5.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.4.0...v2.5.0) (2019-10-21)


### Bug Fixes

* **eslint-plugin:** [no-magic-numbers] Support negative numbers ([#1072](https://github.com/typescript-eslint/typescript-eslint/issues/1072)) ([0c85ac3](https://github.com/typescript-eslint/typescript-eslint/commit/0c85ac3))


### Features

* **eslint-plugin:** Support abstract members in member-ordering rule ([#395](https://github.com/typescript-eslint/typescript-eslint/issues/395)) ([#1004](https://github.com/typescript-eslint/typescript-eslint/issues/1004)) ([5f093ac](https://github.com/typescript-eslint/typescript-eslint/commit/5f093ac))
* **typescript-estree:** support long running lint without watch ([#1106](https://github.com/typescript-eslint/typescript-eslint/issues/1106)) ([ed5564d](https://github.com/typescript-eslint/typescript-eslint/commit/ed5564d))





# [2.4.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.3...v2.4.0) (2019-10-14)


### Bug Fixes

* **eslint-plugin:** [promise-function-async] Should not report… ([#1023](https://github.com/typescript-eslint/typescript-eslint/issues/1023)) ([514bed9](https://github.com/typescript-eslint/typescript-eslint/commit/514bed9))
* support long running "watch" lint sessions ([#973](https://github.com/typescript-eslint/typescript-eslint/issues/973)) ([854620e](https://github.com/typescript-eslint/typescript-eslint/commit/854620e))


### Features

* **typescript-estree:** support for parsing 3.7 features ([#1045](https://github.com/typescript-eslint/typescript-eslint/issues/1045)) ([623febf](https://github.com/typescript-eslint/typescript-eslint/commit/623febf))





## [2.3.3](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.2...v2.3.3) (2019-10-07)


### Bug Fixes

* **eslint-plugin:** [class-name-casing] allow unicode letters ([#1043](https://github.com/typescript-eslint/typescript-eslint/issues/1043)) ([47895c0](https://github.com/typescript-eslint/typescript-eslint/commit/47895c0))
* **eslint-plugin:** [efrt] support constructor arguments ([#1021](https://github.com/typescript-eslint/typescript-eslint/issues/1021)) ([60943e6](https://github.com/typescript-eslint/typescript-eslint/commit/60943e6))





## [2.3.2](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.1...v2.3.2) (2019-09-30)


### Bug Fixes

* **eslint-plugin:** [no-unnec-type-arg] undefined symbol crash ([#1007](https://github.com/typescript-eslint/typescript-eslint/issues/1007)) ([cdf9294](https://github.com/typescript-eslint/typescript-eslint/commit/cdf9294))
* **typescript-estree:** correct ClassDeclarationBase type ([#1008](https://github.com/typescript-eslint/typescript-eslint/issues/1008)) ([8ce3a81](https://github.com/typescript-eslint/typescript-eslint/commit/8ce3a81))





## [2.3.1](https://github.com/typescript-eslint/typescript-eslint/compare/v2.3.0...v2.3.1) (2019-09-23)


### Bug Fixes

* **eslint-plugin:** [cons-type-assns] handle namespaced types ([#975](https://github.com/typescript-eslint/typescript-eslint/issues/975)) ([c3c8b86](https://github.com/typescript-eslint/typescript-eslint/commit/c3c8b86))
* **eslint-plugin:** [pfa] Allow async getter/setter in classes ([#980](https://github.com/typescript-eslint/typescript-eslint/issues/980)) ([e348cb2](https://github.com/typescript-eslint/typescript-eslint/commit/e348cb2))





# [2.3.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.2.0...v2.3.0) (2019-09-16)


### Bug Fixes

* **typescript-estree:** ImportDeclaration.specifier to Literal ([#974](https://github.com/typescript-eslint/typescript-eslint/issues/974)) ([2bf8231](https://github.com/typescript-eslint/typescript-eslint/commit/2bf8231))


### Features

* **eslint-plugin:** [explicit-member-accessibility] add support of "ignoredMethodNames" ([#895](https://github.com/typescript-eslint/typescript-eslint/issues/895)) ([46ee4c9](https://github.com/typescript-eslint/typescript-eslint/commit/46ee4c9))
* **eslint-plugin:** [no-floating-promises] Add ignoreVoid option ([#796](https://github.com/typescript-eslint/typescript-eslint/issues/796)) ([6a55921](https://github.com/typescript-eslint/typescript-eslint/commit/6a55921))
* **eslint-plugin:** [no-magic-numbers] add ignoreReadonlyClassProperties option ([#938](https://github.com/typescript-eslint/typescript-eslint/issues/938)) ([aeea4cd](https://github.com/typescript-eslint/typescript-eslint/commit/aeea4cd))
* **eslint-plugin:** [strict-boolean-expressions] Add allowNullable option ([#794](https://github.com/typescript-eslint/typescript-eslint/issues/794)) ([c713ca4](https://github.com/typescript-eslint/typescript-eslint/commit/c713ca4))
* **eslint-plugin:** add no-unnecessary-condition rule ([#699](https://github.com/typescript-eslint/typescript-eslint/issues/699)) ([5715482](https://github.com/typescript-eslint/typescript-eslint/commit/5715482))





# [2.2.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.1.0...v2.2.0) (2019-09-09)


### Bug Fixes

* **eslint-plugin:** [efrt] allowExpressions - check functions in class field properties ([#952](https://github.com/typescript-eslint/typescript-eslint/issues/952)) ([f1059d8](https://github.com/typescript-eslint/typescript-eslint/commit/f1059d8))
* **eslint-plugin:** [expl-member-a11y] fix parameter properties ([#912](https://github.com/typescript-eslint/typescript-eslint/issues/912)) ([ccb98d8](https://github.com/typescript-eslint/typescript-eslint/commit/ccb98d8))
* **eslint-plugin:** [prefer-readonly] add handling for destructuring assignments ([e011e90](https://github.com/typescript-eslint/typescript-eslint/commit/e011e90))


### Features

* **eslint-plugin:** add brace-style [extension] ([#810](https://github.com/typescript-eslint/typescript-eslint/issues/810)) ([e01dc5f](https://github.com/typescript-eslint/typescript-eslint/commit/e01dc5f))





# [2.1.0](https://github.com/typescript-eslint/typescript-eslint/compare/v2.0.0...v2.1.0) (2019-09-02)


### Bug Fixes

* **eslint-plugin:** [member-naming] should match constructor args ([#771](https://github.com/typescript-eslint/typescript-eslint/issues/771)) ([b006667](https://github.com/typescript-eslint/typescript-eslint/commit/b006667))
* **eslint-plugin:** [no-inferrable-types] ignore optional props ([#918](https://github.com/typescript-eslint/typescript-eslint/issues/918)) ([a4e625f](https://github.com/typescript-eslint/typescript-eslint/commit/a4e625f))
* **eslint-plugin:** [promise-function-async] Allow async get/set ([#820](https://github.com/typescript-eslint/typescript-eslint/issues/820)) ([cddfdca](https://github.com/typescript-eslint/typescript-eslint/commit/cddfdca))
* **eslint-plugin:** [require-await] Allow concise arrow function bodies ([#826](https://github.com/typescript-eslint/typescript-eslint/issues/826)) ([29fddfd](https://github.com/typescript-eslint/typescript-eslint/commit/29fddfd))
* **eslint-plugin:** [typedef] don't flag destructuring when variables is disabled ([#819](https://github.com/typescript-eslint/typescript-eslint/issues/819)) ([5603473](https://github.com/typescript-eslint/typescript-eslint/commit/5603473))
* **eslint-plugin:** [typedef] handle AssignmentPattern inside TSParameterProperty ([#923](https://github.com/typescript-eslint/typescript-eslint/issues/923)) ([6bd7f2d](https://github.com/typescript-eslint/typescript-eslint/commit/6bd7f2d))
* **eslint-plugin:** [unbound-method] Allow typeof expressions (Fixes [#692](https://github.com/typescript-eslint/typescript-eslint/issues/692)) ([#904](https://github.com/typescript-eslint/typescript-eslint/issues/904)) ([344bafe](https://github.com/typescript-eslint/typescript-eslint/commit/344bafe))
* **eslint-plugin:** [unbound-method] false positive in equality comparisons ([#914](https://github.com/typescript-eslint/typescript-eslint/issues/914)) ([29a01b8](https://github.com/typescript-eslint/typescript-eslint/commit/29a01b8))
* **eslint-plugin:** [unified-signatures] type comparison and exported nodes ([#839](https://github.com/typescript-eslint/typescript-eslint/issues/839)) ([580eceb](https://github.com/typescript-eslint/typescript-eslint/commit/580eceb))
* **eslint-plugin:** readme typo ([#867](https://github.com/typescript-eslint/typescript-eslint/issues/867)) ([5eb40dc](https://github.com/typescript-eslint/typescript-eslint/commit/5eb40dc))
* **typescript-estree:** improve missing project file error msg ([#866](https://github.com/typescript-eslint/typescript-eslint/issues/866)) ([8f3b0a8](https://github.com/typescript-eslint/typescript-eslint/commit/8f3b0a8)), closes [#853](https://github.com/typescript-eslint/typescript-eslint/issues/853)


### Features

* [no-unnecessary-type-assertion] allow `as const` arrow functions ([#876](https://github.com/typescript-eslint/typescript-eslint/issues/876)) ([14c6f80](https://github.com/typescript-eslint/typescript-eslint/commit/14c6f80))
* **eslint-plugin:** [expl-func-ret-type] make error loc smaller ([#919](https://github.com/typescript-eslint/typescript-eslint/issues/919)) ([65eb993](https://github.com/typescript-eslint/typescript-eslint/commit/65eb993))
* **eslint-plugin:** [no-type-alias] support tuples ([#775](https://github.com/typescript-eslint/typescript-eslint/issues/775)) ([c68e033](https://github.com/typescript-eslint/typescript-eslint/commit/c68e033))
* **eslint-plugin:** add quotes [extension] ([#762](https://github.com/typescript-eslint/typescript-eslint/issues/762)) ([9f82099](https://github.com/typescript-eslint/typescript-eslint/commit/9f82099))





# [2.0.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.13.0...v2.0.0) (2019-08-13)


### Bug Fixes

* **eslint-plugin:** [efrt] flag default export w/allowExpressions ([#831](https://github.com/typescript-eslint/typescript-eslint/issues/831)) ([ebbcc01](https://github.com/typescript-eslint/typescript-eslint/commit/ebbcc01))
* **eslint-plugin:** [no-explicit-any] Fix ignoreRestArgs for interfaces ([#777](https://github.com/typescript-eslint/typescript-eslint/issues/777)) ([22e9ae5](https://github.com/typescript-eslint/typescript-eslint/commit/22e9ae5))
* **eslint-plugin:** [no-useless-constructor] handle bodyless constructor ([#685](https://github.com/typescript-eslint/typescript-eslint/issues/685)) ([55e788c](https://github.com/typescript-eslint/typescript-eslint/commit/55e788c))
* **eslint-plugin:** [prefer-readonly] TypeError when having comp… ([#761](https://github.com/typescript-eslint/typescript-eslint/issues/761)) ([211b1b5](https://github.com/typescript-eslint/typescript-eslint/commit/211b1b5))
* **eslint-plugin:** [typedef] support "for..in", "for..of" ([#787](https://github.com/typescript-eslint/typescript-eslint/issues/787)) ([39e41b5](https://github.com/typescript-eslint/typescript-eslint/commit/39e41b5))
* **eslint-plugin:** [typedef] support default value for parameter ([#785](https://github.com/typescript-eslint/typescript-eslint/issues/785)) ([84916e6](https://github.com/typescript-eslint/typescript-eslint/commit/84916e6))


* feat(eslint-plugin)!: recommended-requiring-type-checking config (#846) ([d3470c9](https://github.com/typescript-eslint/typescript-eslint/commit/d3470c9)), closes [#846](https://github.com/typescript-eslint/typescript-eslint/issues/846)
* feat(eslint-plugin)!: change recommended config (#729) ([428567d](https://github.com/typescript-eslint/typescript-eslint/commit/428567d)), closes [#729](https://github.com/typescript-eslint/typescript-eslint/issues/729)
* feat(typescript-estree)!: throw error on file not in project when `project` set (#760) ([3777b77](https://github.com/typescript-eslint/typescript-eslint/commit/3777b77)), closes [#760](https://github.com/typescript-eslint/typescript-eslint/issues/760)
* feat(eslint-plugin)!: add rule `consistent-type-assertions` (#731) ([92e98de](https://github.com/typescript-eslint/typescript-eslint/commit/92e98de)), closes [#731](https://github.com/typescript-eslint/typescript-eslint/issues/731)
* feat(eslint-plugin)!: [array-type] rework options (#654) ([1389393](https://github.com/typescript-eslint/typescript-eslint/commit/1389393)), closes [#654](https://github.com/typescript-eslint/typescript-eslint/issues/654) [#635](https://github.com/typescript-eslint/typescript-eslint/issues/635)


### Features

* explicitly support eslint v6 ([#645](https://github.com/typescript-eslint/typescript-eslint/issues/645)) ([34a7cf6](https://github.com/typescript-eslint/typescript-eslint/commit/34a7cf6))
* **eslint-plugin:** [interface-name-prefix, class-name-casing] Add allowUnderscorePrefix option to support private declarations ([#790](https://github.com/typescript-eslint/typescript-eslint/issues/790)) ([0c4f474](https://github.com/typescript-eslint/typescript-eslint/commit/0c4f474))
* **eslint-plugin:** [no-var-requires] report on foo(require('')) ([#725](https://github.com/typescript-eslint/typescript-eslint/issues/725)) ([b2ca20d](https://github.com/typescript-eslint/typescript-eslint/commit/b2ca20d)), closes [#665](https://github.com/typescript-eslint/typescript-eslint/issues/665)
* **eslint-plugin:** [promise-function-async] make allowAny default true ([#733](https://github.com/typescript-eslint/typescript-eslint/issues/733)) ([590ca50](https://github.com/typescript-eslint/typescript-eslint/commit/590ca50))
* **eslint-plugin:** [strict-boolean-expressions] add ignoreRhs option ([#691](https://github.com/typescript-eslint/typescript-eslint/issues/691)) ([fd6be42](https://github.com/typescript-eslint/typescript-eslint/commit/fd6be42))
* **eslint-plugin:** add support for object props in CallExpressions ([#728](https://github.com/typescript-eslint/typescript-eslint/issues/728)) ([8141f01](https://github.com/typescript-eslint/typescript-eslint/commit/8141f01))
* **eslint-plugin:** added new rule typedef ([#581](https://github.com/typescript-eslint/typescript-eslint/issues/581)) ([35cc99b](https://github.com/typescript-eslint/typescript-eslint/commit/35cc99b))
* **eslint-plugin:** added new rule use-default-type-parameter ([#562](https://github.com/typescript-eslint/typescript-eslint/issues/562)) ([2b942ba](https://github.com/typescript-eslint/typescript-eslint/commit/2b942ba))
* **eslint-plugin:** move opinionated rules between configs ([#595](https://github.com/typescript-eslint/typescript-eslint/issues/595)) ([4893aec](https://github.com/typescript-eslint/typescript-eslint/commit/4893aec))
* **eslint-plugin:** remove deprecated rules ([#739](https://github.com/typescript-eslint/typescript-eslint/issues/739)) ([e32c7ad](https://github.com/typescript-eslint/typescript-eslint/commit/e32c7ad))


### BREAKING CHANGES

* removed some rules from recommended config
* recommended config changes are considered breaking
* by default we will now throw when a file is not in the `project` provided
* Merges both no-angle-bracket-type-assertion and no-object-literal-type-assertion into one rule
* **eslint-plugin:** both 'eslint-recommended' and 'recommended' have changed.
* **eslint-plugin:** removing rules
* changes config structure

```ts
type ArrayOption = 'array' | 'generic' | 'array-simple';
type Options = [
  {
    // default case for all arrays
    default: ArrayOption,
    // optional override for readonly arrays
    readonly?: ArrayOption,
  },
];
```
* **eslint-plugin:** changing default rule config
* Node 6 is no longer supported





# [1.13.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.12.0...v1.13.0) (2019-07-21)


### Bug Fixes

* Correct `@types/json-schema` dependency ([#675](https://github.com/typescript-eslint/typescript-eslint/issues/675)) ([a5398ce](https://github.com/typescript-eslint/typescript-eslint/commit/a5398ce))
* **eslint-plugin:** remove imports from typescript-estree ([#706](https://github.com/typescript-eslint/typescript-eslint/issues/706)) ([ceb2d32](https://github.com/typescript-eslint/typescript-eslint/commit/ceb2d32)), closes [#705](https://github.com/typescript-eslint/typescript-eslint/issues/705)
* **eslint-plugin:** undo breaking changes to recommended config ([93f72e3](https://github.com/typescript-eslint/typescript-eslint/commit/93f72e3))


### Features

* **eslint-plugin:** add new rule no-misused-promises ([#612](https://github.com/typescript-eslint/typescript-eslint/issues/612)) ([28a131d](https://github.com/typescript-eslint/typescript-eslint/commit/28a131d))
* **eslint-plugin:** add new rule require-await ([#674](https://github.com/typescript-eslint/typescript-eslint/issues/674)) ([807bc2d](https://github.com/typescript-eslint/typescript-eslint/commit/807bc2d))





# [1.12.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.11.0...v1.12.0) (2019-07-12)


### Bug Fixes

* **eslint-plugin:** handle `const;` ([#633](https://github.com/typescript-eslint/typescript-eslint/issues/633)) ([430d628](https://github.com/typescript-eslint/typescript-eslint/commit/430d628)), closes [#441](https://github.com/typescript-eslint/typescript-eslint/issues/441)


### Features

* **eslint-plugin:** [ban-types] Support namespaced type ([#616](https://github.com/typescript-eslint/typescript-eslint/issues/616)) ([e325b72](https://github.com/typescript-eslint/typescript-eslint/commit/e325b72))
* **eslint-plugin:** [explicit-function-return-type] add handling for usage as arguments ([#680](https://github.com/typescript-eslint/typescript-eslint/issues/680)) ([e0aeb18](https://github.com/typescript-eslint/typescript-eslint/commit/e0aeb18))
* **eslint-plugin:** [no-explicit-any] Add an optional fixer ([#609](https://github.com/typescript-eslint/typescript-eslint/issues/609)) ([606fc70](https://github.com/typescript-eslint/typescript-eslint/commit/606fc70))
* **eslint-plugin:** Add rule no-reference-import ([#625](https://github.com/typescript-eslint/typescript-eslint/issues/625)) ([af70a59](https://github.com/typescript-eslint/typescript-eslint/commit/af70a59))
* **eslint-plugin:** add rule strict-boolean-expressions ([#579](https://github.com/typescript-eslint/typescript-eslint/issues/579)) ([34e7d1e](https://github.com/typescript-eslint/typescript-eslint/commit/34e7d1e))
* **eslint-plugin:** added new rule prefer-readonly ([#555](https://github.com/typescript-eslint/typescript-eslint/issues/555)) ([76b89a5](https://github.com/typescript-eslint/typescript-eslint/commit/76b89a5))





# [1.11.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.10.2...v1.11.0) (2019-06-23)


### Bug Fixes

* **eslint-plugin:** [no-magic-numbers] add support for enums ([#543](https://github.com/typescript-eslint/typescript-eslint/issues/543)) ([5c40d01](https://github.com/typescript-eslint/typescript-eslint/commit/5c40d01))
* **eslint-plugin:** [promise-function-async] allow any as return value ([#553](https://github.com/typescript-eslint/typescript-eslint/issues/553)) ([9a387b0](https://github.com/typescript-eslint/typescript-eslint/commit/9a387b0))


### Features

* **eslint-plugin:** [no-explicit-any] ignoreRestArgs ([#548](https://github.com/typescript-eslint/typescript-eslint/issues/548)) ([753ad75](https://github.com/typescript-eslint/typescript-eslint/commit/753ad75))
* **eslint-plugin:** add `consistent-type-definitions` rule ([#463](https://github.com/typescript-eslint/typescript-eslint/issues/463)) ([ec87d06](https://github.com/typescript-eslint/typescript-eslint/commit/ec87d06))
* **eslint-plugin:** add new rule no-empty-function ([#626](https://github.com/typescript-eslint/typescript-eslint/issues/626)) ([747bfcb](https://github.com/typescript-eslint/typescript-eslint/commit/747bfcb))
* **eslint-plugin:** add new rule no-floating-promises ([#495](https://github.com/typescript-eslint/typescript-eslint/issues/495)) ([61e6385](https://github.com/typescript-eslint/typescript-eslint/commit/61e6385))





## [1.10.2](https://github.com/typescript-eslint/typescript-eslint/compare/v1.10.1...v1.10.2) (2019-06-10)

### Bug Fixes

- **eslint-plugin:** peerDep should specify semver major range ([#602](https://github.com/typescript-eslint/typescript-eslint/issues/602)) ([5589938](https://github.com/typescript-eslint/typescript-eslint/commit/5589938))

## [1.10.1](https://github.com/typescript-eslint/typescript-eslint/compare/v1.10.0...v1.10.1) (2019-06-09)

**Note:** Version bump only for package @typescript-eslint/eslint-plugin

# [1.10.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.9.0...v1.10.0) (2019-06-09)

### Bug Fixes

- **eslint-plugin:** [explicit-function-return-type] Fix obj setter prop ([8c8497c](https://github.com/typescript-eslint/typescript-eslint/commit/8c8497c)), closes [#525](https://github.com/typescript-eslint/typescript-eslint/issues/525)
- **eslint-plugin:** [no-extra-parens] Fix crash default switch case crash ([5ec2b32](https://github.com/typescript-eslint/typescript-eslint/commit/5ec2b32)), closes [#509](https://github.com/typescript-eslint/typescript-eslint/issues/509)
- **eslint-plugin:** [no-type-alias] Fix parenthesized type handling ([#576](https://github.com/typescript-eslint/typescript-eslint/issues/576)) ([6489293](https://github.com/typescript-eslint/typescript-eslint/commit/6489293))
- **eslint-plugin:** [NUTA] false positive for null assign to undefined ([#536](https://github.com/typescript-eslint/typescript-eslint/issues/536)) ([b16409a](https://github.com/typescript-eslint/typescript-eslint/commit/b16409a)), closes [#529](https://github.com/typescript-eslint/typescript-eslint/issues/529)
- **eslint-plugin:** Remove `no-dupe-class-members` from eslint-recommended ([#520](https://github.com/typescript-eslint/typescript-eslint/issues/520)) ([1a0e60b](https://github.com/typescript-eslint/typescript-eslint/commit/1a0e60b))

### Features

- make utils/TSESLint export typed classes instead of just types ([#526](https://github.com/typescript-eslint/typescript-eslint/issues/526)) ([370ac72](https://github.com/typescript-eslint/typescript-eslint/commit/370ac72))
- support TypeScript versions >=3.2.1 <3.6.0 ([#597](https://github.com/typescript-eslint/typescript-eslint/issues/597)) ([5d2b962](https://github.com/typescript-eslint/typescript-eslint/commit/5d2b962))
- **eslint-plugin:** [explicit-function-return-type] allowHigherOrderFunctions ([#193](https://github.com/typescript-eslint/typescript-eslint/issues/193)) ([#538](https://github.com/typescript-eslint/typescript-eslint/issues/538)) ([50a493e](https://github.com/typescript-eslint/typescript-eslint/commit/50a493e))
- **eslint-plugin:** add config all.json ([#313](https://github.com/typescript-eslint/typescript-eslint/issues/313)) ([67537b8](https://github.com/typescript-eslint/typescript-eslint/commit/67537b8))

# [1.9.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.8.0...v1.9.0) (2019-05-12)

### Bug Fixes

- **eslint-plugin:** Add missing dependency ([89c87cc](https://github.com/typescript-eslint/typescript-eslint/commit/89c87cc)), closes [#516](https://github.com/typescript-eslint/typescript-eslint/issues/516)
- **eslint-plugin:** Fix exported name of eslint-recommended ([#513](https://github.com/typescript-eslint/typescript-eslint/issues/513)) ([5c65350](https://github.com/typescript-eslint/typescript-eslint/commit/5c65350))

### Features

- **eslint-plugin:** add prefer-regexp-exec rule ([#305](https://github.com/typescript-eslint/typescript-eslint/issues/305)) ([f61d421](https://github.com/typescript-eslint/typescript-eslint/commit/f61d421))

# [1.8.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.7.0...v1.8.0) (2019-05-10)

### Bug Fixes

- **eslint-plugin:** [array-type] support readonly operator ([#429](https://github.com/typescript-eslint/typescript-eslint/issues/429)) ([8e2d2f5](https://github.com/typescript-eslint/typescript-eslint/commit/8e2d2f5))
- **eslint-plugin:** [explicit-function-return-type] Add handling for class properties ([#502](https://github.com/typescript-eslint/typescript-eslint/issues/502)) ([2c36325](https://github.com/typescript-eslint/typescript-eslint/commit/2c36325))
- **eslint-plugin:** [no-extra-parens] Fix build error ([298d66c](https://github.com/typescript-eslint/typescript-eslint/commit/298d66c))
- **eslint-plugin:** [unbound-method] Work around class prototype bug ([#499](https://github.com/typescript-eslint/typescript-eslint/issues/499)) ([3219aa7](https://github.com/typescript-eslint/typescript-eslint/commit/3219aa7))
- **eslint-plugin:** correct eslint-recommended settings ([d52a683](https://github.com/typescript-eslint/typescript-eslint/commit/d52a683))
- **eslint-plugin:** explicit-func-return-type: support object types and as expressions ([#459](https://github.com/typescript-eslint/typescript-eslint/issues/459)) ([d19e512](https://github.com/typescript-eslint/typescript-eslint/commit/d19e512))
- **eslint-plugin:** restrict-plus-operands: generic constraint support ([#440](https://github.com/typescript-eslint/typescript-eslint/issues/440)) ([3f305b1](https://github.com/typescript-eslint/typescript-eslint/commit/3f305b1))
- **eslint-plugin:** Support more nodes [no-extra-parens](<[#465](https://github.com/typescript-eslint/typescript-eslint/issues/465)>) ([2d15644](https://github.com/typescript-eslint/typescript-eslint/commit/2d15644))
- **eslint-plugin:** support switch statement [unbound-method](<[#485](https://github.com/typescript-eslint/typescript-eslint/issues/485)>) ([e99ca81](https://github.com/typescript-eslint/typescript-eslint/commit/e99ca81))

### Features

- **eslint-plugin:** (EXPERIMENTAL) begin indent rewrite ([#439](https://github.com/typescript-eslint/typescript-eslint/issues/439)) ([6eb97d4](https://github.com/typescript-eslint/typescript-eslint/commit/6eb97d4))
- **eslint-plugin:** Add better non-null handling [no-unnecessary-type-assertion](<[#478](https://github.com/typescript-eslint/typescript-eslint/issues/478)>) ([4cd5590](https://github.com/typescript-eslint/typescript-eslint/commit/4cd5590))
- **eslint-plugin:** Add func-call-spacing ([#448](https://github.com/typescript-eslint/typescript-eslint/issues/448)) ([92e65ec](https://github.com/typescript-eslint/typescript-eslint/commit/92e65ec))
- **eslint-plugin:** Add new config "eslint-recommended" ([#488](https://github.com/typescript-eslint/typescript-eslint/issues/488)) ([2600a9f](https://github.com/typescript-eslint/typescript-eslint/commit/2600a9f))
- **eslint-plugin:** add no-magic-numbers rule ([#373](https://github.com/typescript-eslint/typescript-eslint/issues/373)) ([43fa09c](https://github.com/typescript-eslint/typescript-eslint/commit/43fa09c))
- **eslint-plugin:** Add semi [extension](<[#461](https://github.com/typescript-eslint/typescript-eslint/issues/461)>) ([0962017](https://github.com/typescript-eslint/typescript-eslint/commit/0962017))
- **eslint-plugin:** no-inferrable-types: Support more primitives ([#442](https://github.com/typescript-eslint/typescript-eslint/issues/442)) ([4e193ca](https://github.com/typescript-eslint/typescript-eslint/commit/4e193ca))
- Move shared types into their own package ([#425](https://github.com/typescript-eslint/typescript-eslint/issues/425)) ([a7a03ce](https://github.com/typescript-eslint/typescript-eslint/commit/a7a03ce))

# [1.7.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.6.0...v1.7.0) (2019-04-20)

### Bug Fixes

- **eslint-plugin:** indent: fix false positive on type parameters ([#385](https://github.com/typescript-eslint/typescript-eslint/issues/385)) ([d476f15](https://github.com/typescript-eslint/typescript-eslint/commit/d476f15))
- **eslint-plugin:** no-object-literal-type-assertion: fix `as const` is reported ([#390](https://github.com/typescript-eslint/typescript-eslint/issues/390)) ([2521b85](https://github.com/typescript-eslint/typescript-eslint/commit/2521b85))
- **eslint-plugin:** support BigInt in restrict-plus-operands rule ([#344](https://github.com/typescript-eslint/typescript-eslint/issues/344)) ([eee6d49](https://github.com/typescript-eslint/typescript-eslint/commit/eee6d49)), closes [#309](https://github.com/typescript-eslint/typescript-eslint/issues/309)

### Features

- **eslint-plugin:** [member-accessibility] add more options ([#322](https://github.com/typescript-eslint/typescript-eslint/issues/322)) ([4b3d820](https://github.com/typescript-eslint/typescript-eslint/commit/4b3d820))
- **eslint-plugin:** add prefer-for-of rule ([#338](https://github.com/typescript-eslint/typescript-eslint/issues/338)) ([3e26ab6](https://github.com/typescript-eslint/typescript-eslint/commit/3e26ab6))
- **eslint-plugin:** add prefer-includes rule ([#294](https://github.com/typescript-eslint/typescript-eslint/issues/294)) ([01c4dae](https://github.com/typescript-eslint/typescript-eslint/commit/01c4dae)), closes [#284](https://github.com/typescript-eslint/typescript-eslint/issues/284)
- **eslint-plugin:** add prefer-string-starts-ends-with rule ([#289](https://github.com/typescript-eslint/typescript-eslint/issues/289)) ([5592a2c](https://github.com/typescript-eslint/typescript-eslint/commit/5592a2c)), closes [#285](https://github.com/typescript-eslint/typescript-eslint/issues/285)
- **eslint-plugin:** added new rule await-promise ([#192](https://github.com/typescript-eslint/typescript-eslint/issues/192)) ([5311342](https://github.com/typescript-eslint/typescript-eslint/commit/5311342))
- **eslint-plugin:** added new rule unbound-method ([#204](https://github.com/typescript-eslint/typescript-eslint/issues/204)) ([6718906](https://github.com/typescript-eslint/typescript-eslint/commit/6718906))
- **eslint-plugin:** support type assertions in no-extra-parens rule ([#311](https://github.com/typescript-eslint/typescript-eslint/issues/311)) ([116ca75](https://github.com/typescript-eslint/typescript-eslint/commit/116ca75))

# [1.6.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.5.0...v1.6.0) (2019-04-03)

### Bug Fixes

- **eslint-plugin:** explicit-function-return-type: ensure class arrow methods are validated ([#377](https://github.com/typescript-eslint/typescript-eslint/issues/377)) ([643a223](https://github.com/typescript-eslint/typescript-eslint/commit/643a223)), closes [#348](https://github.com/typescript-eslint/typescript-eslint/issues/348)
- **eslint-plugin:** Fix `allowExpressions` false positives in explicit-function-return-type and incorrect documentation ([#388](https://github.com/typescript-eslint/typescript-eslint/issues/388)) ([f29d1c9](https://github.com/typescript-eslint/typescript-eslint/commit/f29d1c9)), closes [#387](https://github.com/typescript-eslint/typescript-eslint/issues/387)
- **eslint-plugin:** member-naming false flagging constructors ([#376](https://github.com/typescript-eslint/typescript-eslint/issues/376)) ([ad0f2be](https://github.com/typescript-eslint/typescript-eslint/commit/ad0f2be)), closes [#359](https://github.com/typescript-eslint/typescript-eslint/issues/359)
- **eslint-plugin:** no-type-alias: fix typeof alias erroring ([#380](https://github.com/typescript-eslint/typescript-eslint/issues/380)) ([cebcfe6](https://github.com/typescript-eslint/typescript-eslint/commit/cebcfe6))

### Features

- change TypeScript version range to >=3.2.1 <3.5.0 ([#399](https://github.com/typescript-eslint/typescript-eslint/issues/399)) ([a4f95d3](https://github.com/typescript-eslint/typescript-eslint/commit/a4f95d3))
- **eslint-plugin:** allow explicit variable type with arrow functions ([#260](https://github.com/typescript-eslint/typescript-eslint/issues/260)) ([bea6b92](https://github.com/typescript-eslint/typescript-eslint/commit/bea6b92)), closes [#149](https://github.com/typescript-eslint/typescript-eslint/issues/149)

# [1.5.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.4.2...v1.5.0) (2019-03-20)

### Bug Fixes

- **eslint-plugin:** [interface-name-prefix] correct error message in always mode ([#333](https://github.com/typescript-eslint/typescript-eslint/issues/333)) ([097262f](https://github.com/typescript-eslint/typescript-eslint/commit/097262f))
- **eslint-plugin:** fix false positives for adjacent-overload-signatures regarding computed property names ([#340](https://github.com/typescript-eslint/typescript-eslint/issues/340)) ([f6e5118](https://github.com/typescript-eslint/typescript-eslint/commit/f6e5118))
- **eslint-plugin:** fix incorrect rule name ([#357](https://github.com/typescript-eslint/typescript-eslint/issues/357)) ([0a5146b](https://github.com/typescript-eslint/typescript-eslint/commit/0a5146b))

### Features

- **eslint-plugin:** Add unified-signature rule ([#178](https://github.com/typescript-eslint/typescript-eslint/issues/178)) ([6ffaa0b](https://github.com/typescript-eslint/typescript-eslint/commit/6ffaa0b))

## [1.4.2](https://github.com/typescript-eslint/typescript-eslint/compare/v1.4.1...v1.4.2) (2019-02-25)

**Note:** Version bump only for package @typescript-eslint/eslint-plugin

## [1.4.1](https://github.com/typescript-eslint/typescript-eslint/compare/v1.4.0...v1.4.1) (2019-02-23)

### Bug Fixes

- **eslint-plugin:** out-of-bounds access in member-ordering rule ([#304](https://github.com/typescript-eslint/typescript-eslint/issues/304)) ([4526f27](https://github.com/typescript-eslint/typescript-eslint/commit/4526f27))
- **eslint-plugin:** support BigInt in restrict-plus-operands rule ([#309](https://github.com/typescript-eslint/typescript-eslint/issues/309)) ([#310](https://github.com/typescript-eslint/typescript-eslint/issues/310)) ([9a88363](https://github.com/typescript-eslint/typescript-eslint/commit/9a88363))

# [1.4.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.3.0...v1.4.0) (2019-02-19)

### Bug Fixes

- **parser:** fix crash when visiting decorators in parameters ([#237](https://github.com/typescript-eslint/typescript-eslint/issues/237)) ([225fc26](https://github.com/typescript-eslint/typescript-eslint/commit/225fc26))
- **parser:** fix visiting props of TSDeclareFunction ([#244](https://github.com/typescript-eslint/typescript-eslint/issues/244)) ([b40def8](https://github.com/typescript-eslint/typescript-eslint/commit/b40def8))
- **ts-estree:** make sure that every node can be converted to tsNode ([#287](https://github.com/typescript-eslint/typescript-eslint/issues/287)) ([9f1d314](https://github.com/typescript-eslint/typescript-eslint/commit/9f1d314))
- **typescript-estree, eslint-plugin:** stop adding ParenthesizedExpressions to node maps ([#226](https://github.com/typescript-eslint/typescript-eslint/issues/226)) ([317405a](https://github.com/typescript-eslint/typescript-eslint/commit/317405a))

### Features

- **eslint-plugin:** add 'no-unnecessary-qualifier' rule ([#231](https://github.com/typescript-eslint/typescript-eslint/issues/231)) ([cc8f906](https://github.com/typescript-eslint/typescript-eslint/commit/cc8f906))
- **eslint-plugin:** add ban-ts-ignore rule ([#276](https://github.com/typescript-eslint/typescript-eslint/issues/276)) ([859ab29](https://github.com/typescript-eslint/typescript-eslint/commit/859ab29))
- **eslint-plugin:** add prefer-function-type rule ([#222](https://github.com/typescript-eslint/typescript-eslint/issues/222)) ([b95c4cf](https://github.com/typescript-eslint/typescript-eslint/commit/b95c4cf))
- **eslint-plugin:** add require-array-sort-compare rule ([#261](https://github.com/typescript-eslint/typescript-eslint/issues/261)) ([2a4aaaa](https://github.com/typescript-eslint/typescript-eslint/commit/2a4aaaa)), closes [#247](https://github.com/typescript-eslint/typescript-eslint/issues/247)
- **eslint-plugin:** Migrate plugin to ts ([#120](https://github.com/typescript-eslint/typescript-eslint/issues/120)) ([61c60dc](https://github.com/typescript-eslint/typescript-eslint/commit/61c60dc))
- **eslint-plugin:** update types to allow parameter type inferrence ([#272](https://github.com/typescript-eslint/typescript-eslint/issues/272)) ([80bd72c](https://github.com/typescript-eslint/typescript-eslint/commit/80bd72c))
- **no-empty-interface:** add allowSingleExtend option ([#215](https://github.com/typescript-eslint/typescript-eslint/issues/215)) ([bf46f8c](https://github.com/typescript-eslint/typescript-eslint/commit/bf46f8c))

# [1.3.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.2.0...v1.3.0) (2019-02-07)

### Bug Fixes

- **eslint-plugin:** fix false positive from adjacent-overload-signatures ([#206](https://github.com/typescript-eslint/typescript-eslint/issues/206)) ([07e950e](https://github.com/typescript-eslint/typescript-eslint/commit/07e950e))

### Features

- change TypeScript version range to >=3.2.1 <3.4.0 ([#184](https://github.com/typescript-eslint/typescript-eslint/issues/184)) ([f513a14](https://github.com/typescript-eslint/typescript-eslint/commit/f513a14))
- **eslint-plugin:** add new rule no-for-in-array ([#155](https://github.com/typescript-eslint/typescript-eslint/issues/155)) ([84162ba](https://github.com/typescript-eslint/typescript-eslint/commit/84162ba))
- **eslint-plugin:** add new rule no-require-imports ([#199](https://github.com/typescript-eslint/typescript-eslint/issues/199)) ([683e5bc](https://github.com/typescript-eslint/typescript-eslint/commit/683e5bc))
- **eslint-plugin:** added new rule promise-function-async ([#194](https://github.com/typescript-eslint/typescript-eslint/issues/194)) ([5f3aec9](https://github.com/typescript-eslint/typescript-eslint/commit/5f3aec9))

# [1.2.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.1.1...v1.2.0) (2019-02-01)

### Bug Fixes

- **eslint-plugin:** fix no-extraneous-class for class without name ([#174](https://github.com/typescript-eslint/typescript-eslint/issues/174)) ([b1dbb64](https://github.com/typescript-eslint/typescript-eslint/commit/b1dbb64))
- **eslint-plugin:** fix wrong URL ([#180](https://github.com/typescript-eslint/typescript-eslint/issues/180)) ([00d020d](https://github.com/typescript-eslint/typescript-eslint/commit/00d020d))
- **eslint-plugin:** use bracket for infer type in array-type rule ([#173](https://github.com/typescript-eslint/typescript-eslint/issues/173)) ([1f868ce](https://github.com/typescript-eslint/typescript-eslint/commit/1f868ce))
- **parser:** fix regression with no-unused-vars for jsx attributes ([#161](https://github.com/typescript-eslint/typescript-eslint/issues/161)) ([6147de1](https://github.com/typescript-eslint/typescript-eslint/commit/6147de1))

### Features

- **eslint-plugin:** add eslint rule no-useless-constructor ([#167](https://github.com/typescript-eslint/typescript-eslint/issues/167)) ([3fb57a5](https://github.com/typescript-eslint/typescript-eslint/commit/3fb57a5))
- **eslint-plugin:** add no-unnecessary-type-assertion rule ([#157](https://github.com/typescript-eslint/typescript-eslint/issues/157)) ([38abc28](https://github.com/typescript-eslint/typescript-eslint/commit/38abc28))

## [1.1.1](https://github.com/typescript-eslint/typescript-eslint/compare/v1.1.0...v1.1.1) (2019-01-29)

### Bug Fixes

- **eslint-plugin:** make parser services error clearer ([#132](https://github.com/typescript-eslint/typescript-eslint/issues/132)) ([aa9d1e1](https://github.com/typescript-eslint/typescript-eslint/commit/aa9d1e1))
- **parser:** add visiting of type parameters in JSXOpeningElement ([#150](https://github.com/typescript-eslint/typescript-eslint/issues/150)) ([5e16003](https://github.com/typescript-eslint/typescript-eslint/commit/5e16003))

# [1.1.0](https://github.com/typescript-eslint/typescript-eslint/compare/v1.0.0...v1.1.0) (2019-01-23)

### Bug Fixes

- **eslint-plugin:** don’t mark `declare class` as unused ([#110](https://github.com/typescript-eslint/typescript-eslint/issues/110)) ([5841cd2](https://github.com/typescript-eslint/typescript-eslint/commit/5841cd2)), closes [#106](https://github.com/typescript-eslint/typescript-eslint/issues/106)
- **eslint-plugin:** improve detection of used vars in heritage ([#102](https://github.com/typescript-eslint/typescript-eslint/issues/102)) ([193b434](https://github.com/typescript-eslint/typescript-eslint/commit/193b434))

### Features

- **eslint-plugin:** add new rule restrict-plus-operands ([#70](https://github.com/typescript-eslint/typescript-eslint/issues/70)) ([c541ede](https://github.com/typescript-eslint/typescript-eslint/commit/c541ede))
- **eslint-plugin:** add option to no-object-literal-type-assertion rule ([#87](https://github.com/typescript-eslint/typescript-eslint/issues/87)) ([9f501a1](https://github.com/typescript-eslint/typescript-eslint/commit/9f501a1))

# [1.0.0](https://github.com/typescript-eslint/typescript-eslint/compare/v0.2.1...v1.0.0) (2019-01-20)

### Bug Fixes

- **eslint-plugin:** fix crash in rule indent for eslint 5.12.1 ([#89](https://github.com/typescript-eslint/typescript-eslint/issues/89)) ([3f51d51](https://github.com/typescript-eslint/typescript-eslint/commit/3f51d51))
- **eslint-plugin:** no-unused-vars: mark declared statements as used ([#88](https://github.com/typescript-eslint/typescript-eslint/issues/88)) ([2df5e0c](https://github.com/typescript-eslint/typescript-eslint/commit/2df5e0c))
- **eslint-plugin:** update remaining parser refs ([#97](https://github.com/typescript-eslint/typescript-eslint/issues/97)) ([055c3fc](https://github.com/typescript-eslint/typescript-eslint/commit/055c3fc))

### Features

- **eslint-plugin:** remove exported parser ([#94](https://github.com/typescript-eslint/typescript-eslint/issues/94)) ([0ddb93c](https://github.com/typescript-eslint/typescript-eslint/commit/0ddb93c))

## [0.2.1](https://github.com/typescript-eslint/typescript-eslint/compare/v0.2.0...v0.2.1) (2019-01-20)

**Note:** Version bump only for package @typescript-eslint/eslint-plugin
