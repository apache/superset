# Changelog

## v2.7.0 (2018-09-26)

* Update: Support prettierignore and custom processors ([#111](https://github.com/prettier/eslint-plugin-prettier/issues/111)) ([38537ba](https://github.com/prettier/eslint-plugin-prettier/commit/38537ba35fc9152852c3b91f3041d72556b43013))
* Build: switch to release script package ([047dc8f](https://github.com/prettier/eslint-plugin-prettier/commit/047dc8ffdf006c74267df4902fec684c589dad12))

## v2.6.2 (2018-07-06)

* Fix: Add representation for \r to showInvisibles ([#100](https://github.com/prettier/eslint-plugin-prettier/issues/100)) ([731bbb5](https://github.com/prettier/eslint-plugin-prettier/commit/731bbb576ce422a5c73a1fa9750aa3466c7da928))
* Docs: Add clarification about Flow/React support to readme ([#96](https://github.com/prettier/eslint-plugin-prettier/issues/96)) ([977aa77](https://github.com/prettier/eslint-plugin-prettier/commit/977aa77a119f22af3f8ca8d6f47e5bcfcc9e23fb))

## v2.6.1 (2018-06-23)

* Fix: respect editorconfig ([#92](https://github.com/prettier/eslint-plugin-prettier/issues/92)) ([0b04dd3](https://github.com/prettier/eslint-plugin-prettier/commit/0b04dd362d0d92534a7cf11eaebbab8eb59fc96d))

## v2.6.0 (2018-02-02)

* Update: Add option to skip loading prettierrc ([#83](https://github.com/prettier/eslint-plugin-prettier/issues/83)) ([9e0fb48](https://github.com/prettier/eslint-plugin-prettier/commit/9e0fb48d077214a81ac549731308ab11512c37cd))
* Build: add Node 8 and 9 to Travis ([e5b5fa7](https://github.com/prettier/eslint-plugin-prettier/commit/e5b5fa74d06a06a53d04c4748b31e24fcd7a41b9))
* Chore: add test for vue parsing ([1ab43fd](https://github.com/prettier/eslint-plugin-prettier/commit/1ab43fd601a67100cb03bbfe614203fd399d40bb))

## v2.5.0 (2018-01-16)

* Fix: pass filepath to prettier ([#76](https://github.com/prettier/eslint-plugin-prettier/issues/76)) ([0b6ab55](https://github.com/prettier/eslint-plugin-prettier/commit/0b6ab55e0a48e9c31cfa1d7f3b891100e0580493))
* Update: Add URL to rule documentation to the metadata ([#75](https://github.com/prettier/eslint-plugin-prettier/issues/75)) ([804ead7](https://github.com/prettier/eslint-plugin-prettier/commit/804ead7406e12024a1f9c28628024e5d63b75854))

## v2.4.0 (2017-12-17)

* New: Add 'recommended' configuration ([#73](https://github.com/prettier/eslint-plugin-prettier/issues/73)) ([e529b60](https://github.com/prettier/eslint-plugin-prettier/commit/e529b6004b278fb8de660c75d69381ea071b2114))
* Docs: Create ISSUE_TEMPLATE.md ([4335b08](https://github.com/prettier/eslint-plugin-prettier/commit/4335b08f2956f695eda20f9ca41653fe15b6538d))

## v2.3.1 (2017-09-18)

* Fix: Guard against older prettier installation ([#56](https://github.com/prettier/eslint-plugin-prettier/issues/56)) ([8a115f9](https://github.com/prettier/eslint-plugin-prettier/commit/8a115f9cc57dc20c9fc5c2b942f1e4770a5d730e))

## v2.3.0 (2017-09-18)

* Update: Support .prettierrc config files (fixes [#46](https://github.com/prettier/eslint-plugin-prettier/issues/46)) ([#55](https://github.com/prettier/eslint-plugin-prettier/issues/55)) ([bc89153](https://github.com/prettier/eslint-plugin-prettier/commit/bc89153ffa733b3b58f123849485d7990577c216))
* Docs: .eslintrc.json > .eslintrc ([#52](https://github.com/prettier/eslint-plugin-prettier/issues/52)) ([95f0808](https://github.com/prettier/eslint-plugin-prettier/commit/95f0808416f7493426c822790d79cf22b0db0f22))
* Upgrade: jest-docblock to ^21.0.0 ([#50](https://github.com/prettier/eslint-plugin-prettier/issues/50)) ([c777111](https://github.com/prettier/eslint-plugin-prettier/commit/c777111a526c87236b8853d7e253ee93ac1d988d))
* Chore: upgrade prettier to ^1.6.1 ([#49](https://github.com/prettier/eslint-plugin-prettier/issues/49)) ([56deffa](https://github.com/prettier/eslint-plugin-prettier/commit/56deffae056c0165a7ed2b993b7cf78b6c71148a))
* Chore: use eslint-plugin-self for linting ([#47](https://github.com/prettier/eslint-plugin-prettier/issues/47)) ([5ea0526](https://github.com/prettier/eslint-plugin-prettier/commit/5ea05269cc947c2e30a42e5101140ab6faac311a))

## v2.2.0 (2017-08-16)

* New: expose reporter api (fixes [#39](https://github.com/prettier/eslint-plugin-prettier/issues/39)) ([#41](https://github.com/prettier/eslint-plugin-prettier/issues/41)) ([1666067](https://github.com/prettier/eslint-plugin-prettier/commit/1666067aa396dfe6a622eb1d9fd5d21fa851a612))

## v2.1.2 (2017-06-14)

* Chore: Relax peerDependencies ([#30](https://github.com/prettier/eslint-plugin-prettier/issues/30)) ([a19b8af](https://github.com/prettier/eslint-plugin-prettier/commit/a19b8afc5b3e7a05468e1c566d359f80f13b80cd))
* Chore: Add release script ([#25](https://github.com/prettier/eslint-plugin-prettier/issues/25)) ([8fbfe73](https://github.com/prettier/eslint-plugin-prettier/commit/8fbfe73ec2cdba4c313e9e3add4b602fc3166ab8))

## v2.1.1 (2017-05-19)

* Fix: Support ESLint <3.11.0 ([#24](git@github.com:prettier/eslint-plugin-prettier/issues/24)) ([fde7fdf](git@github.com:prettier/eslint-plugin-prettier/commit/fde7fdf2e2dcb3a1f164e1fddb337070802d2c68))
* Chore: add yarn.lock ([#23](git@github.com:prettier/eslint-plugin-prettier/issues/23)) ([8b55518](git@github.com:prettier/eslint-plugin-prettier/commit/8b555187937a7e37ad84324c4331478b04898493))
* Docs: fix links in changelog ([#22](git@github.com:prettier/eslint-plugin-prettier/issues/22)) ([7e70e11](git@github.com:prettier/eslint-plugin-prettier/commit/7e70e11de37ca77f5aeb3dcdb216e1a421b54f0d))

## v2.1.0 (2017-05-16)

* Merge with eslint-plugin-prettify ([#21](https://github.com/prettier/eslint-plugin-prettier/issues/21)) ([6de494f](https://github.com/prettier/eslint-plugin-prettier/commit/6de494fd685a107f3a9a371e663a1f8d68d6d31f))
* Docs: update repo links to new URL ([#18](https://github.com/prettier/eslint-plugin-prettier/issues/18)) ([6b69492](https://github.com/prettier/eslint-plugin-prettier/commit/6b694928e6e6c192dcb06e6287272fb40cbad17d))
* Chore: Upgrade development dependencies ([#16](https://github.com/prettier/eslint-plugin-prettier/issues/16)) ([12984ea](https://github.com/prettier/eslint-plugin-prettier/commit/12984ead6c46156b25607c9a8b03ae17def7ef9e))
* Docs: fix outdated info about prettier's semicolon support ([da6aad1](https://github.com/prettier/eslint-plugin-prettier/commit/da6aad15ea22aa899b26b5ce0979f4a945d80319))
* Docs: update prettier options in example ([#14](https://github.com/prettier/eslint-plugin-prettier/issues/14)) ([0ae173f](https://github.com/prettier/eslint-plugin-prettier/commit/0ae173f2731b02c0ed72a6cb49efdbdcff54a419))
* Docs: Change the order of dependencies install ([#13](https://github.com/prettier/eslint-plugin-prettier/issues/13)) ([cbf803c](https://github.com/prettier/eslint-plugin-prettier/commit/cbf803ccf0add6e324ae1513b5260e31bf9a3c05))
* Docs: Add CONTRIBUTING.md (fixes [#9](https://github.com/prettier/eslint-plugin-prettier/issues/9)) ([40fe55b](https://github.com/prettier/eslint-plugin-prettier/commit/40fe55b3d8c000787b0dcbfa0aed4f0d930808a9))

## v2.0.1 (2017-02-26)

* Docs: add travis badge to README.md ([1daa495](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/1daa49558a7f904f8d307d3d434a9bc80f41fee6))
* Upgrade: prettier to 0.18.0 ([1700e41](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/1700e41b2c66721b521e766052cfaa3cc59cd219))
* Chore: use eslint-config-prettier ([c979b84](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/c979b84641c42f8870c21c69d22b75916c8511e0))
* Fix: avoid relying on an internal eslint function ([5296930](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/5296930386ef28a26e0f5c606d107e4293f51620))
* Docs: mention eslint-config-prettier in README.md ([3fd855d](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/3fd855dfb356c8616c19b51b70eb5fcb8fb90c9c))
* Chore: pin the version of prettier used to lint this module (refs [#1](https://github.com/not-an-aardvark/eslint-plugin-prettier/issues/1)) ([db85633](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/db85633a0360caeebbf5b20195a3bc19ebf7177a))

## v2.0.0 (2017-01-28)

* Docs: create changelog ([d388095](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/d388095314f5c23b12df2b210219dca4cb31cb2d))
* Docs: add 2.0.0 migration guide ([db508d7](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/db508d709c92ce60eee6f9f879af44c8d0b44d1d))
* Breaking: Make prettier a peerDependency ([#1](https://github.com/not-an-aardvark/eslint-plugin-prettier/issues/1)) ([d8a8992](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/d8a89922ddc6b747c474b62a0948deba6ea2657d))
* Docs: add repo url to package.json ([2474bc9](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/2474bc9dd3f05dbd0b1fec38e27bc91a9cb0f1c7))
* Docs: suggest prettier-eslint if eslint rules disagree with prettier ([3414437](https://github.com/not-an-aardvark/eslint-plugin-prettier/commit/341443754ae231a17d82f037f8b35663257d282a))
