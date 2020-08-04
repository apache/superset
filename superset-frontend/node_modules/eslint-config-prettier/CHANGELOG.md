### Version 6.11.0 (2020-04-21)

- Added: [@typescript-eslint/keyword-spacing]. Thanks to Hans Bergren (@hbergren)!!

### Version 6.10.1 (2020-03-22)

- Improved: Recommend using `npx` when running the CLI helper tool.
- Updated: Mention that eslint-config-prettier has been tested with Prettier 2.0 and the latest versions of plugins.

### Version 6.10.0 (2020-01-28)

- Added: [@typescript-eslint/comma-spacing]. Thanks to Masafumi Koba (@ybiquitous)!!

### Version 6.9.0 (2019-12-27)

- Added: [vue/max-len]. Thanks to @xcatliu!

### Version 6.8.0 (2019-12-25)

- Added: [@typescript-eslint/no-extra-semi]. Thanks to @xcatliu!

### Version 6.7.0 (2019-11-19)

- Added: [@typescript-eslint/space-before-function-paren]. Thanks to Masafumi Koba (@ybiquitous)!

### Version 6.6.0 (2019-11-17)

- Added: New [eslint-plugin-vue] rules: [vue/dot-location] and [vue/keyword-spacing]. Thanks to @xcatliu!

### Version 6.5.0 (2019-10-26)

- Added: Support for [excluding deprecated rules]. Thanks to Alex Ilyaev (@alexilyaev)!

### Version 6.4.0 (2019-10-05)

- Added: [unicorn/no-nested-ternary]. Thanks to Yang Mingshan (@yangmingshan)!

### Version 6.3.0 (2019-09-10)

- Added: [@typescript-eslint/brace-style]. Thanks to Masafumi Koba (@ybiquitous)!

### Version 6.2.0 (2019-09-03)

- Added: [@typescript-eslint/quotes] (as a [special rule][@typescript-eslint/quotes-special]). Thanks to Masafumi Koba (@ybiquitous)!

### Version 6.1.0 (2019-08-19)

- Added: [function-call-argument-newline] \(new in ESLint 6.2.0). Thanks to Masafumi Koba (@ybiquitous)!

### Version 6.0.0 (2019-06-25)

- Changed: The CLI helper tool now considers [no-confusing-arrow] to conflict if you use the default value of its `allowParens` option. The default was changed to `true` in ESLint 6, which conflicts with Prettier.

  If the CLI helper tool gives you errors about this after upgrading, the solution is to change this:

  ```json
  {
    "rules": {
      "no-confusing-arrow": ["error"]
    }
  }
  ```

  Into this:

  ```json
  {
    "rules": {
      "no-confusing-arrow": ["error", { "allowParens": false }]
    }
  }
  ```

  The latter works in both ESLint 6 as well as in ESLint 5 and older.

- Improved: `eslint --print-config` usage instructions. The CLI tool help text as well as the documentation has been updated to suggest commands that work in ESLint 6.0 as well as in ESLint 5 and older. (Instead of `eslint --print-config .`, use `eslint --print-config path/to/main.js`.)

### Version 5.1.0 (2019-06-25)

- Added: [react/jsx-curly-newline]. Thanks to Masafumi Koba (@ybiquitous)!

### Version 5.0.0 (2019-06-15)

- Removed: [react/self-closing-comp]. This rule was added in v4.1.0 not because it _conflicted_ with Prettier but because it was _unnecessary_ when using Prettier. However, in v1.18.0 [Prettier stopped converting empty elements to self-closing elements][prettier-self-closing]. So the rule is not unnecessary anymore.

  If you use Prettier v1.17.1 or older you should be able to upgrade eslint-config-prettier to v5.0.0 without having to do anything else.

  If you use Prettier v1.18.0 or newer, you might get lint errors about for example changing `<div></div>` into `<div />`. You have two options:

  - Run `eslint --fix` if you prefer to enforce self-closing elements where possible. This should fix all the errors.
  - Add `"react/self-closing-comp": "off"` to your ESLint config if you use autofix from your editor and you face the same [issue as Prettier did][prettier-self-closing].

- Changed: Node.js 6 is no longer officially supported, but v5.0.0 should still work with it.

### Version 4.3.0 (2019-05-16)

- Added: New [eslint-plugin-vue] rules: [vue/arrow-spacing], [vue/block-spacing], [vue/brace-style] and [vue/comma-dangle].
- Added: New [@typescript-eslint/eslint-plugin] rules: [@typescript-eslint/func-call-spacing] and [@typescript-eslint/semi].

### Version 4.2.0 (2019-04-25)

- Added: [@typescript-eslint/no-extra-parens]. Thanks to Keiichiro Amemiya (@Hoishin) and Jen Gorfine (@jgorfine)!

### Version 4.1.0 (2019-02-26)

- Added: [linebreak-style]. Use Prettier’s [end-of-line] option instead.
- Added: [react/self-closing-comp]. Thanks to Gaurav Gupta (@gaurav5430)!

### Version 4.0.0 (2019-01-26)

- Breaking change: Support for [eslint-plugin-typescript] has been removed and replaced with support for its successor [@typescript-eslint/eslint-plugin]. Thanks to TANIGUCHI Masaya (@ta2gch) and everyone else who helped with this!
- Changed: [arrow-body-style] and [prefer-arrow-callback] are now marked as [special rules][arrow-special], since they might cause problems if using [eslint-plugin-prettier] and `--fix`. They are turned off by default, and the CLI helper tool will _warn_ about them (but not error if you do enable them). This won’t break your linting checks, but do note that these rules will be disabled unless you explicitly enable them again, and that you might see new warnings when running the CLI helper tool.

### Version 3.6.0 (2019-01-19)

- Added: Support for [eslint-plugin-babel]. Thanks to Matija Marohnić (@silvenon)!

### Version 3.5.0 (2019-01-16)

- Fixed: The eslint-plugin-vue change from 3.4.0 has been reverted. That change requires eslint-plugin-vue@5, while many use eslint-plugin-vue@4. In other words, it was an accidental breaking change. Also, after thinking about it some more, it makes sense to have a Prettier-specific list of rules, rather than using the `vue/no-layout-rules` list, since there can be layout rules that don’t conflict with but rather complement Prettier.
- Added: New eslint-plugin-vue rules coming in the next version after 5.1.0.

### Version 3.4.0 (2019-01-13)

- Added: Support for [eslint-plugin-typescript]. Thanks to Jed Fox (@j-f1)!
- Improved: The eslint-plugin-vue integration is now using the `vue/no-layout-rules` config behind the scenes, so it should automatically stay up-to-date when new eslint-plugin-vue versions are released. Thanks to Michał Sajnóg (@michalsnik)!

### Version 3.3.0 (2018-11-11)

- Added: The [vue/html-self-closing] rule (as a [special rule][vue/html-self-closing-special]). Thanks to Yamagishi Kazutoshi (@ykzts)!

### Version 3.2.0 (2018-11-10)

- Added: Support for [eslint-plugin-vue].
- Fixed: The CLI helper tool should now work in Node.js 6 with npm 3 again. Thanks to Grant Snodgrass (@meeber)!
- Improved: Updated documentation.

### Version 3.1.0 (2018-09-22)

- Added: Support for [eslint-plugin-unicorn]. Thanks to John Mars (@j0hnm4r5)!
- Changed: The [quotes] rule is now allowed to be used to forbid unnecessary backticks. This means that the CLI helper tool no longer can automatically validate it, so you’ll need to refer the [quotes special rule documentation][quotes-special]. Thanks to Nick Petruzzelli (@npetruzzelli)!

### Version 3.0.1 (2018-08-13)

- Improved: `eslint --print-config` usage instructions.

### Version 3.0.0 (2018-08-13)

- Breaking change: Dropped Node.js 4 support.

### Version 2.10.0 (2018-08-13)

- Added: [flowtype/boolean-style]. Thanks to Mayank Agarwal (@Mayank1791989)!
- Added: [react/jsx-child-element-spacing]
- Added: [react/jsx-props-no-multi-spaces]

### Version 2.9.0 (2017-11-26)

- Added: The [implicit-arrow-linebreak] rule.

### Version 2.8.0 (2017-11-19)

- Added: The [react/jsx-one-expression-per-line] rule.

### Version 2.7.0 (2017-11-01)

- Added: The [lines-around-comment] rule (as a [special rule][lines-around-comment-special]). Thanks to Maurice de Beijer (@mauricedb)!
- Added: The [no-unexpected-multiline] rule (as a [special rule][no-unexpected-multiline-special]). Thanks to Suhas Karanth (@sudo-suhas)!

### Version 2.6.0 (2017-09-23)

- Added: The [no-floating-decimal] rule.

### Version 2.5.0 (2017-09-16)

- Added: Support for [eslint-plugin-standard]. Thanks to Christian Pekeler (@pekeler)!

### Version 2.4.0 (2017-09-02)

- Added: The [function-paren-newline] rule (new in [ESLint 4.6.0]). Thanks to Pierre Vanduynslager (@vanduynslagerp)!

### Version 2.3.0 (2017-06-30)

- Added: The (deprecated) [indent-legacy] rule. Thanks to M. Ian Graham (@miangraham)!

### Version 2.2.0 (2017-06-17)

- Added: New rules from [ESLint 4.0.0]:
  - [array-element-newline]
  - [array-bracket-newline]
  - [semi-style]
  - [switch-colon-spacing]
- Added: [react/jsx-closing-tag-location]

### Version 2.1.1 (2017-05-20)

- No code changes. Just updates to the readme.

### Version 2.1.0 (2017-05-13)

- Added: The [no-tabs] rule (as a [special rule][no-tabs-special]). Thanks to Alex Meah (@AlexMeah)!

### Version 2.0.0 (2017-05-07)

- Changed/Improved: The CLI helper tool is now more helpful.

  - The options of special rules are now validated if possible. If a special rule is enabled with non-conflicting options, the CLI no longer warns about it.
  - If only special rules that cannot be automatically checked are found, the CLI no longer exists with a non-zero exit code. Instead, it only warns about the rules.

- Changed: The [no-confusing-arrow] is now a special rule again, since it might conflict with recent Prettier versions.

- Removed: The `react/wrap-multilines` rule (which has been deprecated for a while), since it was removed in eslint-plugin-react@7.

### Version 1.7.0 (2017-04-19)

- Changed: The [no-confusing-arrow] is no longer a special rule, but simply turned off, since recent Prettier versions make it redundant.
- Improved: The CLI helper tool now has a more helpful message for special rules, and exits with a different status code if only special rules were found. The exit codes are now documented as well.

### Version 1.6.0 (2017-04-05)

- Added: The [curly] rule. Thanks to Martin Rädlinger (@formatlos)!

### Version 1.5.0 (2017-03-04)

- Added: The [nonblock-statement-body-position] rule.

### Version 1.4.1 (2017-02-28)

- Improved: eslint-config-prettier is now part of the [prettier] organization! This version updates all URLs to point to the new home of the project.

### Version 1.4.0 (2017-02-26)

- Added: The [no-confusing-arrow] rule (as a [special rule][no-confusing-arrow-special]). Thanks to Dominik Ferber (@dferber90)!
- Added: Deprecated or removed rules that might conflict with prettier. Thanks to Dominik Ferber (@dferber90)!

### Version 1.3.0 (2017-02-21)

- Added: The [template-tag-spacing] rule. Thanks to Thibault Derousseaux (@tibdex)!

### Version 1.2.0 (2017-02-14)

- Added: The [one-var-declaration-per-line] rule. Thanks to Ruben Oostinga (@0xR)!

### Version 1.1.1 (2017-02-12)

- Minor documentation tweak: Changed "Exceptions" into "Special rules".

### Version 1.1.0 (2017-02-10)

- Fixed: The [eslint-plugin-react] exclusion rules now actually work.
- Fixed: The CLI helper tool now works in Node.js 4. Thanks to Nathan Friedly (@nfriedly)!
- Added: Support for [eslint-plugin-flowtype].
- Improved: Minor things for the CLI helper tool.
- Improved: There are now tests for everything.

### Version 1.0.3 (2017-02-03)

- Fixed: `"extends": "prettier/react"` now actually works.

### Version 1.0.2 (2017-01-30)

- Improved: CLI helper tool instructions.

### Version 1.0.1 (2017-01-29)

- No difference from 1.0.0. Just an `npm publish` mistake.

### Version 1.0.0 (2017-01-29)

- Initial release.

[@typescript-eslint/brace-style]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/brace-style.md
[@typescript-eslint/comma-spacing]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/comma-spacing.md
[@typescript-eslint/eslint-plugin]: https://github.com/typescript-eslint/typescript-eslint
[@typescript-eslint/func-call-spacing]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/func-call-spacing.md
[@typescript-eslint/keyword-spacing]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/keyword-spacing.md
[@typescript-eslint/no-extra-parens]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-extra-parens.md
[@typescript-eslint/no-extra-semi]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-extra-semi.md
[@typescript-eslint/quotes-special]: https://github.com/prettier/eslint-config-prettier/blob/857257179fe69715362dfa9300762d6e534c0603/README.md#quotes
[@typescript-eslint/quotes]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/quotes.md
[@typescript-eslint/semi]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/semi.md
[@typescript-eslint/space-before-function-paren]: https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/space-before-function-paren.md
[array-bracket-newline]: https://eslint.org/docs/rules/array-bracket-newline
[array-element-newline]: https://eslint.org/docs/rules/array-element-newline
[arrow-body-style]: https://eslint.org/docs/rules/arrow-body-style
[arrow-special]: https://github.com/prettier/eslint-config-prettier/blob/2c842675e55b91aecaef6f997d234ebf2d220ffb/README.md#arrow-body-style-and-prefer-arrow-callback
[curly]: https://eslint.org/docs/rules/curly
[end-of-line]: https://prettier.io/docs/en/options.html#end-of-line
[eslint 4.0.0]: https://eslint.org/blog/2017/06/eslint-v4.0.0-released
[eslint 4.6.0]: https://eslint.org/blog/2017/09/eslint-v4.6.0-released
[eslint-plugin-babel]: https://github.com/babel/eslint-plugin-babel
[eslint-plugin-flowtype]: https://github.com/gajus/eslint-plugin-flowtype
[eslint-plugin-prettier]: https://github.com/prettier/eslint-plugin-prettier
[eslint-plugin-react]: https://github.com/yannickcr/eslint-plugin-react
[eslint-plugin-standard]: https://github.com/xjamundx/eslint-plugin-standard
[eslint-plugin-typescript]: https://github.com/bradzacher/eslint-plugin-typescript
[eslint-plugin-unicorn]: https://github.com/sindresorhus/eslint-plugin-unicorn
[eslint-plugin-vue]: https://github.com/vuejs/eslint-plugin-vue
[excluding deprecated rules]: https://github.com/prettier/eslint-config-prettier/tree/9f6b59486ad742dc12ad3be157ddff5f8454ef7a#excluding-deprecated-rules
[flowtype/boolean-style]: https://github.com/gajus/eslint-plugin-flowtype#eslint-plugin-flowtype-rules-boolean-style
[function-call-argument-newline]: https://eslint.org/docs/rules/function-call-argument-newline
[function-paren-newline]: https://eslint.org/docs/rules/function-paren-newline
[implicit-arrow-linebreak]: https://eslint.org/docs/rules/implicit-arrow-linebreak
[indent-legacy]: https://eslint.org/docs/rules/indent-legacy
[linebreak-style]: https://eslint.org/docs/rules/linebreak-style
[lines-around-comment-special]: https://github.com/prettier/eslint-config-prettier/blob/5399175c37466747aae9d407021dffec2c169c8b/README.md#lines-around-comment
[lines-around-comment]: https://eslint.org/docs/rules/lines-around-comment
[no-confusing-arrow-special]: https://github.com/prettier/eslint-config-prettier/blob/08ac5bcc25c9cdc71864b4a1e4191e7d28dd2bc2/README.md#no-confusing-arrow
[no-confusing-arrow]: https://eslint.org/docs/rules/no-confusing-arrow
[no-floating-decimal]: https://eslint.org/docs/rules/no-floating-decimal
[no-tabs-special]: https://github.com/prettier/eslint-config-prettier/blob/dfa6e2b51f11a8001e9e7d38b78f03c7d75175ec/README.md#no-tabs
[no-tabs]: https://eslint.org/docs/rules/no-tabs
[no-unexpected-multiline-special]: https://github.com/prettier/eslint-config-prettier/blob/5399175c37466747aae9d407021dffec2c169c8b/README.md#no-unexpected-multiline
[no-unexpected-multiline]: https://eslint.org/docs/rules/no-unexpected-multiline
[nonblock-statement-body-position]: https://eslint.org/docs/rules/nonblock-statement-body-position
[one-var-declaration-per-line]: https://eslint.org/docs/rules/one-var-declaration-per-line
[prefer-arrow-callback]: https://eslint.org/docs/rules/prefer-arrow-callback
[prettier-self-closing]: https://prettier.io/blog/2019/06/06/1.18.0.html#stop-converting-empty-jsx-elements-to-self-closing-elements-6127-by-duailibe
[prettier]: https://github.com/prettier
[quotes-special]: https://github.com/prettier/eslint-config-prettier/blob/8d264cd0a7f06c12e2e05415e0282a4f8f21ebc9/README.md#quotes
[quotes]: https://eslint.org/docs/rules/quotes
[react/jsx-child-element-spacing]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-child-element-spacing.md
[react/jsx-closing-tag-location]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-closing-tag-location.md
[react/jsx-curly-newline]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-curly-newline.md
[react/jsx-one-expression-per-line]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-one-expression-per-line.md
[react/jsx-props-no-multi-spaces]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-props-no-multi-spaces.md
[react/self-closing-comp]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/self-closing-comp.md
[semi-style]: https://eslint.org/docs/rules/semi-style
[switch-colon-spacing]: https://eslint.org/docs/rules/switch-colon-spacing
[template-tag-spacing]: https://eslint.org/docs/rules/template-tag-spacing
[unicorn/no-nested-ternary]: https://github.com/sindresorhus/eslint-plugin-unicorn/blob/master/docs/rules/no-nested-ternary.md
[vue/arrow-spacing]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/arrow-spacing.md
[vue/block-spacing]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/block-spacing.md
[vue/brace-style]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/brace-style.md
[vue/comma-dangle]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/comma-dangle.md
[vue/dot-location]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/dot-location.md
[vue/html-self-closing-special]: https://github.com/prettier/eslint-config-prettier/blob/d5e7af986221df5faedc12893d8dc3150a808693/README.md#vuehtml-self-closing
[vue/html-self-closing]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/html-self-closing.md
[vue/keyword-spacing]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/keyword-spacing.md
[vue/max-len]: https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/max-len.md
