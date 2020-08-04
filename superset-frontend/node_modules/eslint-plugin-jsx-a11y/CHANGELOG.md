5.1.1 / 2017-07-03
==================
 - [fix] revert v6 breaking changes unintentionally added in v5.1 (#283)

5.1.0 / 2017-06-26
==================
 - [new] Support eslint v4. (#267)
 - [new] `label-has-for`: add "required" option to allow customization (#240)
 - [new] add `anchor-is-valid` (#224)
 - [new] `interactive-supports-focus`: Split interactive supports focus into tabbable and focusable cases (#236)
 - [new] `anchor-is-valid`: add `aspects` option (#251)
 - [Deps] Bump aria-query to 0.7.0

5.0.3 / 2017-05-16
==================
- [fix] Remove `flow` directory from `.npmignore` to accommodate explicit imports from `v5.0.2`.

5.0.2 / 2017-05-16
==================
- [fix] Explicitly import flow types to resolve flow failures in consuming projects.


5.0.1 / 2017-05-07
==================
- [fix] Polyfill Array.includes for node < 6 support.


5.0.0 / 2017-05-05
==================
- [breaking] Refactor `img-has-alt` rule into `alt-text` rule
- [breaking] Rule `onclick-has-role` is removed. Replaced with `no-static-element-interactions` and `no-noninteractive-element-interactions`.
- [breaking] Rule `onclick-has-focus` is removed. Replaced with `interactive-supports-focus`.
- [new] - Add rule `media-has-caption` rule
- [new] - Add `ignoreNonDOM` option to `no-autofocus`.
- [new] - Add rule `no-interactive-element-to-noninteractive-role`
- [new] - Add rule `no-noninteractive-element-to-interactive-role`
- [new] - Add rule `no-noninteractive-tabindex`
- [new] - Configs split into "recommended" and "strict".
- [enhanced] - Configuration options added to `no-static-element-interactions` and `no-noninteractive-element-interactions`. Options allow for fine-tuning of elements and event handlers to check.


4.0.0 / 2017-02-04
==================
Add new rules:
- `jsx-a11y/accessible-emoji`
- `jsx-a11y/aria-activedescendant-has-tabindex`
- `jsx-a11y/iframe-has-title`
- `jsx-a11y/no-autofocus`
- `jsx-a11y/no-distracting-elements` *(breaking: consolidated no-marquee and no-blink into this rule.)*
- `jsx-a11y/no-redundant-roles`
- [fix] - redundant-alt to only check full words
- [docs] - Documentation upgrades across the board.
- [new] - Add `ignoreNonDom`
- [dev] - Add script to scaffold new rule creation.


3.0.2 / 2016-12-14
==================
- [fix] - make `aria-invalid` values true and false pass for rule `aria-proptypes`

3.0.1 / 2016-10-11
==================
- [breaking] - Update all rule schemas to accept objects. This allows a future schema expansion to not be a breaking change.
- [breaking] - All rules with schemas that accepted a string OR array, now only allows an array.
- [new] - `href-no-hash` accepts new schema property `specialLink` to check for custom `href` properties on elements. (fixes [#76](https://github.com/evcohen/eslint-plugin-jsx-a11y/issues/76))
- [breaking][fix] - `img-has-alt` now prefers `alt=""` over `role="presentation"`. You can set both, but not just `role="presentation"` by itself to ensure a11y across all devices.

Note - see [rule documentation](https://github.com/evcohen/eslint-plugin-jsx-a11y/tree/master/docs/rules) for updated schemas.

2.2.3 / 2016-10-08
==================
- [fix] - Add `switch` aria role.
- [devDependencies] - Updgrade dev dependencies and fix linting issues.


2.2.2 / 2016-09-12
==================
- [fix] `x-has-content` rules now pass with children prop set.


2.2.1 / 2016-08-31
==================
- [fix] Update `tablist` role to include missing property `aria-multiselectable`.


2.2.0 / 2016-08-26
==================
- [new] Add `click-events-have-key-events` rule.
- [new] Add `no-static-element-interactions` rule.
- [devDependencies] Upgrade `eslint`, `eslint-config-airbnb`, `mocha` to latest.
- [lint] Fix all new linting errors with upgrade
- [nit] Use `error` syntax over `2` syntax in recommended config.


2.1.0 / 2016-08-10
==================
- [fix] Require `aria-checked` for roles that are subclasses of `checkbox`
- [new] Add `anchor-has-content` rule.
- [refactor] Use new eslint rule syntax
- [new] Add support for custom words in `img-redundant-alt` (mainly for i18n).


2.0.1 / 2016-07-13
==================
- [fix] JSXElement support in expression handlers for prop types.
- [fix] `heading-has-content`: dangerouslySetInnerHTML will pass.


2.0.0 / 2016-07-12
==================
- [breaking] Scope `no-onchange` rule to select menu elements only.


1.5.5 / 2016-07-05
==================
- [fix] Add `eslint` v3 as a `peerDependency`.


1.5.4 / 2016-07-05
==================
- [fix] Add `eslint` as a `peerDependency`.


1.5.3 / 2016-06-16
==================
- [fix] Fix crash when ``<ELEMENT role />`` for `role-supports-aria-props`.


1.5.2 / 2016-06-16
==================
- [fix] Fix `img-redundant-alt` rule to use `getLiteralPropValue` from `jsx-ast-utils`.


1.5.1 / 2016-06-16
==================
- [fix] Fix checking for undefined in `heading-has-content` for children content.


1.5.0 / 2016-06-16
==================
- [new] Add [heading-has-content](docs/rules/heading-has-content.md) rule.
- [new] Add [html-has-lang](docs/rules/html-has-lang.md) rule.
- [new] Add [lang](docs/rules/lang.md) rule.
- [new] Add [no-marquee](docs/rules/no-marquee.md) rule.
- [new] Add [scope](docs/rules/scope.md) rule.


1.4.2 / 2016-06-10
==================
- [new] Integrate with latest `jsx-ast-utils` to use `propName` function. More support for namespaced names on attributes and elements.


1.4.1 / 2016-06-10
==================
- [fix] Handle spread props in `aria-unsupported-elements` and `role-supports-aria-props` when reporting.


1.4.0 / 2016-06-10
==================
- [dependency] Integrate [jsx-ast-utils](https://github.com/evcohen/jsx-ast-utils)
- [fix] Better error reporting for aria-unsupported-elements indicating which prop to remove.


1.3.0 / 2016-06-05
==================
- [new] Spelling suggestions for incorrect `aria-*` props
- [fix] Ensure `role` value is a string before converting to lowercase in `img-has-alt` rule.


1.2.3 / 2016-06-02
==================
- [fix] Handle dynamic `tabIndex` expression values, but still retain validation logic for literal `tabIndex` values.


1.2.2 / 2016-05-20
==================
- [fix] Fix checks involving the tabIndex attribute that do not account for integer literals


1.2.1 / 2016-05-19
==================
- [fix] Avoid testing interactivity of wrapper components with same name but different casing
as DOM elements (such as `Button` vs `button`).


1.2.0 / 2016-05-06
==================
- [new] Import all roles from DPUB-ARIA.


1.1.0 / 2016-05-06
==================
- [new] Add expression value handler for `BinaryExpression` type.
- [new] Add expression value handler for `NewExpression` type.
- [new] Add expression value handler for `ObjectExpression` type.
- [fix] Throws error when getting an expression of type without a handler function.
	- This is for more graceful error handling and better issue reporting.


1.0.4 / 2016-04-28
==================
- [fix] Add expression value handler for `ConditionalExpression` type.


1.0.3 / 2016-04-25
==================
- [fix] Fix typo in recommended rules for `onclick-has-focus`.


1.0.2 / 2016-04-20
==================
- [fix] Add expression value handler for `ThisExpression` type.


1.0.1 / 2016-04-19
==================
- [fix] Fix build to copy source JSON files to build output.


1.0.0 / 2016-04-19
==================
- [breaking] Rename `img-uses-alt` to `img-has-alt`
- [breaking] Rename `onlick-uses-role` to `onclick-has-role`
- [breaking] Rename `mouse-events-map-to-key-events` to `mouse-events-have-key-events`
- [breaking] Rename `use-onblur-not-onchange` to `no-onchange`
- [breaking] Rename `label-uses-for` to `label-has-for`
- [breaking] Rename `redundant-alt` to `img-redundant-alt`
- [breaking] Rename `no-hash-href` to `href-no-hash`
- [breaking] Rename `valid-aria-role` to `aria-role`

- [new] Implement `aria-props` rule
- [new] Implement `aria-proptypes` rule
- [new] Implement `aria-unsupported-elements` rule
- [new] Implement `onclick-has-focus` rule
- [new] Implement `role-has-required-aria-props` rule
- [new] Implement `role-supports-aria-props` rule
- [new] Implement `tabindex-no-positive` rule


0.6.2 / 2016-04-08
==================
- [fix] Fix rule details for img-uses-alt: allow alt="" or role="presentation".


0.6.1 / 2016-04-07
==================
- [fix] Do not infer interactivity of components that are not low-level DOM elements.


0.6.0 / 2016-04-06
==================
- [breaking] Allow alt="" when role="presentation" on img-uses-alt rule.
- [new] More descriptive error messaging for img-uses-alt rule.


0.5.2 / 2016-04-05
==================
- [fix] Handle token lists for valid-aria-role.


0.5.1 / 2016-04-05
==================
- [fix] Handle null valued props for valid-aria-role.


0.5.0 / 2016-04-02
==================
- [new] Implement valid-aria-role rule. Based on [AX_ARIA_01](https://github.com/GoogleChrome/accessibility-developer-tools/wiki/Audit-Rules#ax_aria_01)


0.4.3 / 2016-03-29
==================
- [fix] Handle LogicalExpression attribute types when extracting values. LogicalExpressions are of form `<Component prop={foo || "foobar"} />`


0.4.2 / 2016-03-24
==================
- [fix] Allow component names of form `Object.Property` i.e. `UX.Layout`


0.3.0 / 2016-03-02
==================
- [new] Implement [no-hash-href](docs/rules/no-hash-href.md) rule.
- [fix] Fixed TemplateLiteral AST value building to get more exact values from template strings.


0.2.0 / 2016-03-01
==================
- [new] Implement [redunant-alt](docs/rules/redundant-alt.md) rule.


0.1.2 / 2016-03-01
==================
- Initial pre-release.
