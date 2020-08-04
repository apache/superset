# CHANGELOG

## [v1.5.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.4.1...v1.5.0) (2019-01-25)

### New Features

* [#116]: Add `id` property to specify the DOM ID for the generated tree nodes
* [#122]: Add `label`, `isLeaf`, `isParent`, `parent`, `treeDepth`, and `level` metadata to the target node of `onCheck`, `onClick`, and `onExpand` handlers

### Bug Fixes

* [#119]: Fix issue where an initially disabled tree could not be enabled after the initial render
* [#120]: Fix issue where Internet Explorer and Microsoft Edge browsers would fail to update check state when a parent was in a half-check or indeterminate state
* [#125]: Fix misalignment of TreeNode's `label` property between PropType and TypeScript definitions

### Other

* [#115]: Add example react-fontawesome usage for the `icons` prop

## [v1.4.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.4.0...v1.4.1) (2018-09-21)

### Bug Fixes

* [#113]: Add missing `expandOpen` property from TypeScript declaration (...again)

## [v1.4.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.3.1...v1.4.0) (2018-09-21)

### New Features

* [#114]: Add `rct-node-expanded` and `rct-node-collapsed` classes to expanded and collapsed parent nodes

### Bug Fixes

* [#113]: Add missing `expandOpen` property from TypeScript declaration

## [v1.3.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.3.0...v1.3.1) (2018-09-06)

### Bug Fixes

* [#109]: Fix erroneous PropTypes check for `lang` property

## [v1.3.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.2.4...v1.3.0) (2018-09-05)

### New Features

* [#79]: Add `showExpandAll` property to give the user the ability to expand or collapse all nodes in the tree
* [#96]: Add TypeScript definitions
* [#102]: Add `icons` property to allow specification of icon components
* [#103]: Add `title` node property and `showNodeTitle` tree property
* [#108]: Add `lang` property for language customization

### Bug Fixes

* [#61]: Fix issue where disabled children would be checked if a parent node was checked

### Other

* [#91]: Prevent disconnection between Sass and Less files on build
* [#97]: Some performance optimizations

## [v1.2.4](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.2.3...v1.2.4) (2018-08-29)

### Bug Fixes

* [#82], [#84]: Fix undefined Crypto API errors in Node environments
* [#104]: Fix issue where numeric node values could trigger PropType warnings

## [v1.2.3](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.2.2...v1.2.3) (2018-06-23)

### Bug Fixes

* [#81]: Fix render errors for all numeric value types

## [v1.2.2](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.2.1...v1.2.2) (2018-05-24)

### Bug Fixes

* [#89]: Fix misnamed variables in the Less stylesheets
* [#90]: Coerce NaN types to string when outputting DOM IDs

## [v1.2.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.2.0...v1.2.1) (2018-05-10)

### Bug Fixes

* [#87]: Fix issue where passing the `onClick` property would trigger a warning about unique `key` prop

## [v1.2.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.1.0...v1.2.0) (2018-05-08)

### New Features

* [#68]: Add `onClick` and `expandOnClick` properties

### Other

* [#69]: Tree will no longer throw an exception if `checked` or `expanded` contains values that do not recursively exist in the `nodes` property

## [v1.1.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.0.2...v1.1.0) (2018-03-31)

### New Features

* [#53]: Add `nativeCheckboxes` property to allow use of native browser checkboxes instead of pseudo-checkbox icons
* [#72]: Add the node that triggers `onCheck` or `onExpand` as a second parameter to the callback functions
* [#80]: Add `onlyLeafCheckboxes` property and support `showCheckbox` on the node-level

## [v1.0.2](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.0.1...v1.0.2) (2017-10-24)

### Bug Fixes

* [#57]: Fix an issue where node values with spaces in them would cause validation errors

## [v1.0.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v1.0.0...v1.0.1) (2017-09-30)

### Dependencies

* [#54]: Add support for React 16

## [v1.0.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.6.4...v1.0.0) (2017-09-21)

### New Features

* [#49]: Add the ability to specify `disabled` to individual nodes
* [#50]: Allow `node.label` to be any valid React node

### Usability

* [#51]: Apply additional background color when a node is active

## [v0.6.4](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.6.3...v0.6.4) (2017-07-22)

### Bug Fixes

* [#42]: Fix npm package not aligning with Git version

## [v0.6.3](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.6.2...v0.6.3) (2017-05-30)

The **v0.6.x** series will likely be the last series before the **v1.0** release. The API is not expected to significantly change, but new features will not be added to pre-1.0 versions.

### New Features

* [#35]: Add `disabled` and `expandDisabled` options to `<CheckboxTree>`

## [v0.6.2](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.6.1...v0.6.2) (2017-05-25)

### New Features

* [#34]: Add `noCascade` option to decouple parent check state from children

## [v0.6.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.6.0...v0.6.1) (2017-05-09)

### Other

* [#33]: Add a `prepublish` command to ensure that the `./lib` folder is built before package is published to npm

## [v0.6.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.5.2...v0.6.0) (2017-05-06)

### New Features

* [#32]: Allow customization of `className` at the node level
* [#30]: Add `showNodeIcon` property to optionally remove node icons

### Other

* [#14]: Component performance when rendering and updating a large number of nodes has been significantly increased

## [v0.5.2](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.5.1...v0.5.2) (2017-05-03)

### Bug Fixes

* [#31]: Fix issue where expand buttons would submit a parent form

## [v0.5.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.5.0...v0.5.1) (2017-03-21)

### New Features

* [#27]: Add `rct-node-leaf` and `rct-node-parent` classes to the TreeNode `<li>` element

## [v0.5.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.4.2...v0.5.0) (2017-03-12)

### Breaking Changes

* [#20]: Remove deprecated `title` property in `nodes` (use `label` instead)

### New Features

* [#2]: Allow customization of icons via CSS
* [#26]: Allow icon customization at node level

## [v0.4.2](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.4.1...v0.4.2) (2017-02-27)

### Bug Fixes

* [#22]: Remove expand-like behavior on nodes without children
* [#23]: Fix issue where property validation was not occurring on node items

## [v0.4.1](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.4.0...v0.4.1) (2017-02-15)

### Deprecations

* [#20]: Add support for `label` in `nodes` property and deprecate `title`

### New Features

* [#21]: Add greater accessibility support

## [v0.4.0](https://github.com/jakezatecky/react-checkbox-tree/compare/v0.3.0...v0.4.0) (2017-01-27)

### Bug Fixes

* [#17]: Auto-prefix CSS styles to support older browsers
* [#18]: Remove unnecessary margin on tree lists

### New Features

* [#15]: Provide `optimisticToggle` configuration to toggle child nodes optimistically or pessimistically
