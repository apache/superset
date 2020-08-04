## 2.0.3

-   Use standard wording for BSD-3-Clause license (@PhilippWendler)

## 2.0.2

-   Correct license in `package.json` (@Haegin)

## 2.0.1

-   Add TypeScript type definitions, thanks to @LinusU

## 2.0.0

Modernization updates thanks to @TimothyGu:

-   Use jsdom's eslint config, remove jscs
-   Move syntax to ES6
-   Remove Babel
-   Via: https://github.com/jsdom/abab/pull/26

## 1.0.4

-   Added license file

## 1.0.3

-   Replaced `let` with `var` in `lib/btoa.js`
    -   Follow up from `1.0.2`
    -   Resolves https://github.com/jsdom/abab/issues/18

## 1.0.2

-   Replaced `const` with `var` in `index.js`
    -   Allows use of `abab` in the browser without a transpilation step
    -   Resolves https://github.com/jsdom/abab/issues/15
