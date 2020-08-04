# @emotion/core

## 10.0.28

### Patch Changes

- [`d0b2a94`](https://github.com/emotion-js/emotion/commit/d0b2a94ab9d5648667447dbd78e7a2e3e93de42a) [#1714](https://github.com/emotion-js/emotion/pull/1714) Thanks [@Andarist](https://github.com/Andarist)! - Fixed label extraction from the stack traces in FireFox and Safari. We have failed to match a label in Emotion wrappers like Theme UI which caused SSR mismatches in mentioned browsers. This has affected only development builds.

## 10.0.27

### Patch Changes

- [`4c62ae9`](https://github.com/emotion-js/emotion/commit/4c62ae9447959d438928e1a26f76f1487983c968) [#1698](https://github.com/emotion-js/emotion/pull/1698) Thanks [@Andarist](https://github.com/Andarist)! - Add LICENSE file
- Updated dependencies [[`4c62ae9`](https://github.com/emotion-js/emotion/commit/4c62ae9447959d438928e1a26f76f1487983c968)]:
  - @emotion/cache@10.0.27
  - @emotion/css@10.0.27
  - emotion-server@10.0.27
  - emotion-theming@10.0.27
  - emotion@10.0.27
  - @emotion/serialize@0.11.15
  - @emotion/sheet@0.9.4
  - @emotion/styled@10.0.27
  - @emotion/utils@0.11.3

## 10.0.22

### Patch Changes

- [`4fc5657a`](https://github.com/emotion-js/emotion/commit/4fc5657ac8d0002322321cfbfc254b7196d27387) [#1219](https://github.com/emotion-js/emotion/pull/1219) Thanks [@Andarist](https://github.com/Andarist)! - Add dev hint about css object being stringified by accident

* [`2fc75f26`](https://github.com/emotion-js/emotion/commit/2fc75f266b23cf48fb842953bc47eebcb5241cbd) [#1548](https://github.com/emotion-js/emotion/pull/1548) Thanks [@Andarist](https://github.com/Andarist)! - Accept objects as `className` in jsx-created components (they are stringified) to match React behavior

- [`10211951`](https://github.com/emotion-js/emotion/commit/10211951051729b149930a8646de14bae9ae1bbc) [#1553](https://github.com/emotion-js/emotion/pull/1553) Thanks [@Andarist](https://github.com/Andarist)! - Add dev warning about keyframes being interpolated into plain strings.

* [`57a767ea`](https://github.com/emotion-js/emotion/commit/57a767ea3dd18eefbbdc7269cc13128caad65286) [#1560](https://github.com/emotion-js/emotion/pull/1560) Thanks [@Andarist](https://github.com/Andarist)! - Fix composition of styles without a final semicolon in a declaration block

* Updated dependencies [[`4fc5657a`](https://github.com/emotion-js/emotion/commit/4fc5657ac8d0002322321cfbfc254b7196d27387), [`10211951`](https://github.com/emotion-js/emotion/commit/10211951051729b149930a8646de14bae9ae1bbc), [`57a767ea`](https://github.com/emotion-js/emotion/commit/57a767ea3dd18eefbbdc7269cc13128caad65286), [`c3f0bc10`](https://github.com/emotion-js/emotion/commit/c3f0bc101833fff1ee4e27c7a730b821a7df4a15), [`11bea3a8`](https://github.com/emotion-js/emotion/commit/11bea3a89f38f9052c692c3df050ad802b6b954c)]:
  - @emotion/serialize@0.11.12
  - @emotion/styled@10.0.22
  - @emotion/css@10.0.22

## 10.0.21

### Patch Changes

- [7855db4a](https://github.com/emotion-js/emotion/commit/7855db4ae379f212e7b972b9108419154e17ed45) [#1537](https://github.com/emotion-js/emotion/pull/1537) Thanks [@Andarist](https://github.com/Andarist)! - Add missing `/* #__PURE__ */` annotation to creation of EmotionCssPropInternal

## 10.0.20

### Patch Changes

- [38bb2b19](https://github.com/emotion-js/emotion/commit/38bb2b19d4ff1552116829e068664516d167a3f8) [#1530](https://github.com/emotion-js/emotion/pull/1530) Thanks [@Andarist](https://github.com/Andarist)! - Fix class not being applied when putting nil as css prop value on wrapper component

## 10.0.17

### Patch Changes

- [66cda641](https://github.com/emotion-js/emotion/commit/66cda64128631790b81e3c9df273a972358ea593) [#1478](https://github.com/emotion-js/emotion/pull/1478) Thanks [@Andarist](https://github.com/Andarist)! - Add warnings about using illegal escape sequences
  - [10514a86](https://github.com/emotion-js/emotion/commit/10514a8635dcaa55b85c7bff90e2a9e14d1ba61f) [#1482](https://github.com/emotion-js/emotion/pull/1482) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Remove react native bundles in favour of different isBrowser detection
  - [66cda641](https://github.com/emotion-js/emotion/commit/66cda64128631790b81e3c9df273a972358ea593) [#1478](https://github.com/emotion-js/emotion/pull/1478) Thanks [@Andarist](https://github.com/Andarist)! - Update Babel dependencies

## 10.0.16

### Patch Changes

- [47262b64](https://github.com/emotion-js/emotion/commit/47262b64) - Fix labels from stack traces in some cases

## 10.0.15

### Patch Changes

- [188dc0e7](https://github.com/emotion-js/emotion/commit/188dc0e7) [#1443](https://github.com/emotion-js/emotion/pull/1443) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Extract styles rather than inline them in compat mode with the Global component
  - [4a3b18a2](https://github.com/emotion-js/emotion/commit/4a3b18a2) [#1451](https://github.com/emotion-js/emotion/pull/1451) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issue with auto-labelling crashing on \$ at runtime

## 10.0.14

### Patch Changes

- [c0eb604d](https://github.com/emotion-js/emotion/commit/c0eb604d) [#1419](https://github.com/emotion-js/emotion/pull/1419) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Update build tool
