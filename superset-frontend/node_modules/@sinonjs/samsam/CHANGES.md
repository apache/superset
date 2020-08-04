# Changes

## 5.0.3

- [`9d2add0`](https://github.com/sinonjs/samsam/commit/9d2add01eba85eb17ddb91ac22404fb6c23e8d39)
  Remove unused @sinonjs/formatio (Morgan Roderick)
    >
    > As can be seen with searching the codebase, @sinonjs/formatio is never
    > imported, and is thus not a direct dependency of @sinonjs/samsam.
    >

_Released on 2020-02-28._

## 5.0.2

- [`f9e845a`](https://github.com/sinonjs/samsam/commit/f9e845a52ba50916df91335d2003a81a808a4ade)
  Bump formatio to latest major (Morgan Roderick)
    >
    > This will remove some duplication in Sinon, see https://github.com/sinonjs/sinon/issues/2224
    >

_Released on 2020-02-20._

## 5.0.1

- [`fe5d035`](https://github.com/sinonjs/samsam/commit/fe5d03532ea6cdbec857c49d18392d668cca8ef2)
  Bump jsdom from 15.2.1 to 16.2.0 (dependabot-preview[bot])
    >
    > Bumps [jsdom](https://github.com/jsdom/jsdom) from 15.2.1 to 16.2.0.
    > - [Release notes](https://github.com/jsdom/jsdom/releases)
    > - [Changelog](https://github.com/jsdom/jsdom/blob/master/Changelog.md)
    > - [Commits](https://github.com/jsdom/jsdom/compare/15.2.1...16.2.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`910af18`](https://github.com/sinonjs/samsam/commit/910af18be1bd57c6237399ca04cbef91d994a38a)
  Remove maintenance junk from CHANGES.md (Morgan Roderick)

_Released on 2020-02-18._

## 5.0.0

- [`f288430`](https://github.com/sinonjs/samsam/commit/f2884309c9bf68b02ecfda3bd1df8d7a7a31686b)
  Drop support for Node 8 (Morgan Roderick)
    >
    > As can be seen at https://github.com/nodejs/Release, Node 8 reached
    > "end" of life on 2019-12-31, and is no longer actively supported.
    >
    > We will stop testing in Node 8 and start testing in Node 13, which will
    > become the next LTS release from April 2020.
    >

_Released on 2020-02-18._

## 4.2.2

- [`c600d6c`](https://github.com/sinonjs/samsam/commit/c600d6cb6c1bec8d65bc718bd9268311204597bc)
  Fix issue with nested array matching (Jay Merrifield)
- [`8b37566`](https://github.com/sinonjs/samsam/commit/8b37566ea73bee512fbc4203c07678288f906bda)
  Bump eslint from 6.7.2 to 6.8.0 (dependabot-preview[bot])
    >
    > Bumps [eslint](https://github.com/eslint/eslint) from 6.7.2 to 6.8.0.
    > - [Release notes](https://github.com/eslint/eslint/releases)
    > - [Changelog](https://github.com/eslint/eslint/blob/master/CHANGELOG.md)
    > - [Commits](https://github.com/eslint/eslint/compare/v6.7.2...v6.8.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`b7c5db9`](https://github.com/sinonjs/samsam/commit/b7c5db9e7847204188c112843bb193248d0b5156)
  Bump eslint-plugin-prettier from 3.1.1 to 3.1.2 (dependabot-preview[bot])
    >
    > Bumps [eslint-plugin-prettier](https://github.com/prettier/eslint-plugin-prettier) from 3.1.1 to 3.1.2.
    > - [Release notes](https://github.com/prettier/eslint-plugin-prettier/releases)
    > - [Changelog](https://github.com/prettier/eslint-plugin-prettier/blob/master/CHANGELOG.md)
    > - [Commits](https://github.com/prettier/eslint-plugin-prettier/compare/v3.1.1...v3.1.2)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`8965384`](https://github.com/sinonjs/samsam/commit/8965384818697b7b36537619922b3c378bfd0b42)
  Bump eslint-plugin-mocha from 6.1.1 to 6.2.2 (dependabot-preview[bot])
    >
    > Bumps [eslint-plugin-mocha](https://github.com/lo1tuma/eslint-plugin-mocha) from 6.1.1 to 6.2.2.
    > - [Release notes](https://github.com/lo1tuma/eslint-plugin-mocha/releases)
    > - [Changelog](https://github.com/lo1tuma/eslint-plugin-mocha/blob/master/CHANGELOG.md)
    > - [Commits](https://github.com/lo1tuma/eslint-plugin-mocha/compare/6.1.1...6.2.2)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`8661610`](https://github.com/sinonjs/samsam/commit/866161044e212b4df56a207e55ab3e449346abf5)
  Bump eslint-config-prettier from 6.7.0 to 6.9.0 (dependabot-preview[bot])
    >
    > Bumps [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) from 6.7.0 to 6.9.0.
    > - [Release notes](https://github.com/prettier/eslint-config-prettier/releases)
    > - [Changelog](https://github.com/prettier/eslint-config-prettier/blob/master/CHANGELOG.md)
    > - [Commits](https://github.com/prettier/eslint-config-prettier/commits/v6.9.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`7d91124`](https://github.com/sinonjs/samsam/commit/7d91124a9fa95c462c1e714d86405d6cb99e3363)
  Bump rollup from 1.23.0 to 1.27.14 (dependabot-preview[bot])
    >
    > Bumps [rollup](https://github.com/rollup/rollup) from 1.23.0 to 1.27.14.
    > - [Release notes](https://github.com/rollup/rollup/releases)
    > - [Changelog](https://github.com/rollup/rollup/blob/master/CHANGELOG.md)
    > - [Commits](https://github.com/rollup/rollup/compare/v1.23.0...v1.27.14)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`31c616a`](https://github.com/sinonjs/samsam/commit/31c616ab278e05071138e18d6e5aea8f2c250c2a)
  Bump nyc from 14.1.1 to 15.0.0 (dependabot-preview[bot])
    >
    > Bumps [nyc](https://github.com/istanbuljs/nyc) from 14.1.1 to 15.0.0.
    > - [Release notes](https://github.com/istanbuljs/nyc/releases)
    > - [Changelog](https://github.com/istanbuljs/nyc/blob/master/CHANGELOG.md)
    > - [Commits](https://github.com/istanbuljs/nyc/compare/v14.1.1...v15.0.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`e82dbcf`](https://github.com/sinonjs/samsam/commit/e82dbcf9af6a052b1d466e476a7315e047324256)
  Bump @sinonjs/referee from 3.2.0 to 4.0.0 (dependabot-preview[bot])
    >
    > Bumps [@sinonjs/referee](https://github.com/sinonjs/referee) from 3.2.0 to 4.0.0.
    > - [Release notes](https://github.com/sinonjs/referee/releases)
    > - [Changelog](https://github.com/sinonjs/referee/blob/master/CHANGES.md)
    > - [Commits](https://github.com/sinonjs/referee/compare/v3.2.0...v4.0.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`b089354`](https://github.com/sinonjs/samsam/commit/b089354118a6f64139ca64906d8b8a9f282bc376)
  Bump eslint-plugin-jsdoc from 18.4.3 to 19.2.0 (dependabot-preview[bot])
    >
    > Bumps [eslint-plugin-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc) from 18.4.3 to 19.2.0.
    > - [Release notes](https://github.com/gajus/eslint-plugin-jsdoc/releases)
    > - [Commits](https://github.com/gajus/eslint-plugin-jsdoc/compare/v18.4.3...v19.2.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`bba8c44`](https://github.com/sinonjs/samsam/commit/bba8c441914cd3b07b505b4d917a042d16412c9e)
  Bump @sinonjs/commons from 1.6.0 to 1.7.0 (dependabot-preview[bot])
    >
    > Bumps [@sinonjs/commons](https://github.com/sinonjs/commons) from 1.6.0 to 1.7.0.
    > - [Release notes](https://github.com/sinonjs/commons/releases)
    > - [Commits](https://github.com/sinonjs/commons/compare/v1.6.0...v1.7.0)
    >
    > Signed-off-by: dependabot-preview[bot] <support@dependabot.com>
- [`5915960`](https://github.com/sinonjs/samsam/commit/5915960fab257e27564c544da45b419c360bc8fb)
  Publish using public access (Morgan Roderick)
- [`28ffc83`](https://github.com/sinonjs/samsam/commit/28ffc83556274b025d1fc62b52d2ff8ea25743a4)
  4.2.1 (Morgan Roderick)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2020-01-09._

## 4.2.1

- [`8987966`](https://github.com/sinonjs/samsam/commit/898796645000b88f1a4045213355bed29085f46c)
  re-introduce bound deepEqual (#160) (James Garbutt)

_Released on 2019-12-30._
