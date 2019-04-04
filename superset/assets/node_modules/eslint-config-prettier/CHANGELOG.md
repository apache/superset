### Version 2.10.0 (2018-08-13)

- Added: [flowtype/boolean-style]. Thanks to Mayank Agarwal (@Mayank1791989)!
- Added: [react/jsx-child-element-spacing]
- Added: [react/jsx-props-no-multi-spaces]

### Version 2.9.0 (2017-11-26)

- Added: The [implicit-arrow-linebreak] rule.

### Version 2.8.0 (2017-11-19)

- Added: The [react/jsx-one-expression-per-line] rule.

### Version 2.7.0 (2017-11-01)

- Added: The [lines-around-comment] rule (as a [special
  rule][lines-around-comment-special]). Thanks to Maurice de Beijer
  (@mauricedb)!
- Added: The [no-unexpected-multiline] rule (as a [special
  rule][no-unexpected-multiline-special]). Thanks to Suhas Karanth
  (@sudo-suhas)!

### Version 2.6.0 (2017-09-23)

- Added: The [no-floating-decimal] rule.

### Version 2.5.0 (2017-09-16)

- Added: Support for [eslint-plugin-standard]. Thanks to Christian Pekeler
  (@pekeler)!

### Version 2.4.0 (2017-09-02)

- Added: The [function-paren-newline] rule (new in [ESLint 4.6.0]). Thanks to
  Pierre Vanduynslager (@vanduynslagerp)!

### Version 2.3.0 (2017-06-30)

- Added: The (deprecated) [indent-legacy] rule. Thanks to M. Ian Graham
  (@miangraham)!

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

- Added: The [no-tabs] rule (as a [special rule][no-tabs-special]). Thanks to
  Alex Meah (@AlexMeah)!

### Version 2.0.0 (2017-05-07)

- Changed/Improved: The CLI helper tool is now more helpful.

  - The options of special rules are now validated if possible. If a special
    rule is enabled with non-conflicting options, the CLI no longer warns about
    it.
  - If only special rules that cannot be automatically checked are found, the
    CLI no longer exists with a non-zero exit code. Instead, it only warns about
    the rules.

- Changed: The [no-confusing-arrow] is now a special rule again, since it might
  conflict with recent Prettier versions.

- Removed: The `react/wrap-multilines` rule (which has been deprecated for a
  while), since it was removed in eslint-plugin-react@7.

### Version 1.7.0 (2017-04-19)

- Changed: The [no-confusing-arrow] is no longer a special rule, but simply
  turned off, since recent Prettier versions make it redundant.
- Improved: The CLI helper tool now has a more helpful message for special
  rules, and exits with a different status code if only special rules were
  found. The exit codes are now documented as well.

### Version 1.6.0 (2017-04-05)

- Added: The [curly] rule. Thanks to Martin Rädlinger (@formatlos)!

### Version 1.5.0 (2017-03-04)

- Added: The [nonblock-statement-body-position] rule.

### Version 1.4.1 (2017-02-28)

- Improved: eslint-config-prettier is now part of the [prettier] organization!
  This version updates all URLs to point to the new home of the project.

### Version 1.4.0 (2017-02-26)

- Added: The [no-confusing-arrow] rule (as a
  [special rule][no-confusing-arrow-special]). Thanks to Dominik Ferber
  (@dferber90)!
- Added: Deprecated or removed rules that might conflict with prettier. Thanks
  to Dominik Ferber (@dferber90)!

### Version 1.3.0 (2017-02-21)

- Added: The [template-tag-spacing] rule. Thanks to Thibault Derousseaux
  (@tibdex)!

### Version 1.2.0 (2017-02-14)

- Added: The [one-var-declaration-per-line] rule. Thanks to Ruben Oostinga
  (@0xR)!

### Version 1.1.1 (2017-02-12)

- Minor documentation tweak: Changed "Exceptions" into "Special rules".

### Version 1.1.0 (2017-02-10)

- Fixed: The [eslint-plugin-react] exclusion rules now actually work.
- Fixed: The CLI helper tool now works in Node.js 4. Thanks to Nathan Friedly
  (@nfriedly)!
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

[ESLint 4.0.0]: https://eslint.org/blog/2017/06/eslint-v4.0.0-released
[ESLint 4.6.0]: https://eslint.org/blog/2017/09/eslint-v4.6.0-released
[array-bracket-newline]: https://eslint.org/docs/rules/array-bracket-newline
[array-element-newline]: https://eslint.org/docs/rules/array-element-newline
[curly]: https://eslint.org/docs/rules/curly
[eslint-plugin-flowtype]: https://github.com/gajus/eslint-plugin-flowtype
[eslint-plugin-react]: https://github.com/yannickcr/eslint-plugin-react
[eslint-plugin-standard]: https://github.com/xjamundx/eslint-plugin-standard
[flowtype/boolean-style]: https://github.com/gajus/eslint-plugin-flowtype#eslint-plugin-flowtype-rules-boolean-style
[function-paren-newline]: https://eslint.org/docs/rules/function-paren-newline
[implicit-arrow-linebreak]: https://eslint.org/docs/rules/implicit-arrow-linebreak
[indent-legacy]: https://eslint.org/docs/rules/indent-legacy
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
[prettier]: https://github.com/prettier
[react/jsx-child-element-spacing]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-child-element-spacing.md
[react/jsx-closing-tag-location]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-closing-tag-location.md
[react/jsx-one-expression-per-line]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-one-expression-per-line.md
[react/jsx-props-no-multi-spaces]: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-props-no-multi-spaces.md
[semi-style]: https://eslint.org/docs/rules/semi-style
[switch-colon-spacing]: https://eslint.org/docs/rules/switch-colon-spacing
[template-tag-spacing]: https://eslint.org/docs/rules/template-tag-spacing
