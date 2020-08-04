# react-select

## 3.1.0

### Minor Changes

- [4cf6c43c](https://github.com/JedWatson/react-select/commit/4cf6c43cc17a01b043fb60b33cad355d433fdf8c) [#3690](https://github.com/JedWatson/react-select/pull/3690) Thanks [@JedWatson](https://github.com/JedWatson)! - Add `isLoading` prop support to the AsyncSelect component (see #3690)

### Patch Changes

- [83b48de4](https://github.com/JedWatson/react-select/commit/83b48de4a18263b361744fc5e89d9b9845b26e4f) [#3868](https://github.com/JedWatson/react-select/pull/3868) Thanks [@Tirzono](https://github.com/Tirzono)! - Fix for not focusing the selected value when the menu opens
- [563b046a](https://github.com/JedWatson/react-select/commit/563b046a57a94c47950e62cedc4ce1c489f19f91) [#3794](https://github.com/JedWatson/react-select/pull/3794) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Convert class components that don't have to be class components to function components to reduce bundle size
- [c7e9c697](https://github.com/JedWatson/react-select/commit/c7e9c697dada15ce3ff9a767bf914ad890080433) [#3682](https://github.com/JedWatson/react-select/pull/3682) Thanks [@JedWatson](https://github.com/JedWatson)! - Allow the input component to be a `textarea` element
- [3c7de0de](https://github.com/JedWatson/react-select/commit/3c7de0de52826fe74d303a01475c43fe88256156) [#3090](https://github.com/JedWatson/react-select/pull/3090) Thanks [@akiselev](https://github.com/akiselev)! - Add aria attributes to dummy input
- [d2a820ef](https://github.com/JedWatson/react-select/commit/d2a820efc70835adf864169eebc76947783a15e2) [#3537](https://github.com/JedWatson/react-select/pull/3537) Thanks [@jdelStrother](https://github.com/jdelStrother)! - Fix Flow issues. Refer to the linked PR for more details on the specific issues.
- [fc52085b](https://github.com/JedWatson/react-select/commit/fc52085b969b1b6f53adf29d52469db9560b828c) [#3662](https://github.com/JedWatson/react-select/pull/3662) Thanks [@eemeli](https://github.com/eemeli)! - Update react-transition-group to ^4.3.0
- [edb18dd3](https://github.com/JedWatson/react-select/commit/edb18dd3d65b8fbc342bde9e805c5e3293ab6e37) [#3797](https://github.com/JedWatson/react-select/pull/3797) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Enable Babel loose mode to improve bundle size

## 3.0.8

### Patch Changes

- [a575a3c4](https://github.com/JedWatson/react-select/commit/a575a3c41798696620c77e8098c1150b4adda6cb) [#3727](https://github.com/JedWatson/react-select/pull/3727) Thanks [@tonytangau](https://github.com/tonytangau)! - Adding an `index` prop to `MultiValue` components
- [916f0d2c](https://github.com/JedWatson/react-select/commit/916f0d2c651189bfeff2289d8d3cc597e06cb2ea) [#3644](https://github.com/JedWatson/react-select/pull/3644) Thanks [@TrySound](https://github.com/TrySound)! - Remove usage of `raf` package and replace with `window.requestAnimationFrame` because React already depends on `requestAnimationFrame`
- [cba15309](https://github.com/JedWatson/react-select/commit/cba15309c4d7523ab6a785c8d5c0c7ec1048e22f) [#3676](https://github.com/JedWatson/react-select/pull/3676) Thanks [@wiesys](https://github.com/wiesys)! - Fix `loadingMessage` and `noOptionsMessage` properties in `Styles` flow type
- [32f9475e](https://github.com/JedWatson/react-select/commit/32f9475e6d43a71000a3906da9e6d2d30710efd2) [#3790](https://github.com/JedWatson/react-select/pull/3790) Thanks [@JedWatson](https://github.com/JedWatson)! - Remove unnecessary dependency on `classnames` package
- [1731175d](https://github.com/JedWatson/react-select/commit/1731175d790530b9dbfa787e3fffaff3fb0e44a0) [#3733](https://github.com/JedWatson/react-select/pull/3733) Thanks [@ddc67cd](https://github.com/ddc67cd)! - Pass `name` to `onChange` meta in `Creatable` to make it consistent with onChange in standard `Select`

## 3.0.7

### Patch Changes

- [df864f2](https://github.com/JedWatson/react-select/commit/df864f2) - Include updated yarn.lock

## 3.0.6

### Patch Changes

- [3e0a7a7](https://github.com/JedWatson/react-select/commit/3e0a7a7) - \* remove emotion 9 dep from mono repo (this wasn't being used anywhere)
  - update dep on react-input-autosize to 2.2.2 (adds UNSAFE prefix to deprecated lifecycles) (resolves #3773)

## 3.0.5

### Patch Changes

- [270cc01](https://github.com/JedWatson/react-select/commit/270cc01) [#3719](https://github.com/JedWatson/react-select/pulls/3719) Thanks [@jossmac](https://github.com/jossmac)! - Leverage currentColor for loading indicator dots -- makes styling easier, and more consistent, for consumers
- [bab8af1](https://github.com/JedWatson/react-select/commit/bab8af1) - Update lifecycle methods with UNSAFE prefix

## 3.0.4

### Patch Changes

- [cd8c3090](https://github.com/JedWatson/react-select/commit/cd8c3090) [#3586](https://github.com/JedWatson/react-select/pull/3586) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add base entrypoint back

- [#3569](https://github.com/JedWatson/react-select/pull/3569) Thanks [@vadimka123](https://github.com/vadimka123) - Performance improvement: menu items are built when the menu opens, not in the constructor

- [#3326](https://github.com/JedWatson/react-select/pull/3326) Thanks [@stevemao](https://github.com/stevemao) Fix for iOS focus management when clearing the select value

- [#3532](https://github.com/JedWatson/react-select/pull/3532) Thanks [@alisonhall](https://github.com/alisonhall)! - Change aria-live assertive to polite

## 3.0.3

- Remove base entrypoint to fix rollup dependency resolution issue

## 3.0.2

- fix erroneous build

## 3.0.1

- [patch][](https://github.com/JedWatson/react-select/commit/):

  - Add README.md file for npm

## 3.0.0

- [major][9ad152b](https://github.com/JedWatson/react-select/commit/9ad152b) [#3574](https://github.com/JedWatson/react-select/pulls/3574) Thanks [@gwyneplaine](https://github.com/gwyneplaine):
  - Upgrade emotion dependency from 9.x to 10.x [#3321](https://github.com/JedWatson/react-select/pull/3321)
  - Normalize Values [#3416](https://github.com/JedWatson/react-select/pull/3416)
  - Separate entrypoints for Async, Creatable and makeAnimated [#3541](https://github.com/JedWatson/react-select/pull/3541)
  - UMD builds deprecated
  - required react peer-dependecy of 16.8

## v2.4.4 / 2019-05-27

### BugFixes

- [#3540] Fixed active styles previously being applied to disabled options. Thanks [@risenforces](https://github.com/risenforces)
- [#3563] Fixed IME composition bugs in non Chrome browsers. Thanks [@jwilander](https://github.com/jwilander)

## v2.4.3 / 2019-03-17

### Bugfixes

- [#3492](https://github.com/JedWatson/react-select/pull/3492) Add labels to fields to make inspection. [@destructobeam](https://github.com/destructobeam)
- [#3442](https://github.com/JedWatson/react-select/pull/3442) Ignore keydown events on `Enter` in IME. [@sat0yu](https://github.com/sat0yu).
- [#3343](https://github.com/JedWatson/react-select/pull/3343) fix lint issues. [@JoshMcCullough](https://github.com/JoshMcCullough).
- [#3498](https://github.com/JedWatson/react-select/pull/3498) Fix async type. [@mufasa71](https://github.com/mufasa71)
- [#3436](https://github.com/JedWatson/react-select/pull/3436) Allow Node as placeholder [@eemeli](https://github.com/eemeli).

## v2.4.2 / 2019-03-11

### Bug fixes

- [#3446](https://github.com/JedWatson/react-select/pull/3446) Fix bug with select input value not being selectable. Thanks [kangweichan](https://github.com/kangweichan).
- [#3445](https://github.com/JedWatson/react-select/pull/3446) Fix accessibility bug. Disabled options are now focusable and announced by screen-readers but not selectable. Thanks [sarahbethfederman](https://github.com/sarahbethfederman).

## Updates

- Fixed typo in style docs. Thanks [thiagodebastos](https://github.com/thiagodebastos).
- [#3460](https://github.com/JedWatson/react-select/pull/3460) Added description for actionTypes to docs. Thanks [mikekellyio](https://github.com/mikekellyio)

## v2.4.1 / 2019-02-18

### Bug fixes

- [#3432](https://github.com/JedWatson/react-select/pull/3432) Fix bug with select menu's not working on mobile.

## v2.4.0 / 2019-02-15

### Bug fixes

- [#3427](https://github.com/JedWatson/react-select/pull/3427) remove focusOption() invocation on ENTER press if the menu is not open.
- [#3402](https://github.com/JedWatson/react-select/pull/3402) fix menu scroll being reset on focus of a select with an open menu in ie11. See [#3342](https://github.com/JedWatson/react-select/issues/3342) for details. Thanks [timothypage](https://github.com/timothypage)
- [#3420](https://github.com/JedWatson/react-select/pull/3420) fixed select menu being opened on click, when openMenuOnClick is false. Thanks [caleb](https://github.com/caleb) and [rscotten](https://github.com/rscotten)
- [#3419](https://github.com/JedWatson/react-select/pull/3419) fixed bug with ScrollCaptor operating on an undefined scrollTarget. Thanks [iulian-radu-at](https://github.com/iulian-radu-at)
- [#3411](https://github.com/JedWatson/react-select/pull/3411) fix bug where Enter key press on select with a closed menu wouldn't propagate up. Resolves [#2217](https://github.com/JedWatson/react-select/issues/2217).
- [#3407](https://github.com/JedWatson/react-select/pull/3407) remove unnecessary aria-roles from menu and options. This is now all handled by our aria-live implementation. Resolves [#3355](https://github.com/JedWatson/react-select/issues/3355). Thanks [sarahbethfederman](https://github.com/sarahbethfederman).
- [#3393](https://github.com/JedWatson/react-select/pull/3393), fix aria live announcement text for removing a selected option. Thanks [msharkeyiii](https://github.com/msharkeyiii).
- [#3350](https://github.com/JedWatson/react-select/pull/3350) Updated to 0.91 of flow. Updated types to pass stricter type checking, in later versions of flow. Thanks [DragonWW](https://github.com/DragorWW)

### Updates

- [#3370](https://github.com/JedWatson/react-select/pull/3370) Updated memoize-one dependency to 5.0.0. Thanks [adam187](https://github.com/adam187)
- [#3366](https://github.com/JedWatson/react-select/pull/3366/files) Update build tooling, to leverage babel 7. Thanks [DragonWW](https://github.com/DragorWW)

## v2.3.0 / 2019-01-18

### Bug fixes

- [#3315](https://github.com/JedWatson/react-select/pull/3315) add RAF call to Collapse component getRef() such that getBoundingClientRect() is invoked consistently.
- [#3275](https://github.com/JedWatson/react-select/pull/3275/files) wrap String invocation around inputValue to avoid calling toLowerCase on invalid elements. thanks [tavareshenrique](https://github.com/tavareshenrique)
- [#3357](https://github.com/JedWatson/react-select/pull/3357), fix loadOptions call in Async select to always pass in a string for the inputValue.
- [#3346](https://github.com/JedWatson/react-select/pull/3346) Revert work done in CSP nonce PR [#3260](https://github.com/JedWatson/react-select/pull/3260) to unblock react-select usage in an SSR setting. Users who need nonce support still, please pin your version of react-select at 2.2.0. Nonce support will be re-added in 3.0.0 along with an upgrade to emotion 10; which includes nonce support without having to provide a custom emotion instance.

### Features

- [#3115](https://github.com/JedWatson/react-select/pull/3115) menu-is-open modifier added to control class when the menu is open. [@s20lee](https://github.com/s20lee)

## v2.2.0 / 2018-12-28

### Bug Fixes

- [#3296](https://github.com/JedWatson/react-select/pull/3296) Fix for tab interactions when in composition mode with an IME. Thanks [yshr446](https://github.com/yshr446) for the PR.
- [#3302](https://github.com/JedWatson/react-select/pull/3302) Fix to breaking android and mobile safari touch bug [#2755](https://github.com/JedWatson/react-select/issues/2755), by adding more conscientious checks to the onTouchStart and onTouchMove listeners. Thanks [xakep139](https://github.com/xakep139) for the PR.
- [#3303](https://github.com/JedWatson/react-select/pull/3303) Input and GroupHeading components now get passed the selectProps prop, thanks [maxmarchuk](https://github.com/maxmarchuk) for the PR.
- [#3260](https://github.com/JedWatson/react-select/pull/3260) As a result of the CSP nonce support feature, the emotion instance is now cached and passed down to all internal components, meaning that users looking to heavily customise their Select components can do so without externally importing emotion, and nonce instances are respected per select instance. Please see [this segment](https://react-select.com/styles#cx-and-custom-components) in the docs for a more detailed explanation.
- [#3299](https://github.com/JedWatson/react-select/pull/3299) fix to assistive text on menu open.

### Feature

- [#3260](https://github.com/JedWatson/react-select/pull/3260) Add CSP nonce support to Select, thanks [Avaq](https://github.com/Avaq) and [Andarist](https://github.com/Andarist) for the heavy lifting.

## v2.1.2 / 2018-11-22

### Bug fixes

- [#3161] Initialize state with `inputValue` when `defaultOptions` is true in AsyncSelect, resolves [#3160](https://github.com/JedWatson/react-select/issues/3160), thanks [@cutterbl](https://github.com/cutterbl)
- [#3096] Placeholder component now also receives the isFocused state value as a prop. Thanks [@Nelrohd](https://github.com/Nelrohd)
- [#3060] Fix bug where trying to set the cursor somewhere in an input value would close the menu. Thanks [@stijndeschuymer](https://github.com/stijndeschuymer)
- [#3163] Fixed bug where isDisabled wasn't being reflected onto the DummyInput, which meant that disabled non searchable selects were still focusable. Thanks [@gm0t](https://github.com/gm0t)
- [#3216] Fixes bug where clearing with backspace in a single select would result in an empty array, as opposed to the expected empty object. Thanks [@IanVS](https://github.com/IanVS)
- [#3013] Fixes bug where the menu would close on trying to scroll using the scroll bar in IE11. Thanks [@rakid](https://github.com/rakid)

### Misc

- A big shoutout to everyone who helped contribute to the docs. In no particular order [@acrawford13](https://github.com/JedWatson/react-select/commits?author=acrawford13), [@kirillku](https://github.com/kirillku), [@ajaymathur](https://github.com/ajaymathur), [@mgalgs](https://github.com/mgalgs), [@cutterbl](https://github.com/cutterbl), [@JonathanWbn](https://github.com/JonathanWbn), [@mwood23](https://github.com/mwood23), [@stevemao](https://github.com/stevemao), [@jossmac](https://github.com/jossmac), and anyone else I've missed.
- Thanks to [@IanVS](https://github.com/IanVS) for cleaning up our cypress tests.

## v2.1.1 / 2018-10-24

### Bug fixes

- [#3132] Strip theme props from default Input and GroupHeading components, as they were polluting the DOM.
- [#3131] Add support for the 'Delete' key in the internal onKeyDown method. Same functionality as 'Backspace'.
- [#3100] Update flow-types and normalised default prop declarations in indicators. Thanks [iseredov](https://github.com/iseredov)

### Updates

- [#3083] Added sideEffects property to package.json to support tree-shaking in webpack 4.x. Thanks [SimenB](https://github.com/SimenB).
- [#3078] Update jest dependency to 23.6.0. Thanks [papandreou](https://github.com/papandreou)
- [#3065] Update babel-plugin-emotion to 9.2.10. Thanks [mtzhang](https://github.com/mtzhang)
- [#3108] Update docs to include instructions for replicating the simple-value use case within react-select v2. Thanks [elboletaire](https://github.com/elboletaire)

## v2.1.0 / 2018-10-03

- [#2839] Added support for theming via theme prop. Thanks [akx](https://github.com/akx)
- [#2874] Fixed flow-types of MultiValue components. Thanks [mike1808](https://github.com/mike1808)
- [#2903] Fix missing form input when there isn't a selected value. Thanks [alvinsj](https://github.com/alvinsj)
- [#2934] Reduced theme colors to a sane value set to make the exported theme more easy to consume and configure. Thanks [jossmac](https://github.com/jossmac)
- [#2876] Added overflow hidden to valueContainer to stop overflowing text in the control. Thanks [mike1808](https://github.com/mike1808)
- [#2975] Separated menu placement logic from menu primitive. Thanks [jossmac](https://github.com/jossmac).

## v2.0.0 / 2018-07-23

- async select now accepts a filterOptions function as a prop [#2822](https://github.com/JedWatson/react-select/pull/2822)
- [BREAKING] react-select now exports react-select.esm.js from dist instead of react-select.es.js [#2641](https://github.com/JedWatson/react-select/pull/2641)
- [BREAKING] innerRef assignments in custom components must now be made from the root of the prop object, as opposed to reaching into innerProps. This is part of the work to normalize the behaviour circa custom components. [#2824](https://github.com/JedWatson/react-select/pull/2824)
- className and classNamePrefix deprecation warning and backward compatibility removed. className now only affects the select container, classNamePrefix prefixes all internal components. [#2820](https://github.com/JedWatson/react-select/pull/2820)
- Added `closeMenuOnScroll` prop, which can either be a `boolean` or a `function`, if set to `true` the select menu will close on scroll of the document/body. If a function is supplied, it must take the following shape `(event: ScrollEvent) => boolean`, the boolean value will be used to resolve whether the menu should be closed or stay open. [#2809](https://github.com/JedWatson/react-select/pull/2809), thanks [Vynlar](https://github.com/Vynlar) for this.
- Added fix to support IME inputs. [#2767](https://github.com/JedWatson/react-select/pull/2767), thanks [shamabe](https://github.com/shamabe)
- Removed primitives, and normalise multi-value components to be in line with existing component customisation patterns. [#2821](https://github.com/JedWatson/react-select/pull/2821)
- Normalised isOptionDisabled to be inline with its sibling prop isOptionSelected. [#2821](https://github.com/JedWatson/react-select/pull/2695) Thanks [SimeonC](https://github.com/SimeonC)
- [#2814](https://github.com/JedWatson/react-select/pull/2814) Added memoization to custom components within Select.js as well as in the exported makeAnimated factory method. Thanks to [Alex Reardon's](https://github.com/alexreardon) [memoize-one](https://github.com/alexreardon/memoize-one)
- [#2652](https://github.com/JedWatson/react-select/pull/2652), Async Select now re-evaluates defaultOptions on componentWillReceiveProps. Thanks [jesstelford](https://github.com/jesstelford)

## v2.0.0-beta.7 / 2018-07-03

- Removed old aria-attributes in Option, MenuList and other components in favor of an aria-live-region implementation. `screenReaderStatus` prop is still at the moment untouched, and `aria-labelledby` and `aria-label` props are still available and retain their functionality. See [#2581](https://github.com/JedWatson/react-select/pull/2581).
- Internal ref `input` is now `inputRef` for consistency.
- Internal ref `menuRef` is now `menuListRef` for consistency.
- Fixed bug with MultiValueRemove interaction not working in mobile [#2762](https://github.com/JedWatson/react-select/pull/2762), thanks [chuckbergeron](https://github.com/chuckbergeron).
- Added makeAnimated function export, that takes passed in components and wraps them in higher order components that expose animated functionality. [#2724](https://github.com/JedWatson/react-select/pull/2724)
- Added functionality to not render the menu if `noOptionsMessage` or `loadingMessage` are set to null. [#2754](https://github.com/JedWatson/react-select/pull/2754)
- Fixed bug with mobile menu being blocked when `menuShouldBlockScroll` is true.
  [#2756](https://github.com/JedWatson/react-select/pull/2756)
- Enabled hideSelectedOptions functionality for single-select as well. Changed logic so that if isMulti is true and hideSelectedOptions is not defined, we will hide selected options by default. Explicitly setting hideSelectedOptions will override this behaviour. https://github.com/JedWatson/react-select/pull/2753
- Updates to flow types, thanks [mike1808](https://github.com/mike1808), [himerus](https://github.com/himerus),
  [teamable-software](https://github.com/teamable-software) and
- Bumped internal flow-bin dependency to 0.72.0, [#2646](https://github.com/JedWatson/react-select/pull/2646) thanks [lunij](https://github.com/lunij)
- Fixed [#2701](https://github.com/JedWatson/react-select/issues/2701), use of un-polyfilled array.includes() in Select.js, this has now been subbed out for a IE compatible implementation.
- [#2733](https://github.com/JedWatson/react-select/issues/2733), fixed classname bug to do with prefixing classes with modifiers.
- [#2723](https://github.com/JedWatson/react-select/issues/2732), fixed emotion compilation bug blocking loadingDot rendering.
- [#2749](https://github.com/JedWatson/react-select/pull/2749) fixed typo in docs. thanks [JuhQ](https://github.com/juhq)
- [#2717](https://github.com/JedWatson/react-select/pull/2717) added selected value to onChange to accommodate multi-select, thanks [SimeonC](https://github.com/simeonc)

## v2.0.0-beta.6 / 2018-05-23

- Fixed bug with `css` attribute being wrongly applied to a DOM element in SingleValue. Thanks [guigs](http://github.com/guigs)
- Added `removedValue` to the `actionMeta` of the `remove-value` action that's passed into the `onChange` prop.
- Reverted previous change of `innerRef` in `innerProps` of custom Components to `ref`. The property is now once again named `innerRef`. This is mostly to resolve issues with styled-components not passing `ref` down to wrapped dom elements, however this is also a safer pattern to apply as it requires users providing their own custom components to explicitly associate the passed down ref with the requisite dom element.
- selectValue now filters items based on the getOptionValue method. Thanks (inv8der)[http://github.com/inv8der]
- Added `createOptionPosition` to creatable select to allow users to specify where the createOption element appears in the menu.
- Added touch handling logic to detect user intent to scroll the page when interacting with the select control.

## v2.0.0-beta.5 / 2018-05-18

- Added `controlShouldRenderValue` prop, defaults to true. Setting it to false disables rendering values in the control. Thanks[Joss Mackison](http://github.com/jossmac)

## v2.0.0-beta.4 / 2018-05-15

- Fixed bug where transition props were being spread onto the DummyInput causing react warnings in the console. Thanks [Mike Gardner](https://github.com/MikeLimeRocket)

## v2.0.0-beta.3 / 2018-05-14

**Note**: There is an important change in this release to the behaviour of `className`.

Previously, `className` would control the class names applied to internal components
as well as the containing element. Now, the `className` prop only controls the class
name of the containing element, and the new prop `classNamePrefix` controls classes
applies to internal components.

Until 2.0.0 final is released, we have added backwards compatibility and a deprecation
warning to cover this change.

- Added `classNamePrefix` prop, which now controls the class names applied to internal components
- Refactored cx internal implementation to reduce specificity of css-in-jss base styles.
- `maxValueHeight` prop removed
- Added `--is-disabled` className modifier to Option component, thanks [eemeli](https://github.com/eemeli)
- Fixed various IE11 issues, see [#2583](https://github.com/JedWatson/react-select/issues/2583)
- Added multi-value keyboard navigation using left and right arrows.
- Simplified flow distribution, thanks [falconmick](https://github.com/falconmick)
- Added fix to ensure focus is on the Input when the menu opens

## v2.0.0-beta.2 / 2018-04-25

- Switched from glam to [emotion](https://emotion.sh) for css-in-js
- Input colour can now be changed
- Use of React 16 Fragment removed, 2.0.0 should work with React 15
- SSR support improved
- Indicator icons are now exported

## v2.0.0-beta.1 / 2018-04-20

- Added `tabIndex` prop
- Added `classNames` prop
- Added upgrade guide from v1 --> v2
- Fixed bug with overflowing long values in the control
- Fixed ie11 bug to do with absolutely positioned children in flex parent.
- Documentation ie11, styling and copy improvements

## v2.0.0-alpha.11 / 2018-04-12

Minor fix since last alpha:

- Fixed a flow type issue that was causing issues for consumers

## v2.0.0-alpha.10 / 2018-04-10

Minor fix since last alpha:

- Fixed an issue with `dist/react-select.es.js` where `babelHelpers` weren't defined

## v2.0.0-alpha.9 / 2018-04-10

Ongoing rewrite. Major changes since last alpha:

- Added `openMenuOnClick` and `openMenuOnFocus` props
- Significant test coverage and documentation improvements
- Added `onMenuScrollToTop` and `onMenuScrollToBottom` event props
- `scrollMenuIntoView` prop renamed `menuShouldScrollIntoView`
- `onKeyDown` now based on event.key not event.keyCode
- Component ids no longer have double separators
- Fixed a Firefox bug with `position: absolute` and `display: flex`
- Added support for fixed position menu and scroll blocking
- Fixed issue with transition group props being passed to child components
- Fixed issue with portalled menu display when `menuPlacement="top"`

## v2.0.0-alpha.8 / 2018-02-20

Ongoing rewrite. Major changes since last alpha:

- Made `focus` and `blur` methods work consistently when composing HOCs
- Added `menuPortalTarget` prop which portals the menu, with a `MenuPortal` component and `menuPortal` style key
- Allow the `MultiValueRemove` component children to be changed
- Lots of new tests, updates to documentation and examples

## v2.0.0-alpha.7 / 2018-02-14

Ongoing rewrite. Major changes since last alpha:

- Significantly improved touch and mobile support
- New positioning behaviour for the Menu
- Added `scrollMenuIntoView` prop, which does exactly what you'd expect
- Added action meta to the `onInputChange` event handler arguments
- `Creatable` Component Added
- `AsyncCreatable` Component Added
- Fixed an issue with the layout that would trigger a Firefox repaint bug
- Improved behaviour when the `isDisabled` prop value is changed
- The `IndicatorSeparator` isn't rendered when there is no `DropdownIndicator`
- Converted `StateManager` to a higher order component
- New website, docs, and more tests! (still WIP)
- Examples can now be launched in CodeSandbox, thanks to [Ben Conolly](https://github.com/noviny)

## v2.0.0-alpha.6 / 2018-02-14

Ongoing rewrite. Major changes since last alpha:

- `menuIsOpen`, `inputValue` and `value` are now controllable props that default to internal state
- Fixed missing loading indicator
- Added "open in code sandbox" to all examples
- Switched menu rendering from li to div tags for better screen reader usability
- Removed unused primitives and simplified indicator components
- Improved accessibility of groups and options, cleaned up Group implementation
- Fixed some input alignment issues
- Added right-to-left support with `isRtl` prop
- Support blocking page scroll at menu boundaries with `captureMenuScroll` prop
- Added automatic menu flipping at window boundaries with `menuPlacement` and `menuShouldFlip` props
- Added `isSearchable` prop to support simple (not searchable) select inputs
- Added `pageSize` prop

## v2.0.0-alpha.5 / 2018-02-07

Ongoing rewrite. Major changes since last alpha:

- Fixed an issue where animated values would show ellipsis while leaving
- Long single values are now also correctly truncated

## v2.0.0-alpha.4 / 2018-02-06

Ongoing rewrite. Major changes since last alpha:

- Added support for Promises in the Async component
- Added `setValue` method on the Select class
- More consistent use of `innerProps` for internal components
- Internal components are now provided a consistent set of props and API
- Improved handling of keyboard and mouse interaction for options in the menu
- Default filtering behaviour now has parity with v1
- New `createFilter` method lets you customise the filter options
- Some unnecessary components have been removed for better performance
- Long values are now truncated

## v2.0.0-alpha.3 / 2018-02-02

Ongoing rewrite. Major changes since last alpha:

- Added `getOptionValue`, `getOptionLabel` and `formatOptionLabel` props
- Added `isOptionSelected` and `isOptionDisabled` props
- Added `name` and `delimiter` props to support hidden html inputs for forms
- Added `loadingMessage`, `noOptionsMessage` and `screenReaderStatus` props so messages can be customised
- Customisable components are now passed `innerProps` for simpler implementation
- Cleaned up internal Components and made sure they can all be styled
- Implemented customisable filtering function with support for case and diacritics
- Fixed various css bugs and vendor prefixing issues
- Accessibility improvements

## v2.0.0-alpha.2 / 2018-01-25

Ongoing rewrite. Major changes since last alpha:

- `Async` component added
- `styles` prop added to Select component
- `isLoading` prop to Select component and new indicator added
- Support added for disabled options
- Internal components cleaned up
- Cypress tests added
- CSS class names added to default components
- Accessibility improvements

## v2.0.0-alpha.1 / 2018-01-12

Complete rewrite, docs and upgrade notes on changes from v1 to come later.

## v1.2.1 / 2018-01-13

- Fixed blocking the Del key when deleteRemoves is false, thanks [Nachtigall, Jens (init)](https://github.com/jnachtigall) - [see PR](https://github.com/JedWatson/react-select/pull/2291)
- Fixed inline-block rendering for arrowRenderer without autosize, thanks [Harry Kao](https://github.com/harrykao) - [see PR](https://github.com/JedWatson/react-select/pull/2276)
- Fixed dropdown menu positioning issues in IE 11, thanks [jharris4](https://github.com/jharris4) - [see PR](https://github.com/JedWatson/react-select/pull/2273)
- Added missing rule to the `scss` stylesheet, thanks [Jordan Whitfield](https://github.com/mantissa7) - [see PR](https://github.com/JedWatson/react-select/pull/2280)
  > > > > > > > master

## v1.2.0 / 2018-01-08

- Source cleanup, thanks to [Yuri S](https://github.com/yuri-sakharov) and
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2262)
- Switched from babel-preset-es2015 to babel-preset-env, thanks
  [Rambabu Yadlapalli](https://github.com/RamYadlapalli) -
  [see PR](https://github.com/JedWatson/react-select/pull/2254)
- Fixed focused option. Issue #2237, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2245)
- Fix onSelectResetsInput bug from keyboard navigation, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2259)
- Fixed all warnings on running tests, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2231)
- Added missing tests for Option.js and refactored Option-test.js., thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2249)
- Added missing tests for Async.js, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2250)
- Fixed console error in GitHub users example, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2244)
- Fixed readme example. Issue #2235, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2246)
- Regression fix for single select with onSelectResetsInput=false, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2226)
- Pass placeholder prop to ValueComponent, thanks
  [Aravind Srivatsan](https://github.com/aravindsrivats) -
  [see PR](https://github.com/JedWatson/react-select/pull/2225)
- Refactored handleKeyDown switch, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2228)
- onSelectResetsInput regression fixed, thanks
  [Jed Watson](https://github.com/dehamilton) -
  [see PR](https://github.com/JedWatson/react-select/pull/2215)
- Don't open drop down menu when clear values, thanks
  [Jed Watson](https://github.com/Chopinsky) -
  [see PR](https://github.com/JedWatson/react-select/pull/2198)
- Clear input value on receiving props with another value., thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2183)
- Fix/is option unique crash, thanks [Jacob Zuo](https://github.com/Chopinsky) -
  [see PR](https://github.com/JedWatson/react-select/pull/2185)
- Use react-input-autosize v2.1.2 for guard against undefined window, thanks
  [DStyleZ](https://github.com/sximba) -
  [see PR](https://github.com/JedWatson/react-select/pull/2187)
- Fix issue #2182, thanks [Kurt Hoyt](https://github.com/kurtinatlanta) -
  [see PR](https://github.com/JedWatson/react-select/pull/2213)
- Documenting behavior of onBlurResetsInput in the readme., thanks
  [hobbsl](https://github.com/levininja) -
  [see PR](https://github.com/JedWatson/react-select/pull/2212)
- Use onSelectResetsInput for single select, thanks
  [lachiet](https://github.com/lachiet) -
  [see PR](https://github.com/JedWatson/react-select/pull/2205)
- Fix state value in README example, thanks
  [Srishan Bhattarai](https://github.com/srishanbhattarai) -
  [see PR](https://github.com/JedWatson/react-select/pull/2192)
- document breaking change of removing getInputValue, thanks
  [Turadg Aleahmad](https://github.com/turadg) -
  [see PR](https://github.com/JedWatson/react-select/pull/2195)
- Fixed search for invalid label and/or value, thanks
  [Yuri S](https://github.com/yuri-sakharov) -
  [see PR](https://github.com/JedWatson/react-select/pull/2179)

## v1.1.0 / 2017-11-28

- added; more props are passed to the Option component: `focusOption`,
  `inputValue`, `selectValue`, `removeValue`
- added; the `inputValue` is passed as the third argument to the
  `optionRenderer`
- fixed; issues opening the menu correctly for multiselect when
  `autosize={false}`
- fixed; removed `event.stopPropagation()` from Select's `clearValue` and
  `onClick` handlers, thanks [Thomas Burke](https://github.com/etburke)
- fixed; `handleMouseDownOnArrow` when `openOnClick={false}`, thanks
  [elias ghali](https://github.com/elghali)
- fixed; conditional scrolling into view of focused option, thanks
  [Michael Lewis](https://github.com/mtlewis)

## v1.0.1 / 2017-11-24

- reintroduced source files for scss and less stylesheets into the npm package

## v1.0.0 / 2017-11-23

- breaking; removed `getInputValue` function -
  [see PR](https://github.com/JedWatson/react-select/pull/2108)
- reverted spacebar-selects-option behaviour for searchable selects, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2163)
- fixed behaviour where async doesn't handle onInputChange returning a value,
  thanks [Anton](https://github.com/tehbi4) -
  [see PR](https://github.com/JedWatson/react-select/pull/2133)
- fixed Creatable bug where the first enter keypress is ignored when
  `promptTextCreator` returns only the label, thanks
  [George Karagkiaouris](https://github.com/karaggeorge) -
  [see PR](https://github.com/JedWatson/react-select/pull/2140)
- Utility functions are now exported from the es6 build, thanks
  [Deiru](https://github.com/Deiru2k) -
  [see PR](https://github.com/JedWatson/react-select/pull/2154)
- Update aria-only class to have absolute positioning, thanks
  [Jacob Hilker](https://github.com/JHilker) -
  [see PR](https://github.com/JedWatson/react-select/pull/1243)
- gives possibility to use ref property for Creatable, thanks
  [blacktemplar](https://github.com/blacktemplar) -
  [see PR](https://github.com/JedWatson/react-select/pull/1646)
- Adds lint and test pre-commit hooks, thanks
  [carymcpoland](https://github.com/mcpolandc) -
  [see PR](https://github.com/JedWatson/react-select/pull/2077)
- Disable some browser-specific behaviours that break the input, thanks
  [Jed Watson](https://github.com/JedWatson) -
  [see PR](https://github.com/JedWatson/react-select/pull/2101)
- onOpen: run after dom has rendered, thanks
  [Karl-Aksel Puulmann](https://github.com/macobo) -
  [see PR](https://github.com/JedWatson/react-select/pull/#1756)
- fix not clearing when given invalid values, from #1756, thanks
  [Mário][https://github.com/ticklemynausea] -
  [see PR](https://github.com/JedWatson/react-select/pull/2100)
- Exports Option Component, thanks
  [Erkelens, Jan Paul](https://github.com/jperkelens) -
  [see PR](https://github.com/JedWatson/react-select/pull/2097)
- Fix/numeric multi select, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2086)
- removeSelected prop (round 2), for optionally keeping selected values in
  dropdown, thanks [Jed Watson](https://github.com/banderson) -
  [see PR](https://github.com/JedWatson/react-select/pull/1891)
- pass removeValue() and always pass valueArray, thanks
  [kcliu](https://github.com/kcliu) -
  [see PR](https://github.com/JedWatson/react-select/pull/1850)
- Accessibility Enhancements - Aria tags, Space/Enter keys, thanks
  [sushmabadam](https://github.com/sushmabadam) -
  [see PR](https://github.com/JedWatson/react-select/pull/1428)
- added rtl support, thanks [Dekel](https://github.com/dekelb) -
  [see PR](https://github.com/JedWatson/react-select/pull/1613)
- Add inputValue to menuRenderer, thanks
  [headcanon](https://github.com/chronick) -
  [see PR](https://github.com/JedWatson/react-select/pull/1732)
- fix typo in handleKeyDown method, thanks
  [jasonchangxo](https://github.com/jasonchangxo) -
  [see PR](https://github.com/JedWatson/react-select/pull/2088)
- Fix/numeric multi select, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2086)
- expose children in AsyncCreatable.js, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2084)
- replace trim fn loop with regex, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2085)
- Trim search text from beginning and the end. (fixes #1861), thanks
  [Serkan Ozer](https://github.com/serkanozer) -
  [see PR](https://github.com/JedWatson/react-select/pull/1862)
- Add variable for focused input background, thanks
  [Aron Strandberg](https://github.com/aronstrandberg) -
  [see PR](https://github.com/JedWatson/react-select/pull/1998)
- Added id in the input select, thanks
  [thecreazy](https://github.com/thecreazy) -
  [see PR](https://github.com/JedWatson/react-select/pull/2027)
- adding a nvmrc file and adding coverage to eslintignore, thanks
  [Dave Birch](https://github.com/uxtx) -
  [see PR](https://github.com/JedWatson/react-select/pull/1137)
- Updated the comment for the deleteRemoves option., thanks
  [Abul Dider](https://github.com/dider7) -
  [see PR](https://github.com/JedWatson/react-select/pull/2078)
- implemented optional rendering of arrow, thanks
  [rolandjohann](https://github.com/rolandjohann) -
  [see PR](https://github.com/JedWatson/react-select/pull/1761)
- Skip rendering arrow wrapper when custom arrow renderer returns falsy value,
  thanks [Mike Lewis](https://github.com/mtlewis) -
  [see PR](https://github.com/JedWatson/react-select/pull/2055)
- do not show clear button if value is an empty string, thanks
  [Marie Godon](https://github.com/mariegodon) -
  [see PR](https://github.com/JedWatson/react-select/pull/2074)
- Set isLoading to false if cache hit, thanks
  [timhwang21](https://github.com/timhwang21) -
  [see PR](https://github.com/JedWatson/react-select/pull/2042)
- Add aria-labels to Options, thanks
  [jasonchangxo](https://github.com/jasonchangxo) -
  [see PR](https://github.com/JedWatson/react-select/pull/2036)
- Adds source links to each example, thanks
  [Damon Bauer](https://github.com/damonbauer) -
  [see PR](https://github.com/JedWatson/react-select/pull/2051)
- Issue #2056: onInputChange should return modified value, thanks
  [Caleb Scholze](https://github.com/cscholze) -
  [see PR](https://github.com/JedWatson/react-select/pull/2057)
- Remove option `addLabelText` from README and propTypes, thanks
  [Jannes Jeising](https://github.com/jjeising) -
  [see PR](https://github.com/JedWatson/react-select/pull/2040)
- GitHub has a capital H, thanks
  [David Baumgold](https://github.com/singingwolfboy) -
  [see PR](https://github.com/JedWatson/react-select/pull/2053)
- refactor componentWillUnmount(), thanks
  [riophae](https://github.com/riophae) -
  [see PR](https://github.com/JedWatson/react-select/pull/2064)
- Slim down NPM package, thanks [Valentin Agachi](https://github.com/avaly) -
  [see PR](https://github.com/JedWatson/react-select/pull/2062)
- Update contributing doc, thanks [Gregg Brewster](https://github.com/greggb) -
  [see PR](https://github.com/JedWatson/react-select/pull/2059)
- strip proptypes in production build (fixes #1882), thanks
  [Jochen Berger](https://github.com/jochenberger) -
  [see PR](https://github.com/JedWatson/react-select/pull/2003)
- Support Webpack 2, Webpack 3, rollup., thanks
  [Matthew Schnee](https://github.com/mschnee) -
  [see PR](https://github.com/JedWatson/react-select/pull/2020)
- Add missing semicolon, thanks
  [jochenberger](https://github.com/jochenberger) -
  [see PR](https://github.com/JedWatson/react-select/pull/2018)
- autofocus --> autoFocus, thanks
  [Charles Lee](https://github.com/gwyneplaine) -
  [see PR](https://github.com/JedWatson/react-select/pull/2002)
- Async> cache async response regardless of req order, thanks
  [Timothy Hwang](https://github.com/timhwang21) -
  [see PR](https://github.com/JedWatson/react-select/pull/2012)
- Make this work in preact., thanks [liaoxuezhi](https://github.com/2betop) -
  [see PR](https://github.com/JedWatson/react-select/pull/2013)
- Correct release candidate version on README, thanks
  [Damon Aw](https://github.com/daemonsy) -
  [see PR](https://github.com/JedWatson/react-select/pull/2017)
- Fix test name, thanks [jochenberger](https://github.com/jochenberger) -
  [see PR](https://github.com/JedWatson/react-select/pull/2005)
- Fixing css states to be scoped with Select selector, closes #1951., thanks
  [Adam Girton](https://github.com/agirton) -
  [see PR](https://github.com/JedWatson/react-select/pull/2000)
- fix typo, thanks [jochenberger](https://github.com/jochenberger) -
  [see PR](https://github.com/JedWatson/react-select/pull/1999)

## v1.0.0-rc.10 / 2017-09-13

- changed; `openAfterFocus` prop has been renamed to `openOnClick`, and now
  defaults to `true`
- fixed; React.PropTypes deprecation warning, thanks
  [Jeremy Liberman](https://github.com/MrLeebo)
- improved; scrolling behaviour when navigating the menu with the keyboard,
  thanks [boatkorachal](https://github.com/boatkorachal)
- fixed; error with the `Async` cache when you type `"hasOwnProperty"`, thanks
  [SuhushinAS](https://github.com/SuhushinAS)

## v1.0.0-rc.9 / 2017-09-13

- fixed; clearable padding style, thanks
  [Minori Miyauchi](https://github.com/mmiyauchi)
- fixed; removed use of `Object.assign`, fixes IE compatibility
- added; new `closeOnSelect` prop (defaults to `true`) that controls whether the
  menu is closed when an option is selected, thanks to
  [Michael Elgar](https://github.com/melgar) for the original idea
- changed; by default, the menu for multi-selects now closes when an option is
  selected
- changed; `Async` component no longer always clears options when one is
  selected (although the menu is now closed by default). Use
  `closeOnSelect={false} onSelectResetsInput={false}` to leave the menu open.
- fixed; `Async` component always called `onChange` even when it wasn't provided
- fixed; input lag for the `Async` component when results are returned from
  cache
- fixed; required was not being updated without an onChange handler
- fixed; peer dependencies for `prop-types`, thanks
  [Michaël De Boey](https://github.com/MichaelDeBoey)
- fixed; internal optimisations, thanks
  [Kieran Boyle](https://github.com/dysfunc)
- added; `Value` component is now exported, thanks
  [Prof Gra](https://github.com/Grahack)
- fixed; callback fired after `Async` component unmounts, thanks
  [Andrew Russell](https://github.com/DeadHeadRussell)
- fixed; wrapping on Firefox in SCSS files, thanks
  [Michael Williamson](https://github.com/mwilliamson)

## v1.0.0-rc.8 / 2017-09-12

- fixed; `onMenuScrollToBottom` does not work in chrome 58.0, thanks
  [Simon Hartcher](https://github.com/deevus)
- fixed; missing es6 module build for `js:next` entrypoint
- updated; `react-input-autosize@2.0.0` including several fixes for react-select
  (see
  [changes](https://github.com/JedWatson/react-input-autosize/blob/master/HISTORY.md))

## v1.0.0-rc.7 / 2017-09-11

- fixed; issue with `lib` build preventing use in ES2015 environments

## v1.0.0-rc.6 / 2017-09-10

- fixed; changing `required` prop from `true` to `false` now works as expected,
  thanks [George Karagkiaouris](https://github.com/karaggeorge)
- added; new prop `onSelectResetsInput` controls whether the input value is
  cleared when options are selected, thanks
  [David Roeca](https://github.com/davidroeca) and
  [Alexander Nosov](https://github.com/nosovsh)
- fixed; tabindex parent bug fix for Edge, thanks
  [George Payne](https://github.com/George-A-Payne)
- fixed; update selectize link in README.md, thanks
  [kerumen](https://github.com/kerumen)
- added; standard issue template, thanks [agirton](https://github.com/agirton)
- added; new build process using rollup and webpack. Removed grunt. thanks
  [gwyneplaine](https://github.com/gwyneplaine)
- fixed; updated contributor docs with the correct node version reference
  [gwyneplaine](https://github.com/gwyneplaine)
- fixed; missing method binds in Option, thanks
  [agirton](https://github.com/agirton)
- fixed; converted components to use es6 classes, thanks
  [jochenberger](https://github.com/jochenberger)
- fixed; console.log example in usage docs, thanks
  [rohmanhm](https://github.com/rohmanhm)
- fixed; hide create option after closing menu, thanks
  [andreme](https://github.com/andreme)
- fixed; remove circular reference, thanks [agirton](https://github.com/agirton)
- fixed; readme typo, thanks [ieldanr](https:/github.com/ieldanr)
- fixed; add missing function binds in Option component, thanks
  [agirton](https://github.com/agirton) and
  [blacktemplar](https://github.com/blacktemplar)
- fixed; re-added fix to
  [#1580](https://github.com/JedWatson/react-select/issues/1580), thanks
  [agirton](https://github.com/agirton)
- fixed; avoid mutating user inputs when ignoring case/accents, thanks
  [not-an-aardvark](https://github.com/not-an-aardvark)
- fixed; issues synchronising options props in `Async`, thanks
  [cbergmiller](https://github.com/cbergmiller)
- fixed; backspace handling for non-multi select controls, thanks
  [Jeremy Liberman](https://github.com/MrLeebo)

## v1.0.0-rc.5 / 2017-05-25

- fixed; Allow `falsey` values to be clearable, thanks
  [Simon Gaestel](https://github.com/sgaestel)
- fixed; issue where Firefox would crash due to incorrect use of `aria-owns`
  attribute, thanks [Max Hubenthal](https://github.com/mhubenthal)
- fixed; regression where options not using the value key couldn't be focused,
  thanks [Benjamin Piouffle](https://github.com/Betree)

## v1.0.0-rc.4 / 2017-05-14

- fixed; no more warning when using React 15.5, thanks
  [Adam Girton](https://github.com/agirton)
- fixed; issue comparing objects in `getFocusableOptionIndex`, thanks
  [rndm2](https://github.com/rndm2)
- fixed; missing .focus() method in `Creatable`, thanks
  [Anton Alexandrenok](https://github.com/the-spyke)
- added; support for `aria-describedby` attribute, thanks
  [Eric Lee](https://github.com/ericj17)
- added; `.is-clearable` className when clearable is true, thanks
  [Dan Diaz](https://github.com/dan-diaz)

## v1.0.0-rc.3 / 2017-02-01

- added; `arrowRenderer` prop, thanks [Brian Vaughn](https://github.com/bvaughn)
- added; child-function support to `Async` and `Creatable` components so that
  they can compose each other (or future HOCs), thanks
  [Brian Vaughn](https://github.com/bvaughn)
- added; `asyncCreatable` HOC that combines `Async` and `Creatable` so they can
  be used together, thanks [Brian Vaughn](https://github.com/bvaughn)
- added; undocumented arguments for `menuRenderer`, thanks
  [Julian Krispel-Samsel](https://github.com/juliankrispel)
- fixed; Do not focus and open menu when disabled, thanks
  [nhducit](https://github.com/nhducit)
- fixed; Scrolling with arrow-keys is not working correctly, thanks
  [Damian Pieczynski](https://github.com/piecyk)
- added; "select all text" functionality `Shift+Home|Del`, thanks
  [Damian Pieczynski](https://github.com/piecyk)
- added; support for `boolean` values, thanks
  [Aaron Hardy](https://github.com/Aaronius)
- fixed; Remove duplicated `promptTextCreator` field from readme, thanks
  [Jih-Chi Lee](https://github.com/jihchi)
- fixed; Adding back ref that was removed in rc2, thanks
  [Martin Jujou](https://github.com/jooj123)
- fixed; `Creatable` component doesn't allow input key down handling, thanks
  [Ivan Leonenko](https://github.com/IvanLeonenko)
- added; Allow react nodes to be passed as loadingPlaceholder, thanks
  [Daniel Heath](https://github.com/DanielHeath)
- fixed; IE8 compatibility issues, thanks
  [Kirill Mesnyankin](https://github.com/strayiker)
- improved; Allow users to specify noResultsText, thanks
  [Daniel Heath](https://github.com/DanielHeath)
- added; Only remove options if a loading placeholder is available, thanks
  [Daniel Heath](https://github.com/DanielHeath)
- fixed; firefox display items in two rows due to reflow, thanks
  [Daniel Heath](https://github.com/DanielHeath)
- fixed; `Creatable` readme typo, thanks [Ben](https://github.com/rockingskier)
- fixed; explain way to implement `allowCreate` functionality with `Creatable`
  to readme, thanks [mayerwin](https://github.com/mayerwin)
- added; delete key removes an item when there is no input, thanks
  [forum-is](https://github.com/forum-is)
- added; `onNewOptionClick` handler for `Creatable`, thanks
  [Lee Siong Chan](https://github.com/leesiongchan)
- fixed; `onInputChange` consistent for `Creatable`, thanks
  [Lee Siong Chan](https://github.com/leesiongchan)
- fixed; `menuRenderer` is treated consistently between `Creatable` and
  `Select`, thanks [Brian Vaughn](https://github.com/bvaughn)
- fixed; `asyncCreatable` options parsing will not parse undefined values into
  props, thanks [Romain Dardour](https://github.com/unity)
- added; pass `inputProps` to `inputRenderer`, thanks
  [Alec Winograd](https://github.com/awinograd)
- fixed; no exception when clearing an Async field that is not set to multi,
  thanks [Patrik Stutz](https://github.com/VanCoding)
- added; allow rendering a custom clear component, thanks
  [Conor Hastings](https://github.com/conorhastings)
- fixed; document `ignoreAccents`, thanks
  [Domenico Matteo](https://github.com/dmatteo)
- fixed; arrowing up or down in `Select` with 0 options does not throw type
  error, thanks [Alex Howard](https://github.com/thezanke)
- fixed; `Creatable` handles null children prop, thanks
  [Jack Coulter](https://github.com/jscinoz)
- added; provide `isOpen` to arrowRenderer, thanks
  [Kuan](https://github.com/khankuan)
- fixed; re-added the `focus()` method on `Select.Async`, thanks,
  [Maarten Claes](https://github.com/mcls)
- fixed; focus the next available option after a selection, not the top option,
  thanks [Nicolas Raynaud](https://github.com/nraynaud)

Note there has also been a breaking change to the props for the `Async`
component: both `minimumInput` and `searchingText` have been removed. See #1226
for more details. Apologies for doing this in an RC release, but we had to trade
off between resolving some important bugs and breaking the API, and figured it
was better to do this before declaring 1.0.0 stable.

## v1.0.0-rc.1 / 2016-09-04

- fixed; reset value to `[]` when `multi=true`, thanks
  [Michael Williamson](https://github.com/mwilliamson)
- added; pass index to `renderLabel` method, thanks
  [nhducit](https://github.com/nhducit)
- fixed; uncontrolled to controlled component warning in React 15.3
- fixed; props cleanup, thanks
  [Forbes Lindesay](https://github.com/ForbesLindesay)
- fixed; issue where a value of the number `0` would be assumed to be no value,
  thanks [Hanwen Cheng](https://github.com/hanwencheng)
- fixed; internal refs converted to callbacks instead of strings, thanks
  [Johnny Nguyen](https://github.com/gojohnnygo)
- added; optional `instanceId` prop for server-side rendering, thanks
  [Jevin Anderson](https://github.com/JevinAnderson)
- added; `onCloseResetsInput` prop, thanks
  [Frankie](https://github.com/frankievx)
- added; `Creatable` component, replaces pre-1.0 `allowCreate` prop, thanks
  [Brian Vaughn](https://github.com/bvaughn)

## v1.0.0-beta14 / 2016-07-17

- fixed; `react-input-autosize` has been udpated to `1.1.0`, which includes
  fixes for the new warnings that React 15.2 logs
- fixed; "Unknown prop `inputClassName` on <div> tag" warning, thanks
  [Max Stoiber](https://github.com/mxstbr)
- fixed; Removed unnecessary `onUnfocus`, thanks
  [Johnny Nguyen](https://github.com/gojohnnygo)
- added; Support for react components in `searchPromptText`, thanks
  [Matt](https://github.com/hellaeon)
- fixed; focus bug on iOS, thanks
  [Tony deCatanzaro](https://github.com/tonydecat)
- fixed; Async bugs with Promises, thanks
  [Vladimir](https://github.com/VladimirPal) and
  [Ian Firkin](https://github.com/lobsteropteryx)
- fixed; `searchingText` bug, thanks
  [Tony deCatanzaro](https://github.com/tonydecat)
- improved; More antive-like input behaviour, thanks
  [Johnny Nguyen](https://github.com/gojohnnygo)
- fixed; Added missing unit (px) to `minWidth` attribute, thanks
  [Ian Witherow](https://github.com/ianwitherow)
- added; Support for assistive technologies, thanks
  [Dave Brotherstone](https://github.com/bruderstein)
- fixed; React error if `onChange` callback causes a root component to unmount,
  thanks [Nathan Norton](https://github.com/Xesued)
- fixed; Open menu is now closed if `disabled` becomes true, thanks
  [Jason Moon](https://github.com/jsnmoon)
- fixed; Prevent `getFocusableOptionIndex` from returning a disabled option,
  thanks [Brian Powers](https://github.com/brianspowers)
- added; Home, End, Page Up/Down support, thanks
  [Jason Kadrmas](https://github.com/blackjk3)
- fixed; Don't render `backspaceToRemoveMessage` if `backspaceRemoves` is set to
  false, thanks [Ryan Zec](https://github.com/ryanzec)
- fixed; Issue with an outline appearing on the auto sized input, thanks
  [Ryan Zec](https://github.com/ryanzec)
- fixed; Events don't propagate when `esc` is pressed, thanks
  [Yoshihide Jimbo](https://github.com/jmblog)
- fixed; Update `required` prop based on nextProps on update, thanks
  [Matt Shwery](https://github.com/mshwery)
- fixed; On focus check whether input ref is a real input or an input component,
  thanks [Peter Brant](https://github.com/pbrant) and
  [Greg Poole](https://github.com/gpoole)

Also a big thanks to [Brian Vaughn](https://github.com/bvaughn) for his help
triaging issues for this release!

## v1.0.0-beta13 / 2016-05-30

- added; `inputRenderer` prop, allows you to override the input component,
  thanks [Sean Burke](https://github.com/leftmostcat)
- added; `openOnFocus` prop, causes the menu to always open when the select
  control is focused, thanks
  [HuysentruytRuben](https://github.com/HuysentruytRuben)
- added; `react-virtualised-select` HOC example, thanks
  [Brian Vaughn](https://github.com/bvaughn)
- added; `tabSelectsValue` prop can be set to false to prevent selection of
  focused option when tab is pressed, thanks
  [Byron Anderson](https://github.com/byronanderson)
- added; ability to override `resetValue` when clearing the control, thanks
  [Alexander Luberg](https://github.com/LubergAlexander)
- added; input can be updated with `onInputChange`, thanks
  [Brett DeWoody](https://github.com/brettdewoody)
- added; Styles for .is-selected class, thanks
  [Danny Herran](https://github.com/dherran)
- fixed; `noResultsText` prop type is now `stringOrNode` for Async component,
  thanks [Michael Groeneman](https://github.com/mgroeneman)
- fixed; `onInputChange` is wrapped by Async component, thanks
  [Eric O'Connell](https://github.com/drd)
- fixed; `scrollMenuIntoView` behaviour in IE10, thanks
  [Ivan Jager](https://github.com/aij)
- fixed; isEqualNode replaced with strict equality check, thanks
  [Alexandre Balhier](https://github.com/abalhier)
- fixed; issue with value object not being passed to `handleRequired`, thanks
  [Andrew Hite](https://github.com/andyhite)
- fixed; the menu-outer container is no longer rendered when it does not contain
  anything, thanks [Kuan](https://github.com/khankuan)
- improved; better support for IE8 in styles, thanks
  [Rockallite Wulf](https://github.com/rockallite)

## v1.0.0-beta12 / 2016-04-02

- added; `menuRenderer` method and example for effeciently rendering thousands
  of options, thanks [Brian Vaughn](https://github.com/bvaughn)
- added; `optionClassName` prop, thanks [Max Tyler](https://github.com/iam4x)

## v1.0.0-beta11 / 2016-03-09

- updated dependencies to allow use with React 15.x
- changed; multiple selected values are now submitted using multiple inputs,
  thanks [Trinh Hoang Nhu](https://github.com/james4388)
- added; `joinValues` prop to revert the above change and submit multiple values
  in a single field with the delimiter

## v1.0.0-beta10 / 2016-02-23

- fixed build issues with v1.0.0-beta9

## v1.0.0-beta9 / 2016-02-12

- added; onBlurResetsInput prop, thanks
  [Sly Bridges](https://github.com/slybridges)
- changed; Enter selects and retains focus, Tab selects and shifts focus, thanks
  [RDX](https://github.com/rdsubhas)
- fixed; Hide noResultsText when value is falsy, thanks
  [Fernando Alex Helwanger](https://github.com/fhelwanger)
- added; `required` prop, adds HTML5 required attribute, thanks
  [Domenico Matteo](https://github.com/dmatteo)
- fixed; Touch drag behaviour, thanks
  [Pavel Tarnopolsky](https://github.com/Paveltarno)
- added; `onOpen` and `onClose` event props, thanks
  [Jacob Page](https://github.com/DullReferenceException)
- fixed; Pressing Enter on open Select should stop propagation, thanks
  [Jeremy Liberman](https://github.com/MrLeebo)
- fixed; Missing handleMouseDownOnMenu, thanks
  [Jeremy Liberman](https://github.com/MrLeebo)
- added; Ensures the selected option is immediately visible when the menu is
  open, thanks [Martin Jujou](https://github.com/jooj123)
- added; `autoBlur` prop, blurs the input when a value is selected, thanks
  [Pavel Tarnopolsky](https://github.com/Paveltarno)
- fixed; Several isFocused checks weren't working properly

## v1.0.0-beta8 / 2015-12-20

- fixed; input focus bug when toggling `disabled` prop, thanks
  [Davide Curletti](https://github.com/dcurletti)
- fixed; `focus()` is now exposed on the `Async` component, thanks
  [AugustinLF](https://github.com/AugustinLF)

## v1.0.0-beta7 / 2015-12-15

- You can now use React elements for placeholders and the text props, thanks
  [kromit](https://github.com/kromit) and
  [Alyssa Biasi](https://github.com/alyssaBiasi)
- Fixed a problem where the border doesn't show when the element is inside a
  table, thanks [Rodrigo Boratto](https://github.com/rwrz)
- New prop `scrollMenuIntoView` scrolls the viewport to display the menu, thanks
  [Alexander Zaharakis](https://github.com/azaharakis)
- New LESS / SCSS variable `select-option-bg` lets you control the menu option
  background color, thanks [Evan Goldenberg](https://github.com/Naveg)
- Fixed an error in the blur handler on IE when the menu is not visible, thanks
  [Gaston Sanchez](https://github.com/gaastonsr)
- Added support for a `clearableValue` option property in `multi` mode, thanks
  [Sly Bridges](https://github.com/slybridges)

## v1.0.0-beta6 / 2015-11-29

- Test suite complete and passing, with a couple of minor fixes thanks to
  @bruderstein

## v1.0.0-beta5 / 2015-11-08

- Fixes issues relating to serializing simple values into the hidden field

## v1.0.0-beta4 / 2015-11-08

- New default styles that match [Elemental UI](http://elemental-ui.com) and look
  right at home in the new [KeystoneJS Admin UI](http://keystonejs.com)

We're potentially going to ship some theme stylesheets in the future, shout out
on GitHub if this interests you.

## v1.0.0-beta3 / 2015-11-08

- The selected value populated in the hidden field has been fixed (was `"[object Object]"` before)
- Added new `autofocus` prop
- Fixed duplicate key error for options and values with duplicate `value`
  properties
- SCSS variables now have `!default` so you can override them

## v1.0.0-beta2 / 2015-11-06

Changed since beta 1:

- Async options cache works again
- New style props for custom styling the component without modifying css
  classes: `style` `wrapperStyle` `menuStyle` `menuContainerStyle`
- The menu opens and closes correctly when `searchable={false}`, there is still
  some work to do on this use-case

## v1.0.0-beta1 / 2015-11-06

This is a complete rewrite. Major changes include:

- Everything is simpler (I'm nearly done and the source code is only 60% of the
  size of the last version)
- No more timeouts or weird handlers, the restructuring has let me make
  everything more straight-forward
- The options array is no longer preprocessed into state, just retrieved from
  props
- The values array is now initialised in the Options array during render, and
  not stored in state, which along with the change to options makes the
  component more reliable and fixes issues with props not updating correctly
- The component no longer stores its own value in state (ever) - it needs to be
  passed as a prop and handled with `onChange`.
- Complex values are now enabled by default (so you're passed the option object,
  not its value); you can enable the legacy mode with a prop
- The Value and Option components have been cleaned up as well for consistency
- The hidden `<input>` field is now optional and the component is better suited
  to use in a rich React.js app than it was
- You can disable options filtering to do the filtering externally with
  `onInputChange`
- Accents on characters can now be ignored
- The `asyncOptions` prop has been replaced by a new wrapper component:
  `Select.Async`

Note that "Tag mode" (creating options on the fly) isn't reimplemented yet.

A full guide to the breaking changes and new features will be written up soon.
In the meantime please see the new examples.

## v0.9.1 / 2015-11-01

- added; new Contributors example w/ async options loading and custom value /
  label keys
- fixed; several issues with custom `valueKey` and `labelKey` props
- fixed; autoload now loads options with no search input

## v0.9.0 / 2015-10-29

- added; SCSS stylesheets!
- improved; Options rendering should be more performant
- breaking change; Custom `Option` components now need to pass their `option`
  prop to event handlers; see
  [this commit](https://github.com/JedWatson/react-select/commit/89af12a80a972794222b193a767f44234bbe9817)
  for an example of the required change.

## v0.8.4 / 2015-10-27

- fixed; LESS math operations now work with --strict-math=on, thanks
  [Vincent Fretin](https://github.com/vincentfretin)

## v0.8.3 / 2015-10-27

- fixed; IE issue where clicking the scrollbar would close the menu, thanks
  [Pete Nykänen](https://github.com/petetnt)

## v0.8.2 / 2015-10-22

- added; Promise support for `loadAsyncOptions`, thanks
  [Domenico Matteo](https://github.com/dmatteo)

## v0.8.1 / 2015-10-20

- fixed; `loadAsyncOptions` raises TypeError in setup, see #439 for details,
  thanks [Pancham Mehrunkar](https://github.com/pancham348)

## v0.8.0 / 2015-10-19

This release contains significant DOM structure and CSS improvements by
@jossmac, including:

- no more `position: absolute` for inner controls
- `display: table` is used for layout, which works in IE8 and above, and
  [all other modern browsers](http://caniuse.com/#feat=css-table)
- less "magic numbers" used for layout, should fix various browser-specific
  alignment issues
- clear "x" control now animates in
- clearer `.Select--multi` className replaces `.Select.is-multi`
- new height & theme variables
- "dropdown" indicator chevron is no longer displayed for multi-select controls

There are no functional changes, but if you've forked the LESS / CSS to create
your own theme you'll want to pay close attention to PR #527 when upgrading to
this version.

## v0.7.0 / 2015-10-10

React Select is updated for React 0.14. If you're still using React 0.13, please
continue to use `react-select@0.6.x`. There are no functional differences
between v0.7.0 and v0.6.12.

Additionally, our tests now require Node.js 4.x. If you are developing
`react-select`, please make sure you are running the latest version of node.

Thanks to @bruderstein, @dmatteo and @hull for their help getting these updates
shipped!

## v0.6.12 / 2015-10-02

- added; `labelKey` and `valueKey` props, so you can now use different keys in
  `option` objects for the label and value
- fixed; additional `isMounted()` checks in timeouts
- fixed; componentDidUpdate timeout is reset correctly, see #208 and #434,
  thanks [Petr Gladkikh](https://github.com/PetrGlad)
- fixed; mousedown event on scrollbar in menu no longer hides it, thanks
  [Yishai Burt](https://github.com/burtyish)

## v0.6.11 / 2015-09-28

- added; `isLoading` prop, allows indication of async options loading in
  situations where more control is required, thanks
  [Jon Gautsch](https://github.com/jgautsch)

## v0.6.10 / 2015-09-24

- fixed; a build issue with the previous release that prevented the stylesheet
  being generated / included
- fixed; a LESS syntax issue, thanks [Bob Cardenas](https://github.com/bcardi)

## v0.6.9 / 2015-09-19

- added; `style` key for package.json, thanks
  [Stephen Wan](https://github.com/stephen)
- added; `onInputChange` handler that returns the current input value, thanks
  [Tom Leslie](https://github.com/lomteslie)
- fixed; simplifying handleKey function & preventDefault behaviour, thanks
  [davidpene](https://github.com/davidpene)
- fixed; Display spinner while auto-loading initial data, thanks
  [Ben Jenkinson](https://github.com/BenJenkinson)
- fixed; better support for touch events, thanks
  [Montlouis-Calixte Stéphane](https://github.com/bulby97)
- fixed; prevent value splitting on non-multi-value select, thanks
  [Alan R. Soares](https://github.com/alanrsoares)

## v0.6.8 / 2015-09-16

- fixed; broader range of allowed prereleases for React 0.14, including rc1
- fixed; preventing backspace from navigating back in the browser history,
  thanks [davidpene](https://github.com/davidpene)

## v0.6.7 / 2015-08-28

- fixed; missing styles for `.Select-search-prompt` and `.Select-searching`
  issues, thanks [Jaak Erisalu](https://github.com/jaakerisalu) and
  [davidpene](https://github.com/davidpene)

## v0.6.6 / 2015-08-26

- fixed; issue in Chrome where clicking the scrollbar would close the menu,
  thanks [Vladimir Matsola](https://github.com/vomchik)

## v0.6.5 / 2015-08-24

- fixed; completely ignores clicks on disabled items, unless the target of the
  click is a link, thanks [Ben Stahl](https://github.com/bhstahl)

## v0.6.4 / 2015-08-24

This release includes a huge improvement to the examples / website thanks to
@jossmac. Also:

- added; support for React 0.14 beta3
- fixed; disabled options after searching, thanks @bruderstein
- added; support for "Searching..." text (w/ prop) while loading async results,
  thanks @bruderstein and @johnomalley
- added; `className`, `style` and `title` keys are now supported in option
  properties, thanks @bruderstein

## v0.6.3 / 2015-08-18

Otherwise known as "the real 0.6.2" this includes the updated build for the last
version; sorry about that!

## v0.6.2 / 2015-08-13

- changed; if the `searchable` prop is `false`, the menu is opened _or closed_
  on click, more like a standard Select input. thanks
  [MaaikeB](https://github.com/MaaikeB)

## v0.6.1 / 2015-08-09

- added; Support for options with numeric values, thanks
  [Dave Brotherstone](https://github.com/bruderstein)
- changed; Disabled options now appear in the search results , thanks
  [Dave Brotherstone](https://github.com/bruderstein)
- fixed; asyncOptions are reloaded on componentWillReceiveProps when the value
  has changed, thanks [Francis Cote](https://github.com/drfeelgoud)
- added; `cacheAsyncResults` prop (default `true`) now controls whether the
  internal cache is used for `asyncOptions`

## v0.6.0 / 2015-08-05

- improved; option, value and single value have been split out into their own
  components, and can be customised with props. see
  [#328](https://github.com/JedWatson/react-select/pull/328) for more details.
- improved; Near-complete test coverage thanks to the awesome work of
  [Dave Brotherstone](https://github.com/bruderstein)
- improved; Support all alpha/beta/rc's of React 0.14.0, thanks
  [Sébastien Lorber](https://github.com/slorber)
- fixed; Close multi-select menu when tabbing away, thanks
  [Ben Alpert](https://github.com/spicyj)
- fixed; Bug where Select shows the value instead of the label (reapplying fix)
- fixed; `valueRenderer` now works when `multi={false}`, thanks
  [Chris Portela](https://github.com/0xCMP)
- added; New property `backspaceRemoves` (default `true`), allows the default
  behaviour of removing values with backspace when `multi={true}`, thanks
  [Leo Lehikoinen](https://github.com/lehikol2)

## v0.5.6 / 2015-07-27

- fixed; Allow entering of commas when allowCreate is on but multi is off,
  thanks [Angelo DiNardi](https://github.com/adinardi)
- fixed; Times (clear) character is now rendered from string unicode character
  for consistent output, thanks [Nibbles](https://github.com/Siliconrob)
- fixed; allowCreate bug, thanks [goodzsq](https://github.com/goodzsq)
- fixed; changes to props.placeholder weren't being reflected correctly, thanks
  [alesn](https://github.com/alesn)
- fixed; error when escape is pressedn where `clearValue` was not passed the
  event, thanks [Mikhail Kotelnikov](https://github.com/mkotelnikov)
- added; More tests, thanks [Dave Brotherstone](https://github.com/bruderstein)

## v0.5.5 / 2015-07-12

- fixed; replaced usage of `component.getDOMNode()` with
  `React.findDOMNode(component)` for compatibility with React 0.14

## v0.5.4 / 2015-07-06

- fixed; regression in 0.5.3 that broke componentWillMount, sorry everyone!
- added; `addLabelText` prop for customising the "add {label}?" text when in
  tags mode, thanks [Fenn](https://github.com/Fenntasy)

## v0.5.3 / 2015-07-05

- fixed; autoload issues, thanks [Maxime Tyler](https://github.com/iam4x)
- fixed; style incompatibilities with Foundation framework, thanks
  [Timothy Kempf](https://github.com/Fauntleroy)

## v0.5.2 / 2015-06-28

- fixed; bug where Select shows the value instead of the label, thanks
  [Stephen Demjanenko](https://github.com/sdemjanenko)
- added; 'is-selected' classname is added to the selected option, thanks
  [Alexey Volodkin](https://github.com/miraks)
- fixed; async options are now loaded with the initial value, thanks
  [Pokai Chang](https://github.com/Neson)
- fixed; `react-input-autosize` now correctly escapes ampersands (&), not
  actually a fix in react-select but worth noting here because it would have
  been causing a problem in `react-select` as well.

## v0.5.1 / 2015-06-21

- added; custom option and value rendering capability, thanks
  [Brian Reavis](https://github.com/brianreavis)
- fixed; collapsing issue when single-select or empty multi-select fields are
  disabled
- fixed; issue where an empty value would be left after clearing all values in a
  multi-select field

## v0.5.0 / 2015-06-20

- fixed; `esc` key incorrectly created empty options, thanks
  [rgrzelak](https://github.com/rgrzelak)
- adeed; New feature to allow option creation ("tags mode"), enable with
  `allowCreate` prop, thanks [Florent Vilmart](https://github.com/flovilmart)
  and [Brian Reavis](https://github.com/brianreavis)
- fixed; IE8 compatibility fallback for `addEventListener/removeEventListener`,
  which don't exist in IE8, thanks
  [Stefan Billiet](https://github.com/StefanBilliet)
- fixed; Undefined values when using asyncOptions, thanks
  [bannaN](https://github.com/bannaN)
- fixed; Prevent add the last focused value when the drop down menu is closed /
  Pushing enter without dropdown open adds a value, thanks
  [Giuseppe](https://github.com/giuse88)
- fixed; Callback context is undefined, thanks
  [Giuseppe](https://github.com/giuse88)
- fixed; Issue with event being swallowed on Enter `keydown`, thanks
  [Kevin Burke](https://github.com/kembuco)
- added; Support for case-insensitive filtering when `matchPos="start"`, thanks
  [wesrage](https://github.com/wesrage)
- added; Support for customizable background color, thanks
  [John Morales](https://github.com/JohnMorales)
- fixed; Updated ESLint and cleared up warnings, thanks
  [Alexander Shemetovsky](https://github.com/AlexKVal)
- fixed; Close dropdown when clicking on select, thanks
  [Nik Butenko](https://github.com/nkbt)
- added; Tests, and mocha test framework, thanks
  [Craig Dallimore](https://github.com/craigdallimore)
- fixed; You can now start the example server and watch for changes with `npm start`

## v0.4.9 / 2015-05-11

- fixed; focus was being grabbed by the select when `autoload` and
  `asyncOptions` were set
- added; `focus` method on the component
- added; support for disabled options, thanks
  [Pasha Palangpour](https://github.com/pashap)
- improved; more closures, less binds, for better performance, thanks
  [Daniel Cousens](https://github.com/dcousens)

## v0.4.8 / 2015-05-02

- fixed; restored `dist/default.css`
- fixed; standalone example works again
- fixed; clarified dependency documentation and added dependencies for Bower
- fixed; Scoping issues in `_bindCloseMenuIfClickedOutside`, thanks
  [bannaN](https://github.com/bannaN)
- fixed; Doesnt try to set focus afterupdate if component is disabled, thanks
  [bannaN](https://github.com/bannaN)

## v0.4.7 / 2015-04-21

- improved; lodash is no longer a dependency, thanks
  [Daniel Lo Nigro](https://github.com/Daniel15)

## v0.4.6 / 2015-04-06

- updated; dependencies, build process and input-autosize component

## v0.4.5 / 2015-03-28

- fixed; issue with long options overlapping arrow and clear icons, thanks
  [Rohit Kalkur](https://github.com/rovolution)

## v0.4.4 / 2015-03-26

- fixed; error handling click events when the menu is closed, thanks
  [Ilya Petrov](https://github.com/muromec)
- fixed; issue where options will not be filtered in certain conditions, thanks
  [G. Kay Lee](https://github.com/gsklee)

## v0.4.3 / 2015-03-25

- added tests and updated dependencies

## v0.4.2 / 2015-03-23

- added; ESLint and contributing guide
- fixed; incorrect `classnames` variable assignment in window scope
- fixed; all ESLint errors and warnings (except invalid JSX undefined/unused
  vars due to ESLint bug)
- fixed; first option is now focused correctly, thanks
  [Eivind Siqveland Larsen](https://github.com/esiqveland)

## v0.4.1 / 2015-03-20

- fixed; IE11 issue: clicking on scrollbar within menu no longer closes menu,
  thanks [Rohit Kalkur](https://github.com/rovolution)

## v0.4.0 / 2015-03-12

- updated; compatible with React 0.13

## v0.3.5 / 2015-03-09

- improved; less/no repaint on scroll for performance wins, thanks
  [jsmunich](https://github.com/jsmunich)
- added; `onBlur` and `onFocus` event handlers, thanks
  [Jonas Budelmann](https://github.com/cloudkite)
- added; support for `inputProps` prop, passed to the `<input>` component,
  thanks [Yann Plantevin](https://github.com/YannPl)
- changed; now using
  [react-component-gulp-tasks](https://github.com/JedWatson/react-component-gulp-tasks)
  for build
- fixed; issue w/ remote callbacks overriding cached options, thanks
  [Corey McMahon](https://github.com/coreymcmahon)
- fixed; if not `this.props.multi`, menu doesn't need handleMouseDown, thanks
  [wenbing](https://github.com/wenbing)

## v0.3.4 / 2015-02-23

- fixed; issues with the underscore/lodash dependency change, thanks
  [Aaron Powell](https://github.com/aaronpowell)

## v0.3.3 / 2015-02-22

- added; `disabled` prop, thanks [Danny Shaw](https://github.com/dannyshaw)
- added; `searchable` prop - set to `false` to disable the search box, thanks
  [Julen Ruiz Aizpuru](https://github.com/julen)
- added; `onOptionLabelClick` prop - see
  [#66](https://github.com/JedWatson/react-select/pull/66) for docs, thanks
  [Dmitry Smirnov](https://github.com/dmitry-smirnov)
- fixed; `text-overflow: ellipsis;` typo, thanks
  [Andru Vallance](https://github.com/andru)

## v0.3.2 / 2015-01-30

- fixed; issue adding undefined values to multiselect, thanks
  [Tejas Dinkar](https://github.com/gja)

## v0.3.1 / 2015-01-20

- fixed; missing `var` statement

## v0.3.0 / 2015-01-20

- added; node compatible build now available in `/lib`

## v0.2.14 / 2015-01-07

- added; `searchPromptText` property that is displayed when `asyncOptions` is
  set and there are (a) no options loaded, and (b) no input entered to search
  on, thanks [Anton Fedchenko](https://github.com/kompot)
- added; `clearable` property (defaults to `true`) to control whether the
  "clear" control is available, thanks
  [Anton Fedchenko](https://github.com/kompot)

## v0.2.13 / 2015-01-05

- fixed; height issues in Safari, thanks
  [Joss Mackison](https://github.com/jossmac)
- added; Option to specify "Clear value" label as prop for i18n

## v0.2.12 / 2015-01-04

- fixed; UI now responds to touch events, and works on mobile devices! thanks
  [Fraser Xu](https://github.com/fraserxu)

## v0.2.11 / 2015-01-04

- fixed; Options in the dropdown now scroll into view when they are focused,
  thanks [Adam](https://github.com/fmovlex)
- improved; Example dist is now excluded from the npm package

## v0.2.10 / 2015-01-01

- fixed; More specific mixin name to avoid conflicts (css)
- fixed; Example CSS now correctly rebuilds on changes in development
- fixed; Values are now expanded correctly when options change (see #28)
- added; Option to specify "No results found" label as prop for i18n, thanks
  [Julen Ruiz Aizpuru](https://github.com/julen)

## v0.2.9 / 2014-12-09

- added; `filterOption` and `filterOptions` props for more control over
  filtering

## v0.2.8 / 2014-12-08

- added; `matchPos` option to control whether to match the `start` or `any`
  position in the string when filtering options (default: `any`)
- added; `matchProp` option to control whether to match the `value`, `label` or
  `any` property of each option when filtering (default: `any`)

## v0.2.7 / 2014-12-01

- fixed; screen-readers will now read "clear value" instead of "times" for the
  clear button
- fixed; non-left-click mousedown events aren't blocked by the control

## v0.2.6 / 2014-11-30

- improved; better comparison of changes to [options] in `willReceiveProps`
- fixed; now focuses the first option correctly when in multiselect mode
- fixed; fixed focused option behaviour on value change
- fixed; when filtering, there is always a focused option (#19)
- changed; using ^ in package.json to compare dependencies

## v0.2.5 / 2014-11-20

- fixed; compatibility with case-sensitive file systems

## v0.2.4 / 2014-11-20

- fixed; package.json pointed at the right file

## v0.2.3 / 2014-11-17

- fixed; Updating state correctly when props change
- improved; Build tasks and docs
- added; Working standalone build
- added; Minified dist version
- added; Publised to Bower

## v0.2.2 / 2014-11-15

- fixed; backspace event being incorrectly cancelled

## v0.2.1 / 2014-11-15

- fixed; issue where backspace incorrectly clears the value (#14)

## v0.2.0 / 2014-11-15

- changed; Major rewrite to improve focus handling and internal state management
- added; Support for `multi` prop, enable multiselect mode

## v0.1.1 / 2014-11-03

- added; Support for `onChange` event
- added; `propTypes` are defined by the `Select` component now
- added; `className` property, sets the `className` on the outer `div` element
- fixed; Removed deprecated `React.DOM.x` calls

## v0.1.0 / 2014-11-01

- updated; React to 0.12.0

## v0.0.6 / 2014-10-14

- fixed; Error keeping value when using Async Options
